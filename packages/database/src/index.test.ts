import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  approveDeviceCode,
  completeOnboardingProfile,
  createAccount,
  createDeviceCode,
  exchangeDeviceCode,
  findOrCreateOAuthUser,
  getProfile,
  ingestBatch,
  pool,
  registerDevice,
  updateProfile
} from "./index";

const suffix = randomUUID().slice(0, 8);
const handle = `integration-${suffix}`;
let userId = "";
const oauthUserIds: string[] = [];

afterAll(async () => {
  if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  if (oauthUserIds.length) await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [oauthUserIds]);
  await pool.end();
});

describe("ingestion and public profile boundaries", () => {
  test("is idempotent and redacts hidden metrics at the query boundary", async () => {
    const user = await createAccount({
      email: `${handle}@example.com`,
      password: "a-strong-test-password",
      handle,
      displayName: "Integration Test",
      timezone: "UTC"
    });
    userId = user.id;
    await updateProfile(userId, {
      is_public: true,
      show_tokens: false,
      show_cost: false,
      show_harnesses: false,
      show_models: false,
      show_streaks: false
    });

    const code = await createDeviceCode("integration test");
    expect(await approveDeviceCode(code.userCode, userId)).toBe(true);
    const token = await exchangeDeviceCode(code.deviceCode);
    expect(token.status).toBe("approved");
    if (token.status !== "approved") throw new Error("Device code was not approved");
    const device = await registerDevice({
      registrationToken: token.registrationToken,
      name: "Test device",
      platform: "test/arm64",
      agentVersion: "0.1.0",
      signingPublicKey: Buffer.alloc(32, 1).toString("base64"),
      sources: [{ harnessId: "codex" }]
    });
    expect(device).not.toBeNull();

    const eventId = `stable-${randomUUID()}`;
    const record = {
      event_id: eventId,
      schema_version: 1 as const,
      occurred_at: "2026-07-29T09:30:00Z",
      local_date: "2026-07-29",
      harness_id: "codex" as const,
      model_id: "hidden-model",
      input_tokens: 100,
      output_tokens: 25,
      total_tokens: 125,
      estimated_cost_micros: 500,
      cost_basis: "price-table" as const,
      source_fingerprint: "integration-source-fingerprint"
    };
    const batch = {
      batch_id: randomUUID(),
      schema_version: 1 as const,
      timezone: "UTC",
      records: [record]
    };
    const first = await ingestBatch({ id: device!.deviceId, user_id: userId }, batch);
    const replay = await ingestBatch({ id: device!.deviceId, user_id: userId }, batch);
    const duplicate = await ingestBatch(
      { id: device!.deviceId, user_id: userId },
      { ...batch, batch_id: randomUUID() }
    );
    expect(first.accepted).toBe(1);
    expect(replay.replay).toBe(true);
    expect(duplicate.duplicate).toBe(1);

    const aggregate = await pool.query(
      "SELECT total_tokens::int AS total FROM daily_usage WHERE user_id = $1",
      [userId]
    );
    expect(aggregate.rows[0].total).toBe(125);

    const publicProfile = await getProfile(handle);
    expect(publicProfile?.summary.totalTokens).toBe(0);
    expect(publicProfile?.summary.estimatedCostMicros).toBe(0);
    expect(publicProfile?.summary.currentStreak).toBe(0);
    expect(publicProfile?.harnesses).toEqual({});
    expect(publicProfile?.models).toEqual({});
    expect(publicProfile?.activity[0].tokens).not.toBe(125);

    const ownerProfile = await getProfile(handle, userId);
    expect(ownerProfile?.summary.totalTokens).toBe(125);
    expect(ownerProfile?.models).toEqual({ "hidden-model": 125 });
  });
});

describe("OAuth authentication", () => {
  test("creates one private account and reuses it by durable GitHub id", async () => {
    const accountId = randomUUID();
    const first = await findOrCreateOAuthUser({
      provider: "github",
      accountId,
      email: `github-${suffix}@example.com`
    });
    oauthUserIds.push(first.id);
    const second = await findOrCreateOAuthUser({
      provider: "github",
      accountId,
      email: `changed-${suffix}@example.com`
    });

    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, created: false, onboardingComplete: false });
    const profile = await pool.query(
      "SELECT is_public, onboarding_complete FROM profiles WHERE user_id = $1",
      [first.id]
    );
    expect(profile.rows[0].is_public).toBe(false);
    expect(profile.rows[0].onboarding_complete).toBe(false);

    await completeOnboardingProfile(first.id, {
      display_name: "GitHub Test",
      handle: `github-${suffix}`,
      timezone: "UTC"
    });
    const completed = await pool.query(
      "SELECT handle, display_name, onboarding_complete FROM profiles WHERE user_id = $1",
      [first.id]
    );
    expect(completed.rows[0]).toEqual({
      handle: `github-${suffix}`,
      display_name: "GitHub Test",
      onboarding_complete: true
    });
  });

  test("links GitHub to an existing email account", async () => {
    const existing = await createAccount({
      email: `linked-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `linked-${suffix}`,
      displayName: "Linked Test",
      timezone: "UTC"
    });
    oauthUserIds.push(existing.id);
    const linked = await findOrCreateOAuthUser({
      provider: "google",
      accountId: randomUUID(),
      email: `linked-${suffix}@example.com`
    });

    expect(linked).toEqual({ id: existing.id, created: false, onboardingComplete: true });
  });
});
