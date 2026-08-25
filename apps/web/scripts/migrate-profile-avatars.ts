import { UTApi } from "uploadthing/server";
import {
  listLegacyProfileAvatars,
  pool,
  replaceProfileAvatarObjectKey
} from "@agentprint/database";
import { putProfileAvatar, removeProfileAvatar } from "../lib/avatar-storage";

const MAX_AVATAR_BYTES = 5_242_880;
const dryRun = process.argv.includes("--dry-run");

if (!dryRun && !process.env.UPLOADTHING_TOKEN) {
  throw new Error("Set UPLOADTHING_TOKEN to read legacy avatar objects.");
}

const uploadThing = dryRun ? undefined : new UTApi();
let migrated = 0;
let failed = 0;

try {
  const avatars = await listLegacyProfileAvatars();
  if (dryRun) {
    console.log(`Profile avatar migration dry run: ${avatars.length} legacy avatar(s) to migrate.`);
  } else for (const avatar of avatars) {
    let replacementKey: string | undefined;
    try {
      const legacyUrl = await uploadThing!.generateSignedURL(avatar.object_key, { expiresIn: "5 minutes" });
      const response = await fetch(legacyUrl.ufsUrl);
      if (!response.ok) throw new Error(`legacy_download_${response.status}`);
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_AVATAR_BYTES) throw new Error("legacy_avatar_too_large");
      const contents = await response.arrayBuffer();
      if (contents.byteLength === 0 || contents.byteLength > MAX_AVATAR_BYTES) {
        throw new Error("legacy_avatar_size_invalid");
      }

      replacementKey = await putProfileAvatar(avatar.user_id, avatar.content_type, contents);
      const replaced = await replaceProfileAvatarObjectKey(
        avatar.user_id,
        avatar.object_key,
        replacementKey
      );
      if (!replaced) {
        await removeProfileAvatar(replacementKey);
        replacementKey = undefined;
        throw new Error("avatar_changed_during_migration");
      }

      const deletion = await uploadThing!.deleteFiles(avatar.object_key);
      if (!deletion.success) {
        console.warn(`Migrated ${avatar.user_id}, but legacy deletion needs manual cleanup.`);
      }
      migrated += 1;
      console.log(`Migrated avatar for ${avatar.user_id}`);
    } catch (error) {
      failed += 1;
      console.error(`Failed avatar migration for ${avatar.user_id}:`, error);
    }
  }
  if (!dryRun) {
    console.log(`Profile avatar migration complete: ${migrated} migrated, ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
  }
} finally {
  await pool.end();
}
