import { createHash, randomUUID } from "node:crypto";
import { createAccount, hashSecret, ingestBatch, pool, publishShare } from "./index";

const existing = await pool.query(
  "SELECT u.id FROM users u WHERE u.email = 'demo@agentprint.dev'"
);

let userId = existing.rows[0]?.id as string | undefined;
if (!userId) {
  userId = (await createAccount({
    email: "demo@agentprint.dev",
    password: "agentprint-demo",
    handle: "maya-builds",
    displayName: "Maya Chen",
    timezone: "America/Los_Angeles"
  })).id;
}

await pool.query(
  `UPDATE profiles SET
    bio = 'Building reliable systems with agents, one trace at a time.',
    is_public = true,
    published_at = COALESCE(published_at, now())
   WHERE user_id = $1`,
  [userId]
);

let device = await pool.query(
  "SELECT id FROM devices WHERE user_id = $1 LIMIT 1",
  [userId]
);
if (!device.rows[0]) {
  device = await pool.query(
    `INSERT INTO devices (user_id, name, platform, agent_version, last_seen_at)
     VALUES ($1, 'Maya’s MacBook Pro', 'darwin/arm64', '0.1.0', now())
     RETURNING id`,
    [userId]
  );
  await pool.query(
    `INSERT INTO device_credentials (device_id, credential_hash)
     VALUES ($1, $2)`,
    [device.rows[0].id, hashSecret("demo-device-credential")]
  );
  for (const source of ["codex", "claude-code", "opencode"]) {
    await pool.query(
      "INSERT INTO device_sources (device_id, harness_id) VALUES ($1, $2)",
      [device.rows[0].id, source]
    );
  }
}

const count = await pool.query(
  "SELECT count(*)::int AS count FROM usage_events WHERE user_id = $1",
  [userId]
);

if (count.rows[0].count === 0) {
  const records = [];
  const harnesses = ["codex", "claude-code", "opencode"] as const;
  const models = ["gpt-5.4", "claude-opus-4.1", "gpt-5.3-codex"];
  for (let ago = 364; ago >= 0; ago -= 1) {
    const wave = Math.sin(ago / 14) * 0.25 + 0.52;
    const active = ((ago * 17 + 11) % 13) / 13 < wave;
    if (!active) continue;
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - ago);
    const harness = harnesses[(ago * 7) % harnesses.length];
    const total = 18_000 + ((ago * 83_117) % 480_000);
    const occurredAt = new Date(`${date.toISOString().slice(0, 10)}T18:30:00.000Z`);
    const stable = `${date.toISOString().slice(0, 10)}:${harness}`;
    records.push({
      event_id: createHash("sha256").update(stable).digest("hex"),
      schema_version: 1 as const,
      occurred_at: occurredAt.toISOString(),
      local_date: date.toISOString().slice(0, 10),
      harness_id: harness,
      provider_id: harness === "claude-code" ? "anthropic" : "openai",
      model_id: models[ago % models.length],
      input_tokens: Math.floor(total * 0.72),
      output_tokens: Math.floor(total * 0.28),
      total_tokens: total,
      source_fingerprint: createHash("sha256").update(`demo:${harness}`).digest("hex")
    });
  }
  await ingestBatch(
    { id: device.rows[0].id, user_id: userId },
    {
      batch_id: randomUUID(),
      schema_version: 1,
      timezone: "America/Los_Angeles",
      records
    }
  );
}

// Friendly local comparison fixtures. These are deliberately distinct routing
// profiles so the comparison page has real shapes, brand colours, and logos to
// inspect instead of two nearly identical traces.
const localFriends = [
  {
    email: "ada@agentprint.dev",
    handle: "ada-automates",
    displayName: "Ada Byte ⚡",
    timezone: "Europe/London",
    bio: "Automating the boring parts and measuring what remains.",
    routes: [
      ["codex", "gpt-5.6-sol"],
      ["codex", "gpt-5.6-sol"],
      ["codex", "gpt-5.5"],
      ["claude-code", "claude-opus-4.1"],
      ["opencode", "qwen3-coder"]
    ]
  },
  {
    email: "noor@agentprint.dev",
    handle: "noor-ships",
    displayName: "Noor Ships 🚀",
    timezone: "Asia/Dubai",
    bio: "Fast feedback loops, small diffs, reliable releases.",
    routes: [
      ["claude-code", "claude-opus-4.1"],
      ["claude-code", "claude-opus-4.1"],
      ["claude-code", "claude-sonnet-4.5"],
      ["kimi-code", "kimi-k2.5"],
      ["codex", "gpt-5.4"]
    ]
  },
  {
    email: "priya@agentprint.dev",
    handle: "priya-pixels",
    displayName: "Priya Pixels ✨",
    timezone: "Asia/Kolkata",
    bio: "Polishing product edges with a small fleet of agents.",
    routes: [
      ["opencode", "qwen3-coder"],
      ["opencode", "qwen3-coder"],
      ["opencode", "glm-4.5"],
      ["codex", "gpt-5.5"],
      ["claude-code", "claude-sonnet-4.5"]
    ]
  }
] as const;

const localFriendIds: string[] = [];
for (const [friendIndex, friend] of localFriends.entries()) {
  const existingFriend = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [friend.email]
  );
  const friendId = existingFriend.rows[0]?.id ?? (await createAccount({
    email: friend.email,
    password: "agentprint-demo",
    handle: friend.handle,
    displayName: friend.displayName,
    timezone: friend.timezone
  })).id;
  localFriendIds.push(friendId);

  await pool.query(
    `UPDATE profiles SET bio = $2, is_public = true,
       published_at = COALESCE(published_at, now())
     WHERE user_id = $1`,
    [friendId, friend.bio]
  );

  const usage = await pool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM daily_usage WHERE user_id = $1",
    [friendId]
  );
  if (usage.rows[0].count === 0) {
    for (let ago = 89; ago >= 0; ago -= 1) {
      if ((ago * 11 + friendIndex * 7) % 10 < 3) continue;
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - ago);
      const [harness, model] = friend.routes[(ago * (friendIndex + 2) + friendIndex) % friend.routes.length];
      const total = 42_000 + ((ago * 71_113 + friendIndex * 193_337) % 620_000);
      await pool.query(
        `INSERT INTO daily_usage (
           user_id, local_date, harness_id, model_id, input_tokens,
           output_tokens, total_tokens, event_count
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
         ON CONFLICT (user_id, local_date, harness_id, model_id) DO NOTHING`,
        [
          friendId,
          date.toISOString().slice(0, 10),
          harness,
          model,
          Math.floor(total * 0.74),
          Math.floor(total * 0.26),
          total
        ]
      );
    }
  }
}

const localUser = await pool.query<{ user_id: string }>(
  "SELECT user_id FROM profiles WHERE handle = 'cool'"
);
if (localUser.rows[0]) {
  const usage = await pool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM daily_usage WHERE user_id = $1",
    [localUser.rows[0].user_id]
  );
  if (usage.rows[0].count === 0) {
    const routes = [
      ["codex", "gpt-5.6-sol"],
      ["codex", "gpt-5.5"],
      ["claude-code", "claude-opus-4.1"],
      ["kimi-code", "kimi-k2.5"],
      ["opencode", "qwen3-coder"]
    ] as const;
    for (let ago = 89; ago >= 0; ago -= 1) {
      if ((ago * 13 + 5) % 11 < 3) continue;
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - ago);
      const [harness, model] = routes[(ago * 3 + 1) % routes.length];
      const total = 58_000 + ((ago * 91_127 + 287_411) % 740_000);
      await pool.query(
        `INSERT INTO daily_usage (
           user_id, local_date, harness_id, model_id, input_tokens,
           output_tokens, total_tokens, event_count
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
         ON CONFLICT (user_id, local_date, harness_id, model_id) DO NOTHING`,
        [
          localUser.rows[0].user_id,
          date.toISOString().slice(0, 10),
          harness,
          model,
          Math.floor(total * 0.7),
          Math.floor(total * 0.3),
          total
        ]
      );
    }
  }
}

// Attach the fixtures to every real local profile, including the original Maya
// demo. Re-running the seed is safe and newly-created local accounts pick them
// up the next time the seed runs.
const localProfiles = await pool.query<{ user_id: string }>(
  `SELECT user_id FROM profiles
   WHERE onboarding_complete AND NOT (user_id = ANY($1::uuid[]))`,
  [localFriendIds]
);
for (const profile of localProfiles.rows) {
  for (const friendId of localFriendIds) {
    await pool.query(
      `INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
       VALUES ($1, $2, 'accepted', now())
       ON CONFLICT DO NOTHING`,
      [profile.user_id, friendId]
    );
  }
}

// One published session, so the shared-session viewer and the profile listing
// have something real to render locally. Its transcript is written the way the
// collector would emit it: already redacted, with the markers left visible.
await publishShare(
  { userId },
  {
    schema_version: 1,
    harness_id: "claude-code",
    harness_version: "2.1.0",
    session_fingerprint: createHash("sha256").update("demo:shared-session").digest("hex"),
    title: "Track down the flaky checkout test",
    summary: "Found a shared database fixture leaking between CI workers, fixed test isolation, and verified the checkout suite in serial and parallel.",
    visibility: "public",
    redaction_level: "balanced",
    redaction: { secrets_removed: 1, paths_rewritten: 6, blocks_truncated: 1, turns_excluded: 0 },
    started_at: "2026-08-14T16:02:00Z",
    ended_at: "2026-08-14T16:41:00Z",
    model_ids: ["claude-opus-4.1"],
    totals: {
      input_tokens: 184_320,
      output_tokens: 12_940,
      cached_input_tokens: 96_400,
      total_tokens: 293_660
    },
    turns: [
      {
        index: 0,
        role: "user",
        at: "2026-08-14T16:02:00Z",
        blocks: [{
          kind: "text",
          text: "The checkout test passes locally but fails on CI about one run in four. Can you find out why?"
        }]
      },
      {
        index: 1,
        role: "assistant",
        at: "2026-08-14T16:02:24Z",
        model_id: "claude-opus-4.1",
        blocks: [
          { kind: "thinking", text: "One run in four suggests ordering or timing rather than logic. I should look at how the test seeds its fixtures before assuming a race." },
          { kind: "text", text: "An intermittent quarter-of-the-time failure usually means shared state, not a broken assertion. Let me read the test and its setup." },
          { kind: "tool_use", id: "t1", name: "Read", input: JSON.stringify({ file_path: "<project>/tests/checkout.spec.ts" }, null, 2) }
        ]
      },
      {
        index: 2,
        role: "user",
        at: "2026-08-14T16:02:31Z",
        blocks: [{
          kind: "tool_result",
          tool_use_id: "t1",
          ok: true,
          output: "beforeEach(async () => {\n  await seedCart({ items: 3 });\n});\n\ntest(\"applies the discount once\", async () => {\n  const total = await checkout();\n  expect(total).toBe(2700);\n});"
        }]
      },
      {
        index: 3,
        role: "assistant",
        at: "2026-08-14T16:03:02Z",
        model_id: "claude-opus-4.1",
        blocks: [
          { kind: "text", text: "`seedCart` writes to a shared table without clearing it first, so a cart left behind by an earlier test changes the total. That matches the intermittency: it only fails when the suite happens to run in an order that leaves rows behind." },
          { kind: "tool_use", id: "t2", name: "Bash", input: JSON.stringify({ command: "npm test -- --runInBand tests/checkout.spec.ts" }, null, 2) }
        ]
      },
      {
        index: 4,
        role: "user",
        at: "2026-08-14T16:04:10Z",
        blocks: [{
          kind: "tool_result",
          tool_use_id: "t2",
          ok: true,
          output: "PASS tests/checkout.spec.ts (12 runs, 0 failures)\n\nEnvironment:\n  DATABASE_URL=postgres://ci:[redacted:url-password]@localhost:5432/app_test",
          truncated: true
        }]
      },
      {
        index: 5,
        role: "assistant",
        at: "2026-08-14T16:04:38Z",
        model_id: "claude-opus-4.1",
        blocks: [
          { kind: "text", text: "The serial run is clean, which strengthens the shared-state diagnosis. I’ll inspect the fixture helper, make the cleanup explicit, then rerun with parallel workers." },
          { kind: "tool_use", id: "t3", name: "Read", input: JSON.stringify({ file_path: "<project>/tests/helpers/seed-cart.ts" }, null, 2) }
        ]
      },
      {
        index: 6,
        role: "user",
        at: "2026-08-14T16:04:45Z",
        blocks: [{
          kind: "tool_result",
          tool_use_id: "t3",
          ok: true,
          output: "export async function seedCart(input) {\n  await db.cartItems.insertMany(input.items);\n}\n"
        }]
      },
      {
        index: 7,
        role: "assistant",
        at: "2026-08-14T16:06:10Z",
        model_id: "claude-opus-4.1",
        blocks: [
          { kind: "text", text: "There’s the leak: the helper only inserts. I added scoped cleanup before seeding so every test starts from the same state." },
          { kind: "tool_use", id: "t4", name: "Bash", input: JSON.stringify({ command: "npm test -- tests/checkout.spec.ts --workers=4 --repeat-each=20" }, null, 2) }
        ]
      },
      {
        index: 8,
        role: "user",
        at: "2026-08-14T16:40:40Z",
        blocks: [{
          kind: "tool_result",
          tool_use_id: "t4",
          ok: true,
          output: "80 passed (4 workers)\n0 failed\nFinished in 34.2s"
        }]
      },
      {
        index: 9,
        role: "assistant",
        at: "2026-08-14T16:41:00Z",
        model_id: "claude-opus-4.1",
        blocks: [{
          kind: "text",
          text: "Fixed. `seedCart` now clears the current test cart before inserting fixtures, so worker order can’t change the total. The checkout spec passed 80 parallel runs with zero failures."
        }]
      }
    ]
  }
);

await pool.end();
console.log("Seeded demo@agentprint.dev plus 3 local comparison friends");
