import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { PUBLIC_ASSET_PATHS } from "../lib/assets";
import { spacesClient } from "../lib/spaces";

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function validatePrefix(prefix: string): string {
  if (prefix.startsWith("/") || prefix.endsWith("/") || prefix.includes("..")) {
    throw new Error("SPACES_PUBLIC_ASSET_PREFIX must be a safe key prefix without surrounding slashes.");
  }
  return prefix;
}

const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const prefix = validatePrefix(
  process.env.SPACES_PUBLIC_ASSET_PREFIX ?? "public-assets/2026-08-26"
);

if (process.argv.includes("--dry-run")) {
  for (const assetPath of PUBLIC_ASSET_PATHS) {
    console.log(`${prefix}${assetPath}`);
  }
  console.log(`Would upload ${PUBLIC_ASSET_PATHS.length} public assets to ${prefix}/`);
  process.exit(0);
}

const { bucket, client } = spacesClient();

for (const assetPath of PUBLIC_ASSET_PATHS) {
  const file = path.join(publicDirectory, assetPath.slice(1));
  const extension = path.extname(file).toLowerCase();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: `${prefix}${assetPath}`,
    Body: await readFile(file),
    ACL: "public-read",
    ContentType: contentTypes[extension],
    CacheControl: "public, max-age=31536000, immutable"
  }));
  console.log(`Uploaded ${assetPath.slice(1)}`);
}

console.log(`Uploaded ${PUBLIC_ASSET_PATHS.length} public assets to ${prefix}/`);
