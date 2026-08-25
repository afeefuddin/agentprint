import { afterEach, describe, expect, test } from "bun:test";
import { presignSessionShareUpload } from "./spaces";

const original = {
  endpoint: process.env.SPACES_ENDPOINT,
  bucket: process.env.SPACES_BUCKET,
  accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
  secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY
};

afterEach(() => {
  const restore = (name, value) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore("SPACES_ENDPOINT", original.endpoint);
  restore("SPACES_BUCKET", original.bucket);
  restore("SPACES_ACCESS_KEY_ID", original.accessKeyId);
  restore("SPACES_SECRET_ACCESS_KEY", original.secretAccessKey);
});

describe("presignSessionShareUpload", () => {
  test("binds the object key, metadata, and exact payload length into the policy", async () => {
    process.env.SPACES_ENDPOINT = "https://blr1.digitaloceanspaces.com";
    process.env.SPACES_BUCKET = "agentprint-test";
    process.env.SPACES_ACCESS_KEY_ID = "test-access-key";
    process.env.SPACES_SECRET_ACCESS_KEY = "test-secret-key";

    const result = await presignSessionShareUpload("session-uploads/user/upload.json.gz", 4096);
    const policy = JSON.parse(Buffer.from(result.fields.Policy, "base64").toString("utf8"));

    expect(result.url).toBe("https://agentprint-test.blr1.digitaloceanspaces.com/");
    expect(result.fields.key).toBe("session-uploads/user/upload.json.gz");
    expect(policy.conditions).toContainEqual(["content-length-range", 4096, 4096]);
    expect(policy.conditions).toContainEqual(["eq", "$Content-Encoding", "gzip"]);
    expect(policy.conditions).toContainEqual(["eq", "$Content-Type", "application/json"]);
  });
});
