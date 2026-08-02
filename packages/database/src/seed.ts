import { createHash, randomUUID } from "node:crypto";
import { createAccount, hashSecret, ingestBatch, pool } from "./index";

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
    show_cost = true,
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
      estimated_cost_micros: Math.floor(total * 9.4),
      cost_basis: "price-table" as const,
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

await pool.end();
console.log("Seeded demo@agentprint.dev / agentprint-demo");
