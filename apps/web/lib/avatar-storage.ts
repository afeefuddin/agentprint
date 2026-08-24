import { UTApi, UTFile } from "uploadthing/server";

let client: UTApi | undefined;

function uploadThing(): UTApi {
  if (!process.env.UPLOADTHING_TOKEN) {
    throw new Error("Avatar storage requires UPLOADTHING_TOKEN.");
  }
  client ??= new UTApi();
  return client;
}

function extensionFor(contentType: string): "jpg" | "png" | "webp" {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

export async function putProfileAvatar(
  userId: string,
  contentType: string,
  contents: ArrayBuffer
): Promise<string> {
  const file = new UTFile(
    [contents],
    `avatar-${userId}.${extensionFor(contentType)}`,
    { type: contentType }
  );
  const result = await uploadThing().uploadFiles(file, {
    acl: "public-read",
    contentDisposition: "inline"
  });
  if (result.error) throw new Error(`UploadThing avatar upload failed: ${result.error.message}`);
  return result.data.key;
}

export async function profileAvatarUrl(key: string): Promise<string> {
  return (await uploadThing().generateSignedURL(key, { expiresIn: "7 days" })).ufsUrl;
}

export async function removeProfileAvatar(key: string): Promise<void> {
  const result = await uploadThing().deleteFiles(key);
  if (!result.success) throw new Error("UploadThing did not delete the avatar.");
}
