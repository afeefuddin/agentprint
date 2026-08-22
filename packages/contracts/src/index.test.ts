import { describe, expect, test } from "bun:test";
import {
  friendRequestSchema,
  friendshipActionSchema,
  friendshipIdSchema,
  onboardingProfileSchema,
  profilePatchSchema,
  publicProfileSearchSchema,
  reservedHandles,
  sessionShareSchema,
  syncBatchSchema,
  usageRecordSchema,
  auditShareForCredentials,
  findCredentials
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

describe("session share contract", () => {
  const share = {
    schema_version: 1 as const,
    harness_id: "claude-code" as const,
    session_fingerprint: "a".repeat(64),
    title: "Fix the failing build",
    visibility: "unlisted" as const,
    redaction_level: "balanced" as const,
    redaction: {
      secrets_removed: 2,
      paths_rewritten: 5,
      blocks_truncated: 0,
      turns_excluded: 1
    },
    started_at: "2026-08-01T10:00:00Z",
    ended_at: "2026-08-01T10:20:00Z",
    model_ids: ["claude-opus-5"],
    totals: { input_tokens: 120, output_tokens: 40, total_tokens: 170 },
    turns: [
      { index: 0, role: "user" as const, blocks: [{ kind: "text" as const, text: "why is it red" }] },
      {
        index: 1,
        role: "assistant" as const,
        blocks: [
          { kind: "thinking" as const, text: "read the log" },
          { kind: "tool_use" as const, name: "Bash", input: "{\"command\":\"npm test\"}" },
          { kind: "tool_result" as const, ok: false, output: "1 failing", truncated: true },
          { kind: "omitted" as const, reason: "image" as const }
        ]
      }
    ]
  };

  test("accepts a complete redacted transcript", () => {
    expect(sessionShareSchema.safeParse(share).success).toBe(true);
  });

  // The block vocabulary is closed on purpose: content the viewer cannot
  // render is content nobody reviewed before it was published.
  test("rejects unknown block kinds and extra block fields", () => {
    expect(sessionShareSchema.safeParse({
      ...share,
      turns: [{ index: 0, role: "user", blocks: [{ kind: "attachment", data: "…" }] }]
    }).success).toBe(false);
    expect(sessionShareSchema.safeParse({
      ...share,
      turns: [{ index: 0, role: "user", blocks: [{ kind: "text", text: "hi", path: "/Users/dana" }] }]
    }).success).toBe(false);
  });

  test("rejects unknown top-level fields", () => {
    expect(sessionShareSchema.safeParse({ ...share, cwd: "/Users/dana/work" }).success).toBe(false);
  });

  test("requires contiguous turn indexes", () => {
    expect(sessionShareSchema.safeParse({
      ...share,
      turns: [{ index: 4, role: "user", blocks: [{ kind: "text", text: "hi" }] }]
    }).success).toBe(false);
  });

  test("rejects a session that ends before it starts", () => {
    expect(sessionShareSchema.safeParse({
      ...share,
      started_at: "2026-08-01T10:20:00Z",
      ended_at: "2026-08-01T10:00:00Z"
    }).success).toBe(false);
  });

  test("requires cost basis whenever a cost is reported", () => {
    expect(sessionShareSchema.safeParse({
      ...share,
      totals: { ...share.totals, estimated_cost_micros: 1200 }
    }).success).toBe(false);
  });

  test("only accepts the three redaction levels and three visibilities", () => {
    expect(sessionShareSchema.safeParse({ ...share, redaction_level: "none" }).success).toBe(false);
    expect(sessionShareSchema.safeParse({ ...share, visibility: "everyone" }).success).toBe(false);
  });
});

describe("server-side credential audit", () => {
  test("finds credentials the collector should already have removed", () => {
    const withSecret = {
      schema_version: 1 as const,
      harness_id: "codex" as const,
      session_fingerprint: "b".repeat(64),
      title: "Deploy",
      visibility: "unlisted" as const,
      redaction_level: "full" as const,
      redaction: { secrets_removed: 0, paths_rewritten: 0, blocks_truncated: 0, turns_excluded: 0 },
      started_at: "2026-08-01T10:00:00Z",
      ended_at: "2026-08-01T10:01:00Z",
      model_ids: [],
      totals: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      turns: [{
        index: 0,
        role: "assistant" as const,
        blocks: [{
          kind: "tool_result" as const,
          ok: true,
          output: "DATABASE_URL=postgresql://owner:hunter2hunter2@db.example.com/app\nAKIAIOSFODNN7EXAMPLE"
        }]
      }]
    };
    const parsed = sessionShareSchema.parse(withSecret);
    expect(auditShareForCredentials(parsed)).toEqual(["aws-access-key", "url-password"]);
  });

  test("stays quiet on an ordinary transcript", () => {
    expect(findCredentials("edited <project>/src/main.ts and ran npm test")).toEqual([]);
    expect(findCredentials("Cookie: [redacted:header]\nPASSWORD=[redacted:assignment]")).toEqual([]);
    expect(findCredentials("Cookie: [redacted:header]\nPASSWORD=still-live")).toContain("assigned-secret");
  });

  test("finds logging-style sensitive keys, headers, and current token prefixes", () => {
    expect(findCredentials('password="cat"')).toContain("assigned-secret");
    expect(findCredentials("Cookie: session=private")).toContain("sensitive-header");
    expect(findCredentials("Authorization: ApiKey keep-this-secret")).toContain("sensitive-header");
    expect(findCredentials("redis://:shortsecret@cache.example.com/0")).toContain("url-password");
    expect(findCredentials("postgresql://owner:p@ssword@db.example.com/app")).toContain("url-password");
    expect(findCredentials("glpat-abcdefghijklmnopqrst")).toContain("gitlab-token");
    expect(findCredentials("AGE-SECRET-KEY-1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ")).toContain("age-secret-key");
  });

  test("covers stable developer-token formats from the upstream rule corpus", () => {
    const samples = [
      "dapi" + "a1".repeat(16),
      "SK" + "a1".repeat(16),
      "sk_test_abcdefghijklmnop1234",
      "xapp-1-ABCDEFGHIJ-1234567890-abcdefghijklmnop",
      "https://hooks.slack.com/services/" + "A".repeat(43),
      "dop_v1_" + "a1".repeat(32),
      "sntryu_" + "a1".repeat(32),
      "rubygems_" + "a1".repeat(24),
      "pypi-AgEIcHlwaS5vcmc" + "a".repeat(49) + "-",
      "hf_" + "a".repeat(34),
      "pul-" + "a1".repeat(20),
      "PMAK-" + "a1".repeat(12) + "-" + "b2".repeat(17),
      "lin_api_" + "a1".repeat(20),
      "glc_" + "a".repeat(32),
      "sq0csp-" + "a".repeat(42) + "-",
      "a1".repeat(7) + ".atlasv1." + "b".repeat(59) + "=",
      "A3-ABCDEF-ABCDEFGHIJK-ABCDE-ABCDE-ABCDE"
    ];
    for (const sample of samples) expect(findCredentials(sample)).not.toEqual([]);
  });

  test("covers established sensitive assignment aliases", () => {
    for (const sample of ["creds=shortsecret", "otp=123456", "two_factor=123456"]) {
      expect(findCredentials(sample)).toContain("assigned-secret");
    }
  });

  test("does not reject ordinary session, cookie, or authentication settings", () => {
    expect(findCredentials("session_timeout=30")).toEqual([]);
    expect(findCredentials("cookie_domain=.example.com")).toEqual([]);
    expect(findCredentials("authentication_mode=oauth")).toEqual([]);
    expect(findCredentials("oidc_token_endpoint=https://example.com/oauth/token")).toEqual([]);
    expect(findCredentials("public_token=example-value")).toEqual([]);
    expect(findCredentials("client_secret_name=production-secret")).toEqual([]);
    expect(findCredentials("credentials_id=credential-record-123")).toEqual([]);
  });

  test("handles a maximum-size ordinary string without pathological backtracking", () => {
    expect(findCredentials("A".repeat(120_000))).toEqual([]);
    expect(findCredentials("a=".repeat(60_000))).toEqual([]);
  });

  test("scans metadata and identifier fields, not only transcript bodies", () => {
    const parsed = sessionShareSchema.parse({
      schema_version: 1 as const,
      harness_id: "codex" as const,
      session_fingerprint: "c".repeat(64),
      title: "Cookie: session=private",
      visibility: "unlisted" as const,
      redaction_level: "balanced" as const,
      redaction: { secrets_removed: 0, paths_rewritten: 0, blocks_truncated: 0, turns_excluded: 0 },
      started_at: "2026-08-01T10:00:00Z",
      ended_at: "2026-08-01T10:01:00Z",
      model_ids: ["glpat-abcdefghijklmnopqrst"],
      totals: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      turns: [{ index: 0, role: "assistant" as const, blocks: [{ kind: "text" as const, text: "safe" }] }]
    });
    expect(auditShareForCredentials(parsed)).toEqual(["assigned-secret", "gitlab-token", "sensitive-header"]);
  });
});
