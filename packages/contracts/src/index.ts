import { z } from "zod";

export const harnessIds = ["codex", "claude-code", "opencode", "kimi-code", "synthetic"] as const;
// Retained only so already-installed collectors can finish syncing old queued
// records. Active clients no longer send cost data and the server ignores it.
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
  // Deprecated compatibility input from pre-removal web bundles.
  show_cost: z.boolean().optional(),
  show_harnesses: z.boolean().optional(),
  show_models: z.boolean().optional(),
  show_streaks: z.boolean().optional()
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
 * obvious credentials through the API. Like established telemetry scrubbers,
 * it combines high-confidence provider formats with sensitive key/header
 * contexts instead of filtering ordinary prose.
 */
const credentialPatterns: Array<[string, RegExp]> = [
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{16,}/],
  ["openai-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/],
  ["github-token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/],
  ["github-pat", /\bgithub_pat_[A-Za-z0-9_]{40,}/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["google-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ["slack-app-token", /\bxapp-\d-[A-Z0-9]+-\d+-[A-Z0-9]+\b/i],
  ["slack-config-token", /\bxoxe(?:\.xox[bp])?-\d-[A-Z0-9]{100,}\b/i],
  ["slack-webhook", /https?:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9+/]{43,56}/],
  ["stripe-key", /\b(?:sk|rk)_(?:test|live|prod)_[A-Za-z0-9]{10,99}\b/],
  ["npm-token", /\bnpm_[A-Za-z0-9]{36}\b/],
  ["private-key", /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY(?: BLOCK)?-----/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["gitlab-token", /\bgl(?:pat|oas|dt|rt|rtr|cbt|ptt|ft|imt|agent|wt|soat|ffct)-[A-Za-z0-9_-]{8,}\b/],
  ["onepassword-service-token", /\bops_eyJ[A-Za-z0-9+/=_-]{20,}\b/],
  ["onepassword-secret-key", /\bA3-[A-Z0-9]{6}-(?:[A-Z0-9]{11}|[A-Z0-9]{6}-[A-Z0-9]{5})-(?:[A-Z0-9]{5}-){2}[A-Z0-9]{5}\b/],
  ["age-secret-key", /\bAGE-SECRET-KEY-1[0-9A-Z]{20,}\b/],
  ["databricks-token", /\bdapi[a-f0-9]{32}(?:-\d)?\b/],
  ["twilio-key", /\bSK[0-9A-Fa-f]{32}\b/],
  ["digitalocean-token", /\bdo[por]_v1_[a-f0-9]{64}\b/],
  ["sentry-token", /\b(?:sntryu_[a-f0-9]{64}|sntrys_eyJ[A-Za-z0-9+/=_-]{80,})/],
  ["rubygems-token", /\brubygems_[a-f0-9]{48}\b/],
  ["pypi-token", /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}/],
  ["huggingface-token", /\b(?:hf_|api_org_)[A-Za-z]{34}\b/],
  ["pulumi-token", /\bpul-[a-f0-9]{40}\b/],
  ["postman-token", /\bPMAK-[A-Fa-f0-9]{24}-[A-Fa-f0-9]{34}\b/],
  ["linear-token", /\blin_api_[A-Za-z0-9]{40}\b/],
  ["grafana-token", /\b(?:glc_[A-Za-z0-9+/]{32,400}={0,3}|glsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8})/],
  ["square-token", /\b(?:EAAA|sq0atp-)[A-Za-z0-9_-]{22,}|\bsq0csp-[A-Za-z0-9_-]{43,}/],
  ["terraform-token", /\b[a-z0-9]{14}\.atlasv1\.[A-Za-z0-9_=.-]{60,}/]
];

const sensitiveAssignmentKey = /^(?:[A-Z0-9_.-]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|CREDENTIALS?|CREDS|PRIVATE[_-]?KEY|ACCESS[_-]?KEY|CREDIT[_-]?CARD)[A-Z0-9_.-]*|(?:[A-Z0-9]+[_.-])*(?:(?:SESSION|COOKIE)(?:[_.-](?:ID|KEY|TOKEN|SECRET|VALUE))?|AUTH(?:ORIZATION)?(?:[_.-](?:ID|KEY|TOKEN|SECRET|CREDENTIAL))?|OTP|TWO[_-]?FACTOR)|(?:SESSION|COOKIE|AUTH)(?:ID|KEY|TOKEN|SECRET|VALUE|ORIZATION|CREDENTIAL))$/i;
const safeAssignmentKey = /^(?:[A-Z0-9]+[_.-])*(?:PUBLIC[_.-]TOKEN|TOKEN[_.-](?:ENDPOINT|URL|URI|FILE)|SECRET[_.-](?:LENGTH|NAME|SIZE)|CREDENTIALS?[_.-](?:ID|URL|URI))$/i;
const sensitiveArgument = /--?(?:api[-_]?key|secret|token|password|passwd|pwd|credential|access[-_]?key|private[-_]?key|session|cookie|auth(?:orization)?)(?:=|[ \t]+)(?:"[^"]*"|'[^']*'|\S+)/i;
const sensitiveHeader = /\b(?:(?:proxy-)?authorization[ \t]*:[ \t]*\S[^\r\n]*|x-(?:api[-_]?key|auth[-_]?token)[ \t]*:[ \t]*\S[^\r\n]*|(?:set-)?cookie[ \t]*:[ \t]*\S[^\r\n]*)/i;
const opaqueToken = /[A-Za-z0-9+/=_-]{40,}/g;
const hexOnly = /^[0-9a-f]+$/i;

export function findCredentials(value: string) {
  const hits = new Set<string>();
  for (const [name, pattern] of credentialPatterns) {
    if (pattern.test(value)) hits.add(name);
  }
  if (hasUrlPassword(value)) hits.add("url-password");
  if (hasUnredactedAssignment(value) || hasUnredactedMatch(sensitiveArgument, value)) hits.add("assigned-secret");
  if (hasUnredactedMatch(sensitiveHeader, value)) hits.add("sensitive-header");
  for (const match of value.matchAll(opaqueToken)) {
    if (looksLikeSecret(match[0])) hits.add("high-entropy");
  }
  return [...hits].sort();
}

function hasUrlPassword(value: string) {
  let searchFrom = 0;
  while (searchFrom < value.length) {
    const schemeEnd = value.indexOf("://", searchFrom);
    if (schemeEnd < 0) return false;
    let schemeStart = schemeEnd;
    while (schemeStart > 0 && isSchemeCharacter(value[schemeStart - 1])) schemeStart--;
    const scheme = value.slice(schemeStart, schemeEnd);
    if (scheme.length > 0 && isAsciiLetter(scheme[0])) {
      const authorityStart = schemeEnd + 3;
      let authorityEnd = authorityStart;
      while (authorityEnd < value.length && !"/\\?# \t\r\n".includes(value[authorityEnd])) authorityEnd++;
      const at = value.lastIndexOf("@", authorityEnd - 1);
      if (at >= authorityStart) {
        const colon = value.indexOf(":", authorityStart);
        if (colon >= authorityStart && colon < at - 1) return true;
      }
    }
    searchFrom = schemeEnd + 3;
  }
  return false;
}

function isSchemeCharacter(character: string) {
  return isAsciiLetter(character) || character >= "0" && character <= "9" || "+.-".includes(character);
}

function isAsciiLetter(character: string) {
  return character >= "A" && character <= "Z" || character >= "a" && character <= "z";
}

function hasUnredactedMatch(pattern: RegExp, value: string) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...value.matchAll(new RegExp(pattern.source, flags))].some((match) => !match[0].includes("[redacted:"));
}

function hasUnredactedAssignment(value: string) {
  for (let delimiter = 0; delimiter < value.length; delimiter++) {
    if (value[delimiter] !== ":" && value[delimiter] !== "=") continue;
    let keyEnd = delimiter;
    while (keyEnd > 0 && (value[keyEnd - 1] === " " || value[keyEnd - 1] === "\t")) keyEnd--;
    let quote = "";
    if (keyEnd > 0 && (value[keyEnd - 1] === "'" || value[keyEnd - 1] === '"')) {
      quote = value[keyEnd - 1];
      keyEnd--;
    }
    let keyStart = keyEnd;
    while (keyStart > 0 && isAssignmentKeyCharacter(value[keyStart - 1]) && keyEnd - keyStart < 100) keyStart--;
    if (keyStart === keyEnd || (keyStart > 0 && isAssignmentKeyCharacter(value[keyStart - 1]))) continue;
    if (quote && (keyStart === 0 || value[keyStart - 1] !== quote)) continue;
    const key = value.slice(keyStart, keyEnd);
    if (!sensitiveAssignmentKey.test(key) || safeAssignmentKey.test(key)) continue;
    let valueStart = delimiter + 1;
    while (valueStart < value.length && (value[valueStart] === " " || value[valueStart] === "\t")) valueStart++;
    if (valueStart === value.length) continue;
    if (!value.startsWith("[redacted:", valueStart)) return true;
  }
  return false;
}

function isAssignmentKeyCharacter(character: string) {
  return character >= "A" && character <= "Z" ||
    character >= "a" && character <= "z" ||
    character >= "0" && character <= "9" ||
    character === "_" || character === "." || character === "-";
}

export function auditShareForCredentials(share: SessionShare) {
  const found = new Set<string>();
  const inspect = (value: string | undefined) => {
    if (value) for (const hit of findCredentials(value)) found.add(hit);
  };
  inspect(share.harness_version);
  inspect(share.title);
  inspect(share.summary);
  for (const modelID of share.model_ids) inspect(modelID);
  for (const turn of share.turns) {
    inspect(turn.model_id);
    for (const block of turn.blocks) {
      if (block.kind === "text" || block.kind === "thinking") {
        inspect(block.text);
      } else if (block.kind === "tool_use") {
        inspect(block.id);
        inspect(block.name);
        inspect(block.input);
      } else if (block.kind === "tool_result") {
        inspect(block.tool_use_id);
        inspect(block.output);
      }
    }
  }
  return [...found].sort();
}

export function auditSharePatchForCredentials(patch: SharePatch) {
  return patch.title ? findCredentials(patch.title) : [];
}

function looksLikeSecret(value: string) {
  if (value.startsWith("[redacted:") || hexOnly.test(value)) return false;
  let upper = 0;
  let lower = 0;
  let digit = 0;
  let separators = 0;
  const counts = new Map<string, number>();
  for (const character of value) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
    if (character >= "A" && character <= "Z") upper++;
    else if (character >= "a" && character <= "z") lower++;
    else if (character >= "0" && character <= "9") digit++;
    else separators++;
  }
  if (upper === 0 || lower === 0 || digit === 0 || separators > 2) return false;
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy >= 4.2;
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
