import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { validateSessionShareUpload } from "./session-share-processing";

function payload(overrides = {}) {
  return {
    schema_version: 1,
    harness_id: "codex",
    session_fingerprint: "session-fingerprint-1234567890",
    title: "Review the upload worker",
    visibility: "unlisted",
    redaction_level: "strict",
    redaction: {
      secrets_removed: 0,
      paths_rewritten: 0,
      blocks_truncated: 0,
      turns_excluded: 0
    },
    started_at: "2026-08-26T09:00:00Z",
    ended_at: "2026-08-26T09:05:00Z",
    model_ids: ["gpt-5"],
    totals: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    turns: [{ index: 0, role: "user", blocks: [{ kind: "text", text: "Review this." }] }],
    ...overrides
  };
}

function integrity(contents) {
  return {
    contentLength: contents.byteLength,
    contentSha256: createHash("sha256").update(contents).digest("hex")
  };
}

describe("validateSessionShareUpload", () => {
  test("returns a bounded, valid, credential-free session", async () => {
    const compressed = gzipSync(JSON.stringify(payload()));
    const share = await validateSessionShareUpload(compressed, integrity(compressed));
    expect(share.title).toBe("Review the upload worker");
  });

  test("rejects content that changed after reservation", async () => {
    const compressed = gzipSync(JSON.stringify(payload()));
    await expect(validateSessionShareUpload(compressed, {
      ...integrity(compressed),
      contentSha256: "0".repeat(64)
    })).rejects.toMatchObject({ code: "upload_checksum_mismatch" });
  });

  test("rejects invalid compressed data with a permanent failure code", async () => {
    const compressed = Buffer.from("not gzip");
    await expect(validateSessionShareUpload(compressed, integrity(compressed))).rejects.toMatchObject({
      code: "invalid_compressed_payload"
    });
  });

  test("rejects credentials even when the session matches the schema", async () => {
    const compressed = gzipSync(JSON.stringify(payload({
      turns: [{
        index: 0,
        role: "user",
        blocks: [{ kind: "text", text: `token=${"sk-proj-" + "a".repeat(32)}` }]
      }]
    })));
    await expect(validateSessionShareUpload(compressed, integrity(compressed))).rejects.toMatchObject({
      code: "credentials_detected"
    });
  });
});
