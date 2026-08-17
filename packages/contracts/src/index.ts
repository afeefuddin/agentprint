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
  "search",
  "settings",
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

export type UsageRecord = z.infer<typeof usageRecordSchema>;
export type SyncBatch = z.infer<typeof syncBatchSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;
export type FriendRequest = z.infer<typeof friendRequestSchema>;
export type FriendshipAction = z.infer<typeof friendshipActionSchema>;
export type PublicProfileSearch = z.infer<typeof publicProfileSearchSchema>;
