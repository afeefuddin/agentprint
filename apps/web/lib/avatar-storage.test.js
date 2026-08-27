import { afterEach, describe, expect, test } from "bun:test";
import {
  hasExpectedProfileAvatarSignature,
  presignProfileAvatarUpload
} from "./avatar-storage";

const original = {
  endpoint: process.env.SPACES_ENDPOINT,
  bucket: process.env.SPACES_BUCKET,
  accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
  secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY
};

afterEach(() => {
  for (const [name, value] of Object.entries({
    SPACES_ENDPOINT: original.endpoint,
    SPACES_BUCKET: original.bucket,
    SPACES_ACCESS_KEY_ID: original.accessKeyId,
    SPACES_SECRET_ACCESS_KEY: original.secretAccessKey
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("presignProfileAvatarUpload", () => {
  test("binds the owner key, content type, and exact length", async () => {
    process.env.SPACES_ENDPOINT = "https://blr1.digitaloceanspaces.com";
    process.env.SPACES_BUCKET = "agentprint-test";
    process.env.SPACES_ACCESS_KEY_ID = "test-access-key";
    process.env.SPACES_SECRET_ACCESS_KEY = "test-secret-key";

    const result = await presignProfileAvatarUpload({
      userId: "user-id",
      uploadId: "upload-id",
      contentType: "image/png",
      contentLength: 4096
    });
    const policy = JSON.parse(Buffer.from(result.fields.Policy, "base64").toString("utf8"));

    expect(result.fields.key).toBe("profile-avatar-uploads/user-id/upload-id");
    expect(policy.conditions).toContainEqual(["content-length-range", 4096, 4096]);
    expect(policy.conditions).toContainEqual(["eq", "$acl", "private"]);
    expect(policy.conditions).toContainEqual(["eq", "$Content-Type", "image/png"]);
  });
});

describe("hasExpectedProfileAvatarSignature", () => {
  test("recognizes supported image signatures", () => {
    expect(hasExpectedProfileAvatarSignature("image/jpeg", Uint8Array.of(0xff, 0xd8, 0xff))).toBe(true);
    expect(hasExpectedProfileAvatarSignature("image/png", Uint8Array.of(0x89, 0x50, 0x4e, 0x47))).toBe(true);
    expect(hasExpectedProfileAvatarSignature(
      "image/webp",
      Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)
    )).toBe(true);
  });

  test("rejects content that does not match its declared type", () => {
    expect(hasExpectedProfileAvatarSignature("image/png", Uint8Array.of(0xff, 0xd8, 0xff))).toBe(false);
    expect(hasExpectedProfileAvatarSignature(
      "application/octet-stream",
      Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)
    )).toBe(false);
  });
});
