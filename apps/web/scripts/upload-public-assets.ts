import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const assetDirectories = ["auth", "brand", "brands", "landing", "metrics"];
const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function configuration(prefix: string) {
  const endpoint = process.env.SPACES_ENDPOINT;
  const bucket = process.env.SPACES_BUCKET;
  const accessKeyId = process.env.SPACES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SPACES_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Set SPACES_ENDPOINT, SPACES_BUCKET, SPACES_ACCESS_KEY_ID, " +
      "SPACES_SECRET_ACCESS_KEY, and SPACES_PUBLIC_ASSET_PREFIX."
    );
  }
  if (prefix.startsWith("/") || prefix.endsWith("/") || prefix.includes("..")) {
    throw new Error("SPACES_PUBLIC_ASSET_PREFIX must be a safe key prefix without surrounding slashes.");
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey, prefix };
}

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(candidate));
    else if (entry.isFile() && contentTypes[path.extname(entry.name).toLowerCase()]) files.push(candidate);
  }
  return files;
}

const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const files = (await Promise.all(
  assetDirectories.map((directory) => filesUnder(path.join(publicDirectory, directory)))
)).flat().sort();
const prefix = process.env.SPACES_PUBLIC_ASSET_PREFIX ?? "public-assets/2026-08-26";

if (process.argv.includes("--dry-run")) {
  for (const file of files) {
    const relativePath = path.relative(publicDirectory, file).split(path.sep).join("/");
    console.log(`${prefix}/${relativePath}`);
  }
  console.log(`Would upload ${files.length} public assets to ${prefix}/`);
  process.exit(0);
}

const config = configuration(prefix);
const client = new S3Client({
  endpoint: config.endpoint,
  forcePathStyle: false,
  region: "us-east-1",
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  }
});

for (const file of files) {
  const relativePath = path.relative(publicDirectory, file).split(path.sep).join("/");
  const extension = path.extname(file).toLowerCase();
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: `${config.prefix}/${relativePath}`,
    Body: await readFile(file),
    ACL: "public-read",
    ContentType: contentTypes[extension],
    CacheControl: "public, max-age=31536000, immutable"
  }));
  console.log(`Uploaded ${relativePath}`);
}

console.log(`Uploaded ${files.length} public assets to ${config.prefix}/`);
