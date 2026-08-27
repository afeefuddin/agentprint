import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  actOnFriendship,
  authenticateDevice,
  approveDeviceCode,
  completeOnboardingProfile,
  createAccount,
  createDeviceCode,
  createSessionShareUpload,
  deleteProfileAvatar,
  deleteStaleSessionShareUploads,
  exchangeDeviceCode,
  failSessionShareUpload,
  findOrCreateOAuthUser,
  findFriendCandidate,
  getFriendComparison,
  getProfile,
  getProfileAvatar,
  getProfileAvatarForUser,
  getProfileIdentity,
  getSharedSession,
  ingestBatch,
  beginSessionShareUploadProcessing,
  getSessionShareUploadForOwner,
  getSessionShareUploadStatusForOwner,
  listFriendships,
  listLegacyProfileAvatars,
  listPublicShares,
  listSessionShareAttempts,
  markSessionShareUploadQueued,
  pool,
  publishShare,
  publishSessionShareUpload,
  registerDevice,
  replaceProfileAvatarObjectKey,
  removeFriendship,
  revokeShare,
  searchPublicProfiles,
  sendFriendRequest,
  updateProfile,
  updateProfileAvatar,
  updateShare,
  usageExport
} from "./index";

const suffix = randomUUID().slice(0, 8);
const handle = `integration-${suffix}`;
let userId = "";
const oauthUserIds: string[] = [];
const friendshipUserIds: string[] = [];
const shareUserIds: string[] = [];

afterAll(async () => {
  if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  if (oauthUserIds.length) await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [oauthUserIds]);
  if (friendshipUserIds.length) await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [friendshipUserIds]);
  if (shareUserIds.length) await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [shareUserIds]);
  await pool.end();
});

describe("friend comparisons", () => {
  test("enforces accepted friendships, blocking, and metric intersections", async () => {
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
    expect(accepted.friends).toHaveLength(1);
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
    const objectKey = `uploadthing-${suffix}-avatar-key`;
    expect(await updateProfileAvatar(userId, "image/png", objectKey)).toEqual({
      updatedAt: expect.any(Date),
      previousObjectKey: null
    });
    expect(await getProfileAvatar(handle)).toBeNull();
    const avatar = await getProfileAvatar(handle, userId);
    expect(avatar?.content_type).toBe("image/png");
    expect(avatar?.object_key).toBe(objectKey);
    expect(avatar?.image_data).toBeNull();
    expect(await getProfileAvatarForUser(userId)).toEqual({ object_key: objectKey });
    expect((await listLegacyProfileAvatars()).some((row) => row.user_id === userId)).toBe(true);
    const spacesKey = `profile-avatars/v1/${userId}/${suffix}.png`;
    expect(await replaceProfileAvatarObjectKey(userId, objectKey, spacesKey)).toBe(true);
    expect(await getProfileAvatarForUser(userId)).toEqual({ object_key: spacesKey });
    const concurrentKeys = [
      `profile-avatars/v1/${userId}/${suffix}-a.png`,
      `profile-avatars/v1/${userId}/${suffix}-b.png`
    ];
    const replacements = await Promise.all(
      concurrentKeys.map((key) => updateProfileAvatar(userId, "image/png", key))
    );
    const finalKey = (await getProfileAvatarForUser(userId))?.object_key;
    expect(concurrentKeys).toContain(finalKey);
    expect(replacements.map((replacement) => replacement.previousObjectKey)).toContain(spacesKey);
    expect(replacements.map((replacement) => replacement.previousObjectKey)).toContain(
      concurrentKeys.find((key) => key !== finalKey)
    );
    expect((await getProfile(handle, userId))?.profile.avatar_updated_at).toBeInstanceOf(Date);
    expect(await deleteProfileAvatar(userId, spacesKey)).toBe(false);
    expect(await deleteProfileAvatar(userId, finalKey ?? null)).toBe(true);
    expect(await getProfileAvatar(handle, userId)).toBeNull();

    await updateProfile(userId, {
      is_public: true,
      show_tokens: false,
      show_cost: true,
      show_harnesses: false,
      show_models: false,
      show_streaks: false
    });
    const retiredPreference = await pool.query(
      "SELECT show_cost FROM profiles WHERE user_id = $1",
      [userId]
    );
    expect(retiredPreference.rows[0].show_cost).toBe(false);

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
    expect(device?.handle).toBe(handle);
    expect(device?.onboardingComplete).toBe(true);
    const authenticatedDevice = await authenticateDevice(`Bearer ${device!.credential}`);
    expect(authenticatedDevice?.handle).toBe(handle);

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
      `SELECT total_tokens::int AS total, estimated_cost_micros::int AS legacy_cost
       FROM daily_usage WHERE user_id = $1`,
      [userId]
    );
    expect(aggregate.rows[0].total).toBe(125);
    expect(aggregate.rows[0].legacy_cost).toBe(0);

    const stored = await pool.query(
      `SELECT estimated_cost_micros, cost_basis
       FROM usage_events WHERE user_id = $1 AND event_id = $2`,
      [userId, eventId]
    );
    expect(stored.rows[0]).toEqual({ estimated_cost_micros: null, cost_basis: null });

    const publicProfile = await getProfile(handle);
    expect(publicProfile?.profile).not.toHaveProperty("id");
    expect(publicProfile?.profile).not.toHaveProperty("email");
    expect(publicProfile?.profile).not.toHaveProperty("onboarding_complete");
    expect(publicProfile?.summary.totalTokens).toBe(0);
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
    expect(second).toEqual({
      id: first.id,
      created: false,
      handle: first.handle,
      onboardingComplete: false
    });
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
      `SELECT handle, display_name, onboarding_complete, onboarding_completed_at
       FROM profiles WHERE user_id = $1`,
      [first.id]
    );
    expect(completed.rows[0]).toMatchObject({
      handle: `github-${suffix}`,
      display_name: "GitHub Test",
      onboarding_complete: true
    });
    expect(completed.rows[0].onboarding_completed_at).toBeInstanceOf(Date);
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

    expect(linked).toEqual({
      id: existing.id,
      created: false,
      handle: `linked-${suffix}`,
      onboardingComplete: true
    });
    const completed = await pool.query(
      "SELECT onboarding_completed_at FROM profiles WHERE user_id = $1",
      [existing.id]
    );
    expect(completed.rows[0].onboarding_completed_at).toBeInstanceOf(Date);
  });
});

describe("session sharing", () => {
  function transcript(overrides: Record<string, unknown> = {}) {
    return {
      schema_version: 1 as const,
      harness_id: "claude-code" as const,
      harness_version: "2.1.0",
      session_fingerprint: `fingerprint-${suffix}-0000000000`,
      title: "Fix the failing build",
      visibility: "unlisted" as const,
      redaction_level: "balanced" as const,
      redaction: { secrets_removed: 3, paths_rewritten: 7, blocks_truncated: 1, turns_excluded: 2 },
      started_at: "2026-08-01T10:00:00Z",
      ended_at: "2026-08-01T10:30:00Z",
      model_ids: ["claude-opus-5"],
      totals: { input_tokens: 120, output_tokens: 40, total_tokens: 170 },
      turns: [
        { index: 0, role: "user" as const, blocks: [{ kind: "text" as const, text: "why is it red" }] },
        {
          index: 1,
          role: "assistant" as const,
          blocks: [
            { kind: "thinking" as const, text: "read the log" },
            { kind: "tool_use" as const, name: "Bash", input: "{}" }
          ]
        }
      ],
      ...overrides
    };
  }

  test("reserves bounded uploads and records their processing lifecycle", async () => {
    const owner = await createAccount({
      email: `uploader-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `uploader-${suffix}`,
      displayName: "Uploader Trace",
      timezone: "UTC"
    });
    shareUserIds.push(owner.id);
    const device = await pool.query<{ id: string }>(
      `INSERT INTO devices (user_id, name, platform, agent_version)
       VALUES ($1, 'Upload test', 'test/arm64', '0.1.0') RETURNING id`,
      [owner.id]
    );
    const upload = await createSessionShareUpload({
      userId: owner.id,
      deviceId: device.rows[0].id,
      contentLength: 4096,
      contentSha256: "a".repeat(64),
      displayTitle: "Pending upload",
      harnessId: "claude-code"
    });
    if (!upload) throw new Error("expected an upload reservation");
    expect(upload.object_key).toContain(`/` + upload.id + ".json.gz");
    expect(upload.status).toBe("created");
    expect(upload.display_title).toBe("Pending upload");
    expect(await getSessionShareUploadForOwner(upload.id, randomUUID())).toBeNull();
    expect((await listSessionShareAttempts(owner.id)).map((attempt) => attempt.id)).toContain(upload.id);

    await pool.query(
      "UPDATE session_share_uploads SET expires_at = now() + interval '1 minute' WHERE id = $1",
      [upload.id]
    );
    await markSessionShareUploadQueued(upload.id, "run-test");
    const queued = await getSessionShareUploadForOwner(upload.id, owner.id);
    expect(queued?.expires_at.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
    const processing = await beginSessionShareUploadProcessing(upload.id);
    expect(processing?.status).toBe("processing");
    expect(processing?.trigger_run_id).toBe("run-test");

    const published = await publishSessionShareUpload(
      upload.id,
      transcript({ session_fingerprint: `fingerprint-upload-${suffix}` })
    );
    await failSessionShareUpload(upload.id, "processing_failed");
    const complete = await getSessionShareUploadForOwner(upload.id, owner.id);
    expect(complete?.status).toBe("published");
    expect(complete?.share_id).toBe(published.id);
    const status = await getSessionShareUploadStatusForOwner(upload.id, owner.id);
    expect(status?.share_slug).toBe(published.slug);
    expect((await listSessionShareAttempts(owner.id)).map((attempt) => attempt.id)).not.toContain(upload.id);

    const abandoned = await createSessionShareUpload({
      userId: owner.id,
      deviceId: device.rows[0].id,
      contentLength: 4096,
      contentSha256: "b".repeat(64)
    });
    if (!abandoned) throw new Error("expected an abandoned upload reservation");
    await markSessionShareUploadQueued(abandoned.id, "run-abandoned");
    await pool.query(
      "UPDATE session_share_uploads SET expires_at = now() - interval '1 second' WHERE id = $1",
      [abandoned.id]
    );
    const expiredAttempt = (await listSessionShareAttempts(owner.id)).find(
      (attempt) => attempt.id === abandoned.id
    );
    expect(expiredAttempt?.status).toBe("failed");
    expect(expiredAttempt?.failure_code).toBe("upload_expired");
    await pool.query(
      "UPDATE session_share_uploads SET expires_at = now() - interval '8 days' WHERE id = $1",
      [abandoned.id]
    );
    expect(await deleteStaleSessionShareUploads()).toBeGreaterThanOrEqual(1);
    expect(await getSessionShareUploadForOwner(abandoned.id, owner.id)).toBeNull();
  });

  test("persists the maximum transcript in one database operation", async () => {
    const owner = await createAccount({
      email: `bulk-sharer-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `bulk-sharer-${suffix}`,
      displayName: "Bulk Sharer",
      timezone: "UTC"
    });
    shareUserIds.push(owner.id);
    const turns = Array.from({ length: 4_000 }, (_, index) => ({
      index,
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      blocks: [{ kind: "text" as const, text: `Turn ${index}` }]
    }));

    const published = await publishShare(
      { userId: owner.id },
      transcript({
        session_fingerprint: `fingerprint-bulk-${suffix}`,
        turns
      })
    );
    const stored = await pool.query<{ count: string; first_index: number; last_index: number }>(
      `SELECT count(*)::text AS count, min(index) AS first_index, max(index) AS last_index
       FROM shared_session_turns WHERE share_id = $1`,
      [published.id]
    );
    expect(stored.rows[0]).toEqual({ count: "4000", first_index: 0, last_index: 3999 });
  });

  test("publishes, reads back, changes visibility, and hard-deletes on revoke", async () => {
    const owner = await createAccount({
      email: `sharer-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `sharer-${suffix}`,
      displayName: "Sharer Trace",
      timezone: "UTC"
    });
    shareUserIds.push(owner.id);
    const stranger = await createAccount({
      email: `stranger-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `stranger-${suffix}`,
      displayName: "Stranger Trace",
      timezone: "UTC"
    });
    shareUserIds.push(stranger.id);

    const published = await publishShare(
      { userId: owner.id },
      transcript({
        totals: {
          input_tokens: 120,
          output_tokens: 40,
          total_tokens: 170,
          estimated_cost_micros: 1200,
          cost_basis: "reported"
        }
      })
    );
    expect(published.replaced).toBe(false);
    expect(published.slug).toMatch(/^[A-Za-z0-9]{16,32}$/);
    const retiredCost = await pool.query(
      `SELECT estimated_cost_micros, cost_basis
       FROM shared_sessions WHERE id = $1`,
      [published.id]
    );
    expect(retiredCost.rows[0]).toEqual({ estimated_cost_micros: null, cost_basis: null });

    const view = await getSharedSession(published.slug, undefined);
    expect(view?.title).toBe("Fix the failing build");
    expect(view?.turns).toHaveLength(2);
    expect(view?.turn_count).toBe(2);
    expect(view?.redaction_stats).toEqual({
      secrets_removed: 3,
      paths_rewritten: 7,
      blocks_truncated: 1,
      turns_excluded: 2
    });
    // Blocks must survive the round trip exactly; the viewer renders them.
    expect(view?.turns[1].blocks).toEqual([
      { kind: "thinking", text: "read the log" },
      { kind: "tool_use", name: "Bash", input: "{}" }
    ]);

    // Unlisted shares are reachable by link but never listed on a profile.
    expect(await listPublicShares(owner.id)).toHaveLength(0);
    await updateShare(owner.id, published.id, { visibility: "public" });
    expect(await listPublicShares(owner.id)).toHaveLength(1);

    // A friends-only share is invisible to a stranger and to signed-out readers.
    await updateShare(owner.id, published.id, { visibility: "friends" });
    expect(await getSharedSession(published.slug, undefined)).toBeNull();
    expect(await getSharedSession(published.slug, stranger.id)).toBeNull();
    expect(await getSharedSession(published.slug, owner.id)).not.toBeNull();

    // Another account cannot edit or delete someone else's share.
    expect(await updateShare(stranger.id, published.id, { visibility: "public" })).toBeNull();
    expect(await revokeShare(stranger.id, published.id)).toBe(false);

    expect(await revokeShare(owner.id, published.id)).toBe(true);
    expect(await getSharedSession(published.slug, owner.id)).toBeNull();
    const orphans = await pool.query(
      "SELECT count(*)::int AS count FROM shared_session_turns WHERE share_id = $1",
      [published.id]
    );
    expect(orphans.rows[0].count).toBe(0);
  });

  test("re-sharing the same session replaces it in place and keeps the link", async () => {
    const owner = await createAccount({
      email: `resharer-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `resharer-${suffix}`,
      displayName: "Resharer Trace",
      timezone: "UTC"
    });
    shareUserIds.push(owner.id);
    const fingerprint = `fingerprint-reshare-${suffix}`;
    const first = await publishShare({ userId: owner.id }, transcript({ session_fingerprint: fingerprint }));
    const second = await publishShare(
      { userId: owner.id },
      transcript({
        session_fingerprint: fingerprint,
        title: "Fix the failing build, continued",
        turns: [{ index: 0, role: "user" as const, blocks: [{ kind: "text" as const, text: "one more thing" }] }]
      })
    );
    expect(second.replaced).toBe(true);
    expect(second.slug).toBe(first.slug);
    const view = await getSharedSession(first.slug, owner.id);
    expect(view?.title).toBe("Fix the failing build, continued");
    // The old turns must be gone, not merged with the new ones.
    expect(view?.turns).toHaveLength(1);
    expect(view?.turn_count).toBe(1);
  });

  test("expired shares stop resolving", async () => {
    const owner = await createAccount({
      email: `expirer-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `expirer-${suffix}`,
      displayName: "Expirer Trace",
      timezone: "UTC"
    });
    shareUserIds.push(owner.id);
    const share = await publishShare(
      { userId: owner.id },
      transcript({
        session_fingerprint: `fingerprint-expiry-${suffix}`,
        expires_at: "2020-01-01T00:00:00Z"
      })
    );
    expect(await getSharedSession(share.slug, owner.id)).toBeNull();
  });

  test("shared sessions are included in the account export", async () => {
    const owner = await createAccount({
      email: `exporter-${suffix}@example.com`,
      password: "a-strong-test-password",
      handle: `exporter-${suffix}`,
      displayName: "Exporter Trace",
      timezone: "UTC"
    });
    shareUserIds.push(owner.id);
    await publishShare(
      { userId: owner.id },
      transcript({ session_fingerprint: `fingerprint-export-${suffix}` })
    );
    const exported = await usageExport(owner.id);
    expect(exported.sharedSessions).toHaveLength(1);
    expect(exported.sharedSessions[0].turns).toHaveLength(2);
  });
});
