import { describe, expect, test } from "bun:test";
import {
  friendRequestSchema,
  friendshipActionSchema,
  friendshipIdSchema,
  onboardingProfileSchema,
  profilePatchSchema,
  publicProfileSearchSchema,
  reservedHandles,
  syncBatchSchema,
  usageRecordSchema
} from "./index";

const validRecord = {
  event_id: "event-id-with-enough-entropy",
  schema_version: 1 as const,
  occurred_at: "2026-07-29T09:30:00Z",
  local_date: "2026-07-29",
  harness_id: "codex" as const,
  input_tokens: 100,
  output_tokens: 20,
  total_tokens: 120,
  source_fingerprint: "source-fingerprint-safe"
};

describe("privacy-safe usage contract", () => {
  test("accepts the documented numeric metadata record", () => {
    expect(usageRecordSchema.safeParse(validRecord).success).toBe(true);
  });

  test.each(["prompt", "response", "content", "file_path", "repository"])(
    "rejects forbidden content-bearing field %s",
    (field) => {
      expect(usageRecordSchema.safeParse({ ...validRecord, [field]: "secret" }).success).toBe(false);
    }
  );

  test("rejects inconsistent token arithmetic", () => {
    expect(usageRecordSchema.safeParse({ ...validRecord, total_tokens: 10 }).success).toBe(false);
  });

  test("requires cost provenance", () => {
    expect(usageRecordSchema.safeParse({ ...validRecord, estimated_cost_micros: 20 }).success).toBe(false);
  });
});

test("batch contract rejects unknown top-level fields", () => {
  expect(syncBatchSchema.safeParse({
    batch_id: "8fe61102-3d21-4b7a-b6f7-6c7f13c6b934",
    schema_version: 1,
    timezone: "UTC",
    records: [validRecord],
    prompts: []
  }).success).toBe(false);
});

describe("profile handles", () => {
  const profile = { display_name: "Maya Chen", timezone: "UTC" };

  test("accepts a public root profile address", () => {
    expect(onboardingProfileSchema.safeParse({ ...profile, handle: "maya-builds" }).success).toBe(true);
  });

  test.each(reservedHandles)("rejects reserved root route %s", (handle) => {
    const result = onboardingProfileSchema.safeParse({ ...profile, handle });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "That profile address is reserved.")).toBe(true);
    }
  });
});

describe("friend contracts", () => {
  test("normalizes exact handles and accepts supported actions", () => {
    expect(friendRequestSchema.parse({ handle: "  Maya-Builds " })).toEqual({ handle: "maya-builds" });
    expect(friendshipActionSchema.safeParse({ action: "accept" }).success).toBe(true);
    expect(friendshipActionSchema.safeParse({ action: "follow" }).success).toBe(false);
    expect(friendshipIdSchema.safeParse("not-a-friendship-id").success).toBe(false);
  });

  test("accepts friend comparison privacy without widening profile patches", () => {
    expect(profilePatchSchema.safeParse({ friends_can_compare: true }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ friends_can_compare: true, friend_ids: [] }).success).toBe(false);
  });
});

describe("public profile search", () => {
  test("trims useful handle and display-name queries", () => {
    expect(publicProfileSearchSchema.parse({ q: "  Maya Ch " })).toEqual({ q: "Maya Ch" });
  });

  test("rejects empty, one-character, and oversized queries", () => {
    expect(publicProfileSearchSchema.safeParse({ q: " " }).success).toBe(false);
    expect(publicProfileSearchSchema.safeParse({ q: "m" }).success).toBe(false);
    expect(publicProfileSearchSchema.safeParse({ q: "m".repeat(81) }).success).toBe(false);
  });
});
