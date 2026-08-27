import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

export const MAX_SHARE_UPLOAD_BYTES = 8 * 1024 * 1024;
export const SHARE_UPLOAD_CONTENT_TYPE = "application/json";
export const SHARE_UPLOAD_CONTENT_ENCODING = "gzip";

type SpacesConnection = ReturnType<typeof createSpacesConnection>;
let cachedConnection: SpacesConnection | undefined;

function spacesConfiguration() {
  const endpoint = process.env.SPACES_ENDPOINT;
  const bucket = process.env.SPACES_BUCKET;
  const accessKeyId = process.env.SPACES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SPACES_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("spaces_not_configured");
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

function createSpacesConnection() {
  const configuration = spacesConfiguration();
  return {
    bucket: configuration.bucket,
    client: new S3Client({
      endpoint: configuration.endpoint,
      forcePathStyle: false,
      region: "us-east-1",
      credentials: {
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey
      }
    })
  };
}

export function spacesClient() {
  cachedConnection ??= createSpacesConnection();
  return cachedConnection;
}

export function isMissingSpaceObject(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("$metadata" in error)) return false;
  const metadata = error.$metadata as { httpStatusCode?: number };
  return metadata.httpStatusCode === 404;
}

export async function presignSessionShareUpload(objectKey: string, contentLength: number) {
  const { bucket, client } = spacesClient();
  return createPresignedPost(client, {
    Bucket: bucket,
    Key: objectKey,
    Expires: 10 * 60,
    Fields: {
      acl: "private",
      "Content-Type": SHARE_UPLOAD_CONTENT_TYPE,
      "Content-Encoding": SHARE_UPLOAD_CONTENT_ENCODING
    },
    Conditions: [
      ["content-length-range", contentLength, contentLength],
      ["eq", "$acl", "private"],
      ["eq", "$Content-Type", SHARE_UPLOAD_CONTENT_TYPE],
      ["eq", "$Content-Encoding", SHARE_UPLOAD_CONTENT_ENCODING]
    ]
  });
}

export async function inspectSessionShareUpload(objectKey: string) {
  const { bucket, client } = spacesClient();
  const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
  return {
    contentLength: object.ContentLength ?? -1,
    contentType: object.ContentType ?? "",
    contentEncoding: object.ContentEncoding ?? ""
  };
}

export async function readSessionShareUpload(objectKey: string, maxBytes = MAX_SHARE_UPLOAD_BYTES) {
  const { bucket, client } = spacesClient();
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  if (!object.Body || (object.ContentLength ?? maxBytes + 1) > maxBytes) {
    throw new Error("upload_too_large");
  }
  const body = Buffer.from(await object.Body.transformToByteArray());
  if (body.byteLength > maxBytes) throw new Error("upload_too_large");
  return body;
}

export async function deleteSessionShareUpload(objectKey: string) {
  const { bucket, client } = spacesClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
}
