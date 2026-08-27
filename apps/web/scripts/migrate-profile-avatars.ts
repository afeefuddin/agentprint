import { UTApi } from "uploadthing/server";
import {
  listLegacyProfileAvatars,
  pool,
  replaceProfileAvatarObjectKey
} from "@agentprint/database";
import { putProfileAvatar, removeProfileAvatar } from "../lib/avatar-storage";

const MAX_AVATAR_BYTES = 5_242_880;
const dryRun = process.argv.includes("--dry-run");

async function readLegacyAvatar(response: Response): Promise<ArrayBuffer> {
  if (!response.body) throw new Error("legacy_avatar_body_missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_AVATAR_BYTES) {
        await reader.cancel();
        throw new Error("legacy_avatar_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (totalBytes === 0) throw new Error("legacy_avatar_size_invalid");

  const contents = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    contents.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return contents.buffer;
}

type LegacyAvatar = Awaited<ReturnType<typeof listLegacyProfileAvatars>>[number];

async function migrateAvatar(uploadThing: UTApi, avatar: LegacyAvatar): Promise<boolean> {
  const legacyUrl = await uploadThing.generateSignedURL(
    avatar.object_key,
    { expiresIn: "5 minutes" }
  );
  const response = await fetch(legacyUrl.ufsUrl);
  if (!response.ok) throw new Error(`legacy_download_${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_AVATAR_BYTES) throw new Error("legacy_avatar_too_large");
  const contents = await readLegacyAvatar(response);

  const replacementKey = await putProfileAvatar(
    avatar.user_id,
    avatar.content_type,
    contents
  );
  const replaced = await replaceProfileAvatarObjectKey(
    avatar.user_id,
    avatar.object_key,
    replacementKey
  );
  if (!replaced) {
    await removeProfileAvatar(replacementKey);
    throw new Error("avatar_changed_during_migration");
  }

  try {
    return (await uploadThing.deleteFiles(avatar.object_key)).success;
  } catch {
    return false;
  }
}

let migrated = 0;
let failed = 0;
let cleanupRequired = 0;

try {
  const avatars = await listLegacyProfileAvatars();
  if (dryRun) {
    console.log(`Profile avatar migration dry run: ${avatars.length} legacy avatar(s) to migrate.`);
  } else {
    if (!process.env.UPLOADTHING_TOKEN) {
      throw new Error("Set UPLOADTHING_TOKEN to read legacy avatar objects.");
    }
    const uploadThing = new UTApi();
    for (const avatar of avatars) {
      try {
        const legacyDeleted = await migrateAvatar(uploadThing, avatar);
        if (!legacyDeleted) {
          cleanupRequired += 1;
          console.warn(`Legacy object ${avatar.object_key} needs manual cleanup.`);
        }
        migrated += 1;
        console.log(`Migrated avatar for ${avatar.user_id}`);
      } catch (error) {
        failed += 1;
        console.error(`Failed avatar migration for ${avatar.user_id}:`, error);
      }
    }
  }
  if (!dryRun) {
    console.log(
      `Profile avatar migration complete: ${migrated} migrated, ${failed} failed, ` +
      `${cleanupRequired} legacy cleanup required.`
    );
    if (failed > 0 || cleanupRequired > 0) process.exitCode = 1;
  }
} finally {
  await pool.end();
}
