import { z } from "zod";

export const harnessIds = ["codex", "claude-code", "opencode", "kimi-code", "synthetic"] as const;
export const costBases = ["reported", "price-table", "unavailable"] as const;
export const reservedHandles = [
  "about",
  "account",
  "activate",
  "admin",
  "agentprint",
  "api",
  "app",
  "auth",
  "billing",
  "blog",
  "dashboard",
  "docs",
  "explore",
  "friends",
  "help",
  "install",
  "login",
  "logout",
  "me",
  "onboarding",
  "pricing",
  "privacy",
  "profile",
  "profiles",
  "register",
  "releases",
  "s",
  "search",
  "session",
  "sessions",
  "settings",
  "share",
  "shares",
  "status",
  "support",
  "terms",
  "u",
  "v1",
  "www"
] as const;

const reservedHandleSet = new Set<string>(reservedHandles);

export function isReservedHandle(handle: string) {
  return reservedHandleSet.has(handle);
}

export const usageRecordSchema = z.object({
  event_id: z.string().min(16).max(128),
  schema_version: z.literal(1),
  occurred_at: z.iso.datetime({ offset: true }),
  local_date: z.iso.date(),
  harness_id: z.enum(harnessIds),
  harness_version: z.string().max(80).optional(),
  provider_id: z.string().max(80).optional(),
  model_id: z.string().max(120).optional(),
  input_tokens: z.int().nonnegative(),
  output_tokens: z.int().nonnegative(),
  cached_input_tokens: z.int().nonnegative().optional(),
  reasoning_tokens: z.int().nonnegative().optional(),
  total_tokens: z.int().nonnegative(),
  estimated_cost_micros: z.int().nonnegative().optional(),
  cost_basis: z.enum(costBases).optional(),
  source_fingerprint: z.string().min(16).max(128)
}).strict().superRefine((record, context) => {
  const minimum = record.input_tokens + record.output_tokens;
  if (record.total_tokens < minimum) {
    context.addIssue({
      code: "custom",
      path: ["total_tokens"],
      message: "total_tokens cannot be less than input_tokens + output_tokens"
    });
  }
  if (record.estimated_cost_micros !== undefined && !record.cost_basis) {
    context.addIssue({
      code: "custom",
      path: ["cost_basis"],
      message: "cost_basis is required when estimated cost is present"
    });
  }
});

export const syncBatchSchema = z.object({
  batch_id: z.uuid(),
  schema_version: z.literal(1),
  timezone: z.string().min(1).max(100),
  records: z.array(usageRecordSchema).min(1).max(2_000)
}).strict();

export const profilePatchSchema = z.object({
  display_name: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(180).optional(),
  timezone: z.string().min(1).max(100).optional(),
  is_public: z.boolean().optional(),
  show_tokens: z.boolean().optional(),
  show_cost: z.boolean().optional(),
  show_harnesses: z.boolean().optional(),
  show_models: z.boolean().optional(),
  show_streaks: z.boolean().optional(),
  friends_can_compare: z.boolean().optional()
}).strict();

export const friendRequestSchema = z.object({
  handle: z.string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/)
}).strict();

export const friendshipActionSchema = z.object({
  action: z.enum(["accept", "decline", "block", "unblock"])
}).strict();

export const friendshipIdSchema = z.uuid();

export const publicProfileSearchSchema = z.object({
  q: z.string().trim().min(2).max(80)
}).strict();

export const onboardingProfileSchema = z.object({
  handle: z.string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/)
    .refine((handle) => !isReservedHandle(handle), "That profile address is reserved."),
  display_name: z.string().trim().min(1).max(80),
  timezone: z.string().min(1).max(100)
}).strict();

/*
 * Session sharing contract.
 *
 * The usage pipeline above is metadata-only and structurally cannot carry
 * content. Session sharing is the separate, per-session, explicitly consented
 * pipeline that does carry content. It keeps the same discipline in a harder
 * place: the block vocabulary is closed, every payload is size-bounded, and
 * the server refuses anything it does not recognise.
 */

export const shareVisibilities = ["unlisted", "public", "friends"] as const;
export const redactionLevels = ["strict", "balanced", "full"] as const;
export const omissionReasons = [
  "image",
  "attachment",
  "excluded",
  "oversize",
  "redaction_level"
] as const;

const blockText = 120_000;

// Tool arguments arrive pre-serialised rather than as free-form JSON. Arbitrary
// JSON is unbounded, unscannable, and impossible to redact reliably; a string
// is exactly what the viewer renders and exactly what the redactor inspected.
export const transcriptBlockSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    text: z.string().max(blockText),
    truncated: z.boolean().optional()
  }).strict(),
  z.object({
    kind: z.literal("thinking"),
    text: z.string().max(blockText),
    truncated: z.boolean().optional()
  }).strict(),
  z.object({
    kind: z.literal("tool_use"),
    id: z.string().max(200).optional(),
    name: z.string().max(120),
    input: z.string().max(blockText),
    truncated: z.boolean().optional()
  }).strict(),
  z.object({
    kind: z.literal("tool_result"),
    tool_use_id: z.string().max(200).optional(),
    ok: z.boolean(),
    output: z.string().max(blockText),
    truncated: z.boolean().optional()
  }).strict(),
  z.object({
    kind: z.literal("omitted"),
    reason: z.enum(omissionReasons)
  }).strict()
]);

export const transcriptTurnSchema = z.object({
  index: z.int().nonnegative(),
  role: z.enum(["user", "assistant", "system"]),
  at: z.iso.datetime({ offset: true }).optional(),
  model_id: z.string().max(120).optional(),
  blocks: z.array(transcriptBlockSchema).max(400)
}).strict();

export const sessionShareSchema = z.object({
  schema_version: z.literal(1),
  harness_id: z.enum(harnessIds),
  harness_version: z.string().max(80).optional(),
  session_fingerprint: z.string().min(16).max(128),
  title: z.string().trim().min(1).max(140),
  summary: z.string().trim().max(400).optional(),
  visibility: z.enum(shareVisibilities),
  redaction_level: z.enum(redactionLevels),
  redaction: z.object({
    secrets_removed: z.int().nonnegative(),
    paths_rewritten: z.int().nonnegative(),
    blocks_truncated: z.int().nonnegative(),
    turns_excluded: z.int().nonnegative()
  }).strict(),
  started_at: z.iso.datetime({ offset: true }),
  ended_at: z.iso.datetime({ offset: true }),
  model_ids: z.array(z.string().max(120)).max(24),
  totals: z.object({
    input_tokens: z.int().nonnegative(),
    output_tokens: z.int().nonnegative(),
    cached_input_tokens: z.int().nonnegative().optional(),
    reasoning_tokens: z.int().nonnegative().optional(),
    total_tokens: z.int().nonnegative(),
    estimated_cost_micros: z.int().nonnegative().optional(),
    cost_basis: z.enum(costBases).optional()
  }).strict(),
  expires_at: z.iso.datetime({ offset: true }).nullish(),
  turns: z.array(transcriptTurnSchema).min(1).max(4_000)
}).strict().superRefine((share, context) => {
  if (Date.parse(share.ended_at) < Date.parse(share.started_at)) {
    context.addIssue({
      code: "custom",
      path: ["ended_at"],
      message: "ended_at cannot precede started_at"
    });
  }
  if (share.totals.estimated_cost_micros !== undefined && !share.totals.cost_basis) {
    context.addIssue({
      code: "custom",
      path: ["totals", "cost_basis"],
      message: "cost_basis is required when estimated cost is present"
    });
  }
  share.turns.forEach((turn, position) => {
    if (turn.index !== position) {
      context.addIssue({
        code: "custom",
        path: ["turns", position, "index"],
        message: "turn indexes must be contiguous and start at zero"
      });
    }
  });
});

export const sharePatchSchema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  visibility: z.enum(shareVisibilities).optional(),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional()
}).strict();

/*
 * Second line of defence. The collector redacts before anything is uploaded;
 * this runs server-side so a modified or third-party client cannot publish
 * obvious credentials through the API. It is deliberately conservative: it
 * looks only for shapes that are credentials and nothing else.
 */
const credentialPatterns: Array<[string, RegExp]> = [
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{16,}/],
  ["openai-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/],
  ["github-token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/],
  ["github-pat", /\bgithub_pat_[A-Za-z0-9_]{40,}/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["google-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ["stripe-key", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/],
  ["npm-token", /\bnpm_[A-Za-z0-9]{36}\b/],
  ["private-key", /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/],
  // Credentials embedded in a connection string, e.g. postgresql://u:pw@host.
  ["url-password", /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/]
];

export function findCredentials(value: string) {
  const hits: string[] = [];
  for (const [name, pattern] of credentialPatterns) {
    if (pattern.test(value)) hits.push(name);
  }
  return hits;
}

export function auditShareForCredentials(share: SessionShare) {
  const found = new Set<string>();
  for (const turn of share.turns) {
    for (const block of turn.blocks) {
      const value =
        block.kind === "text" || block.kind === "thinking"
          ? block.text
          : block.kind === "tool_use"
            ? `${block.name} ${block.input}`
            : block.kind === "tool_result"
              ? block.output
              : "";
      if (value) for (const hit of findCredentials(value)) found.add(hit);
    }
  }
  return [...found].sort();
}

export type UsageRecord = z.infer<typeof usageRecordSchema>;
export type SyncBatch = z.infer<typeof syncBatchSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;
export type FriendRequest = z.infer<typeof friendRequestSchema>;
export type FriendshipAction = z.infer<typeof friendshipActionSchema>;
export type PublicProfileSearch = z.infer<typeof publicProfileSearchSchema>;
export type TranscriptBlock = z.infer<typeof transcriptBlockSchema>;
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;
export type SessionShare = z.infer<typeof sessionShareSchema>;
export type SharePatch = z.infer<typeof sharePatchSchema>;
export type ShareVisibility = (typeof shareVisibilities)[number];
export type RedactionLevel = (typeof redactionLevels)[number];
