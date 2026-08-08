import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  actOnFriendship,
  approveDeviceCode,
  completeOnboardingProfile,
  createAccount,
  createDeviceCode,
  exchangeDeviceCode,
  findOrCreateOAuthUser,
  findFriendCandidate,
  getFriendComparison,
  getProfile,
  getProfileIdentity,
  ingestBatch,
  listFriendships,
  pool,
  registerDevice,
  removeFriendship,
  searchPublicProfiles,
  sendFriendRequest,
  updateProfile,
  usageExport
} from "./index";

const suffix = randomUUID().slice(0, 8);
const handle = `integration-${suffix}`;
let userId = "";
const oauthUserIds: string[] = [];
const friendshipUserIds: string[] = [];

afterAll(async () => {
  if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  if (oauthUserIds.length) await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [oauthUserIds]);
  if (friendshipUserIds.length) await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [friendshipUserIds]);
  await pool.end();
});

describe("mutual friend comparisons", () => {
  test("enforces request direction, blocking, mutual sharing, and metric intersections", async () => {
    const alice = await createAccount({
      email: `alice-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `alice-${suffix}`,
      displayName: "Alice Trace",
      timezone: "UTC"
    });
    const bob = await createAccount({
      email: `bob-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `bob-${suffix}`,
      displayName: "Bob Trace",
      timezone: "UTC"
    });
    const charlie = await createAccount({
      email: `charlie-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `charlie-${suffix}`,
      displayName: "Charlie Trace",
      timezone: "UTC"
    });
    friendshipUserIds.push(alice.id, bob.id, charlie.id);

    expect(await findFriendCandidate(alice.id, `alice-${suffix}`)).toBeNull();
    expect(await findFriendCandidate(alice.id, `missing-${suffix}`)).toBeNull();

    const request = await sendFriendRequest(alice.id, `bob-${suffix}`);
    expect(request.status).toBe("created");
    if (request.status !== "created") throw new Error("friend request was not created");
    expect((await sendFriendRequest(alice.id, `bob-${suffix}`)).status).toBe("exists");

    const alicePending = await listFriendships(alice.id);
    const bobPending = await listFriendships(bob.id);
    expect(alicePending.outgoing[0]?.other.handle).toBe(`bob-${suffix}`);
    expect(bobPending.incoming[0]?.other.handle).toBe(`alice-${suffix}`);
    expect(await actOnFriendship(charlie.id, request.id, "accept")).toBe(false);
    expect(await actOnFriendship(bob.id, request.id, "accept")).toBe(true);

    const accepted = await listFriendships(alice.id);
    expect(accepted.friends[0]?.canCompare).toBe(false);
    const disabled = await getFriendComparison(alice.id, request.id, 30);
    expect(disabled?.status).toBe("sharing_disabled");

    await updateProfile(alice.id, { friends_can_compare: true });
    await updateProfile(bob.id, { friends_can_compare: true });
    await pool.query(
      `INSERT INTO daily_usage (
        user_id, local_date, harness_id, model_id, total_tokens, event_count
       ) VALUES
        ($1, current_date, 'codex', 'gpt-5.6-sol', 1200, 1),
        ($1, current_date - 1, 'codex', 'gpt-5.6-sol', 800, 1),
        ($2, current_date, 'claude-code', 'claude-opus-4.1', 900, 1)`,
      [alice.id, bob.id]
    );

    const comparison = await getFriendComparison(alice.id, request.id, 7);
    expect(comparison?.status).toBe("ready");
    if (!comparison || comparison.status !== "ready") throw new Error("comparison was not ready");
    expect(comparison.windowDays).toBe(7);
    expect(comparison.people[0].summary.totalTokens).toBe(2000);
    expect(comparison.people[1].summary.totalTokens).toBe(900);
		expect(comparison.people[0].activity).toHaveLength(7);
		expect(comparison.visibility).toEqual({ tokens: true, harnesses: true, models: true, streaks: true });
    expect(comparison.people[0].harnesses).toEqual({ codex: 1 });
    expect(comparison.people[0].models).toEqual({ "gpt-5.6-sol": 1 });

    await updateProfile(bob.id, { show_tokens: false });
    const hiddenTokens = await getFriendComparison(alice.id, request.id, 7);
    expect(hiddenTokens?.status).toBe("ready");
    if (!hiddenTokens || hiddenTokens.status !== "ready") throw new Error("hidden-token comparison was not ready");
    expect(hiddenTokens.visibility.tokens).toBe(false);
    expect(hiddenTokens.people[0].summary.totalTokens).toBeNull();
    expect(hiddenTokens.people[0].harnesses).toEqual({ codex: 1 });
    expect(hiddenTokens.people[0].models).toEqual({ "gpt-5.6-sol": 1 });

		await updateProfile(bob.id, { show_models: false });
    const redacted = await getFriendComparison(alice.id, request.id, 7);
    expect(redacted?.status).toBe("ready");
    if (!redacted || redacted.status !== "ready") throw new Error("redacted comparison was not ready");
    expect(redacted.visibility.models).toBe(false);
    expect(redacted.people[0].models).toEqual({});
    expect(redacted.people[1].models).toEqual({});

    const exported = await usageExport(alice.id);
    expect(exported.friendships.friends[0]?.other.handle).toBe(`bob-${suffix}`);

    const blockedRequest = await sendFriendRequest(charlie.id, `bob-${suffix}`);
    expect(blockedRequest.status).toBe("created");
    if (blockedRequest.status !== "created") throw new Error("blocked request was not created");
    expect(await actOnFriendship(bob.id, blockedRequest.id, "block")).toBe(true);
    expect((await listFriendships(bob.id)).blocked[0]?.other.handle).toBe(`charlie-${suffix}`);
    expect((await listFriendships(charlie.id)).incoming).toHaveLength(0);
    expect((await listFriendships(charlie.id)).outgoing).toHaveLength(0);
    expect(await findFriendCandidate(charlie.id, `bob-${suffix}`)).toBeNull();
    expect(await actOnFriendship(charlie.id, blockedRequest.id, "unblock")).toBe(false);
    expect(await actOnFriendship(bob.id, blockedRequest.id, "unblock")).toBe(true);

    expect(await removeFriendship(alice.id, request.id)).toBe(true);
    expect((await listFriendships(alice.id)).friends).toHaveLength(0);
  });
});

describe("ingestion and public profile boundaries", () => {
  test("searches only public profiles while exposing private identity by exact route", async () => {
    const publicUser = await createAccount({
      email: `public-search-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `public-maker-${suffix}`,
      displayName: "Visible Maker",
      timezone: "UTC"
    });
    const privateUser = await createAccount({
      email: `private-search-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `private-maker-${suffix}`,
      displayName: "Hidden Maker",
      timezone: "UTC"
    });
    friendshipUserIds.push(publicUser.id, privateUser.id);
    await updateProfile(publicUser.id, { is_public: true });

    expect(await searchPublicProfiles(`maker-${suffix}`)).toEqual([
      { handle: `public-maker-${suffix}`, displayName: "Visible Maker" }
    ]);
    expect(await searchPublicProfiles("Visible Mak")).toHaveLength(1);
    expect(await searchPublicProfiles("Hidden Mak")).toEqual([]);

    expect(await getProfileIdentity(`private-maker-${suffix}`)).toEqual({
      handle: `private-maker-${suffix}`,
      displayName: "Hidden Maker",
      isPublic: false
    });
    expect(await getProfile(`private-maker-${suffix}`, publicUser.id)).toBeNull();
    expect(await getProfile(`private-maker-${suffix}`, privateUser.id)).not.toBeNull();
  });

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

    const unknownEventId = `unknown-${randomUUID()}`;
    const unknownRecord = {
      ...record,
      event_id: unknownEventId,
      model_id: undefined,
      input_tokens: 40,
      output_tokens: 10,
      total_tokens: 50,
      estimated_cost_micros: undefined,
      cost_basis: undefined
    };
    const unknown = await ingestBatch(
      { id: device!.deviceId, user_id: userId },
      { ...batch, batch_id: randomUUID(), records: [unknownRecord] }
    );
    expect(unknown.accepted).toBe(1);

    const enriched = await ingestBatch(
      { id: device!.deviceId, user_id: userId },
      {
        ...batch,
        batch_id: randomUUID(),
        records: [{ ...unknownRecord, model_id: "gpt-5.6-sol" }]
      }
    );
    expect(enriched.accepted).toBe(0);
    expect(enriched.duplicate).toBe(1);

    const enrichedEvent = await pool.query(
      "SELECT model_id FROM usage_events WHERE user_id = $1 AND event_id = $2",
      [userId, unknownEventId]
    );
    expect(enrichedEvent.rows[0].model_id).toBe("gpt-5.6-sol");

    const modelTotals = await pool.query(
      `SELECT model_id, total_tokens::int AS total, event_count
       FROM daily_usage WHERE user_id = $1 ORDER BY model_id`,
      [userId]
    );
    expect(modelTotals.rows).toEqual([
      { model_id: "gpt-5.6-sol", total: 50, event_count: 1 },
      { model_id: "hidden-model", total: 125, event_count: 1 }
    ]);
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
