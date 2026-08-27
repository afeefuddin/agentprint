import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UTApi } from "uploadthing/server";
import { spacesClient } from "./spaces";

const PROFILE_AVATAR_PREFIX = "profile-avatars/";
export const MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
let legacyClient: UTApi | undefined;

function uploadThing(): UTApi {
  if (!process.env.UPLOADTHING_TOKEN) {
    throw new Error("Legacy avatar access requires UPLOADTHING_TOKEN until backfill is complete.");
  }
  legacyClient ??= new UTApi();
  return legacyClient;
}

function extensionFor(contentType: string): "jpg" | "png" | "webp" {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

function uploadKey(userId: string, uploadId: string): string {
  return `${PROFILE_AVATAR_PREFIX}${userId}/${uploadId}`;
}

export function hasExpectedProfileAvatarSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (type !== "image/webp") return false;
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

export function isSpacesProfileAvatarKey(key: string) {
  return key.startsWith(PROFILE_AVATAR_PREFIX);
}

export async function presignProfileAvatarUpload(input: {
  userId: string;
  uploadId: string;
  contentType: string;
  contentLength: number;
}) {
  const { bucket, client } = spacesClient();
  const key = uploadKey(input.userId, input.uploadId);
  const signed = await createPresignedPost(client, {
    Bucket: bucket,
    Key: key,
    Expires: 10 * 60,
    Fields: {
      acl: "private",
      "Content-Type": input.contentType
    },
    Conditions: [
      ["content-length-range", input.contentLength, input.contentLength],
      ["eq", "$acl", "private"],
      ["eq", "$Content-Type", input.contentType]
    ]
  });
  return { ...signed, key };
}

export async function inspectProfileAvatarUpload(userId: string, uploadId: string) {
  const { bucket, client } = spacesClient();
  const object = await client.send(new HeadObjectCommand({
    Bucket: bucket,
    Key: uploadKey(userId, uploadId)
  }));
  return {
    contentLength: object.ContentLength ?? -1,
    contentType: object.ContentType ?? ""
  };
}

export async function readProfileAvatarSignature(
  userId: string,
  uploadId: string
): Promise<Uint8Array> {
  const { bucket, client } = spacesClient();
  const object = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: uploadKey(userId, uploadId),
    Range: "bytes=0-11"
  }));
  if (!object.Body) throw new Error("avatar_upload_body_missing");
  const bytes = await object.Body.transformToByteArray();
  if (bytes.byteLength > 12) throw new Error("avatar_upload_signature_too_large");
  return bytes;
}

export function profileAvatarUploadKey(userId: string, uploadId: string): string {
  return uploadKey(userId, uploadId);
}

export async function removeProfileAvatarUpload(userId: string, uploadId: string): Promise<void> {
  const { bucket, client } = spacesClient();
  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: uploadKey(userId, uploadId)
  }));
}

export async function putProfileAvatar(
  userId: string,
  contentType: string,
  contents: ArrayBuffer
): Promise<string> {
  const { bucket, client } = spacesClient();
  const key = `${PROFILE_AVATAR_PREFIX}${userId}/${randomUUID()}.${extensionFor(contentType)}`;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: new Uint8Array(contents),
    ACL: "private",
    ContentType: contentType,
    CacheControl: "private, max-age=604800"
  }));
  return key;
}

export async function profileAvatarUrl(key: string): Promise<string> {
  if (!isSpacesProfileAvatarKey(key)) {
    return (await uploadThing().generateSignedURL(key, { expiresIn: "1 hour" })).ufsUrl;
  }
  const { bucket, client } = spacesClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 * 60 }
  );
}

export async function removeProfileAvatar(key: string): Promise<void> {
  if (!isSpacesProfileAvatarKey(key)) {
    const result = await uploadThing().deleteFiles(key);
    if (!result.success) throw new Error("UploadThing did not delete the legacy avatar.");
    return;
  }
  const { bucket, client } = spacesClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
