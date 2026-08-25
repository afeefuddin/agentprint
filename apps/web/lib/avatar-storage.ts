import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UTApi } from "uploadthing/server";
import { spacesClient } from "./spaces";

const PROFILE_AVATAR_PREFIX = "profile-avatars/v1/";
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

export function isSpacesProfileAvatarKey(key: string) {
  return key.startsWith(PROFILE_AVATAR_PREFIX);
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
