import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync
} from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { calculateStreaks, intensityFor, intensityThresholds } from "@agentprint/analytics";
import type {
  OnboardingProfile,
  ProfilePatch,
  RedactionLevel,
  SessionShare,
  SharePatch,
  ShareVisibility,
  SyncBatch,
  TranscriptBlock
} from "@agentprint/contracts";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://agentprint:agentprint@localhost:54329/agentprint";

export const pool = new Pool({ connectionString: databaseUrl, max: 10 });

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const result = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${result}`;
}

export function opaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

async function one<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
  client: Pool | PoolClient = pool
) {
  const result = await client.query<T>(text, values);
  return result.rows[0] ?? null;
}

export async function createAccount(input: {
  email: string;
  password: string;
  handle: string;
  displayName: string;
  timezone: string;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await one<{ id: string }>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2) RETURNING id`,
      [input.email, hashPassword(input.password)],
      client
    );
    await client.query(
      `INSERT INTO profiles (user_id, handle, display_name, timezone)
       VALUES ($1, $2, $3, $4)`,
      [user!.id, input.handle, input.displayName, input.timezone]
    );
    await client.query("COMMIT");
    return user!;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findOrCreateOAuthUser(input: {
  provider: "github" | "google";
  accountId: string;
  email: string;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const identity = await one<{ user_id: string; handle: string; onboarding_complete: boolean }>(
      `SELECT oa.user_id, p.handle, p.onboarding_complete
       FROM oauth_accounts oa JOIN profiles p ON p.user_id = oa.user_id
       WHERE oa.provider = $1 AND oa.provider_account_id = $2`,
      [input.provider, input.accountId],
      client
    );
    if (identity) {
      await client.query("COMMIT");
      return {
        id: identity.user_id,
        created: false,
        handle: identity.handle,
        onboardingComplete: identity.onboarding_complete
      };
    }

    const email = input.email.toLowerCase();
    const existing = await one<{ id: string; handle: string; onboarding_complete: boolean }>(
      `SELECT u.id, p.handle, p.onboarding_complete
       FROM users u JOIN profiles p ON p.user_id = u.id
       WHERE u.email = $1 FOR UPDATE OF u`,
      [email],
      client
    );
    if (existing) {
      await client.query(
        `INSERT INTO oauth_accounts (provider, provider_account_id, user_id)
         VALUES ($1, $2, $3)`,
        [input.provider, input.accountId, existing.id]
      );
      await client.query("COMMIT");
      return {
        id: existing.id,
        created: false,
        handle: existing.handle,
        onboardingComplete: existing.onboarding_complete
      };
    }

    const user = await one<{ id: string }>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2) RETURNING id`,
      [email, hashPassword(opaqueToken())],
      client
    );
    const placeholderHandle = `pending-${input.provider}-${hashSecret(`${input.provider}:${input.accountId}`).slice(0, 12)}`;
    await client.query(
      `INSERT INTO profiles (user_id, handle, display_name, timezone, onboarding_complete)
       VALUES ($1, $2, 'New Agentprint user', 'UTC', false)`,
      [user!.id, placeholderHandle]
    );
    await client.query(
      `INSERT INTO oauth_accounts (provider, provider_account_id, user_id)
       VALUES ($1, $2, $3)`,
      [input.provider, input.accountId, user!.id]
    );
    await client.query("COMMIT");
    return { id: user!.id, created: true, handle: placeholderHandle, onboardingComplete: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createSession(userId: string) {
  const token = opaqueToken();
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '30 days')`,
    [userId, hashSecret(token)]
  );
  return token;
}

export async function deleteSession(token: string) {
  await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashSecret(token)]);
}

export type Viewer = {
  id: string;
  email: string;
  handle: string;
  display_name: string;
  bio: string;
  timezone: string;
  is_public: boolean;
  show_tokens: boolean;
  show_harnesses: boolean;
  show_models: boolean;
  show_streaks: boolean;
  onboarding_complete: boolean;
  created_at: Date;
};

export async function getViewer(token?: string) {
  if (!token) return null;
  return one<Viewer>(
    `SELECT u.id, u.email, u.created_at, p.handle, p.display_name, p.bio,
            p.timezone, p.is_public, p.show_tokens,
            p.show_harnesses, p.show_models, p.show_streaks,
            p.onboarding_complete
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN profiles p ON p.user_id = u.id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashSecret(token)]
  );
}

export async function createDeviceCode(clientName: string) {
  const deviceCode = opaqueToken();
  const userCode = Array.from({ length: 2 }, () =>
    randomBytes(3).toString("hex").toUpperCase()
  ).join("-");
  await pool.query(
    `INSERT INTO device_codes
      (device_code_hash, user_code, client_name, expires_at)
     VALUES ($1, $2, $3, now() + interval '10 minutes')`,
    [hashSecret(deviceCode), userCode, clientName]
  );
  return { deviceCode, userCode, expiresIn: 600, interval: 2 };
}

export async function getDeviceCode(userCode: string) {
  return one<{
    user_code: string;
    client_name: string;
    status: string;
    expires_at: Date;
  }>(
    `SELECT user_code, client_name, status, expires_at
     FROM device_codes WHERE user_code = $1`,
    [userCode.toUpperCase()]
  );
}

export async function approveDeviceCode(userCode: string, userId: string) {
  const result = await pool.query(
    `UPDATE device_codes SET user_id = $1, status = 'approved'
     WHERE user_code = $2 AND status = 'pending' AND expires_at > now()`,
    [userId, userCode.toUpperCase()]
  );
  return result.rowCount === 1;
}

export async function exchangeDeviceCode(deviceCode: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const code = await one<{ id: string; user_id: string; status: string }>(
      `SELECT id, user_id, status FROM device_codes
       WHERE device_code_hash = $1 AND expires_at > now() FOR UPDATE`,
      [hashSecret(deviceCode)],
      client
    );
    if (!code) return { status: "expired" as const };
    if (code.status !== "approved") return { status: code.status as "pending" | "denied" };
    const registrationToken = opaqueToken();
    await client.query(
      "UPDATE device_codes SET status = 'consumed' WHERE id = $1",
      [code.id]
    );
    await client.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '10 minutes')`,
      [code.user_id, hashSecret(`device-registration:${registrationToken}`)]
    );
    await client.query("COMMIT");
    return { status: "approved" as const, registrationToken };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function registerDevice(input: {
  registrationToken: string;
  name: string;
  platform: string;
  agentVersion: string;
  signingPublicKey: string;
  sources: { harnessId: string; version?: string }[];
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sessionHash = hashSecret(`device-registration:${input.registrationToken}`);
    const registration = await one<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM sessions
       WHERE token_hash = $1 AND expires_at > now() FOR UPDATE`,
      [sessionHash],
      client
    );
    if (!registration) return null;
    const device = await one<{ id: string }>(
      `INSERT INTO devices (user_id, name, platform, agent_version, last_seen_at)
       VALUES ($1, $2, $3, $4, now()) RETURNING id`,
      [registration.user_id, input.name, input.platform, input.agentVersion],
      client
    );
    const credential = opaqueToken();
    await client.query(
      `INSERT INTO device_credentials (device_id, credential_hash, signing_public_key)
       VALUES ($1, $2, $3)`,
      [device!.id, hashSecret(credential), input.signingPublicKey]
    );
    for (const source of input.sources) {
      await client.query(
        `INSERT INTO device_sources (device_id, harness_id, version)
         VALUES ($1, $2, $3)
         ON CONFLICT (device_id, harness_id)
         DO UPDATE SET version = excluded.version`,
        [device!.id, source.harnessId, source.version ?? null]
      );
    }
    await client.query("DELETE FROM sessions WHERE id = $1", [registration.id]);
    await client.query("COMMIT");
    return { deviceId: device!.id, credential };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function authenticateDevice(authorization?: string | null) {
  if (!authorization?.startsWith("Bearer ")) return null;
  return one<{ id: string; user_id: string; handle: string; paused: boolean; signing_public_key: string | null }>(
    `SELECT d.id, d.user_id, p.handle, d.paused, c.signing_public_key
     FROM device_credentials c
     JOIN devices d ON d.id = c.device_id
     JOIN profiles p ON p.user_id = d.user_id
     WHERE c.credential_hash = $1 AND d.revoked_at IS NULL`,
    [hashSecret(authorization.slice(7))]
  );
}

export async function revokeAuthenticatedDevice(deviceId: string) {
  await pool.query(
    "UPDATE devices SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
    [deviceId]
  );
}

export async function ingestBatch(
  device: { id: string; user_id: string },
  batch: SyncBatch
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await one<{
      id: string;
      accepted_count: number;
      duplicate_count: number;
      rejected_count: number;
    }>(
      `SELECT id, accepted_count, duplicate_count, rejected_count
       FROM sync_batches WHERE device_id = $1 AND batch_id = $2`,
      [device.id, batch.batch_id],
      client
    );
    if (existing) {
      await client.query("ROLLBACK");
      return {
        acknowledgement: existing.id,
        accepted: existing.accepted_count,
        duplicate: existing.duplicate_count,
        rejected: existing.rejected_count,
        replay: true
      };
    }

    let accepted = 0;
    let duplicate = 0;
    for (const record of batch.records) {
      const inserted = await one<{ id: string }>(
        `INSERT INTO usage_events (
          user_id, device_id, event_id, schema_version, occurred_at, local_date,
          harness_id, harness_version, provider_id, model_id, input_tokens,
          output_tokens, cached_input_tokens, reasoning_tokens, total_tokens,
          source_fingerprint
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
        ) ON CONFLICT (user_id, event_id) DO NOTHING RETURNING id`,
        [
          device.user_id, device.id, record.event_id, record.schema_version,
          record.occurred_at, record.local_date, record.harness_id,
          record.harness_version ?? null, record.provider_id ?? null,
          record.model_id ?? null, record.input_tokens, record.output_tokens,
          record.cached_input_tokens ?? null, record.reasoning_tokens ?? null,
          record.total_tokens, record.source_fingerprint
        ],
        client
      );
      if (!inserted) {
        duplicate += 1;
        if (record.model_id) {
          const enriched = await one<{
            local_date: string;
            harness_id: string;
            input_tokens: string;
            output_tokens: string;
            total_tokens: string;
          }>(
            `UPDATE usage_events
             SET model_id = $3
             WHERE user_id = $1 AND event_id = $2 AND model_id IS NULL
             RETURNING local_date::text, harness_id, input_tokens::text,
                       output_tokens::text, total_tokens::text`,
            [device.user_id, record.event_id, record.model_id],
            client
          );
          if (enriched) {
            const decremented = await client.query(
              `UPDATE daily_usage
               SET input_tokens = input_tokens - $4,
                   output_tokens = output_tokens - $5,
                   total_tokens = total_tokens - $6,
                   event_count = event_count - 1
               WHERE user_id = $1 AND local_date = $2 AND harness_id = $3
                 AND model_id = 'unknown'`,
              [
                device.user_id, enriched.local_date, enriched.harness_id,
                enriched.input_tokens, enriched.output_tokens, enriched.total_tokens
              ]
            );
            if (decremented.rowCount !== 1) {
              throw new Error("missing unknown model aggregate during event enrichment");
            }
            await client.query(
              `DELETE FROM daily_usage
               WHERE user_id = $1 AND local_date = $2 AND harness_id = $3
                 AND model_id = 'unknown' AND event_count = 0`,
              [device.user_id, enriched.local_date, enriched.harness_id]
            );
            await client.query(
              `INSERT INTO daily_usage (
                user_id, local_date, harness_id, model_id, input_tokens, output_tokens,
                total_tokens, event_count
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,1)
              ON CONFLICT (user_id, local_date, harness_id, model_id) DO UPDATE SET
                input_tokens = daily_usage.input_tokens + excluded.input_tokens,
                output_tokens = daily_usage.output_tokens + excluded.output_tokens,
                total_tokens = daily_usage.total_tokens + excluded.total_tokens,
                event_count = daily_usage.event_count + 1`,
              [
                device.user_id, enriched.local_date, enriched.harness_id, record.model_id,
                enriched.input_tokens, enriched.output_tokens, enriched.total_tokens
              ]
            );
          }
        }
        continue;
      }
      accepted += 1;
      await client.query(
        `INSERT INTO daily_usage (
          user_id, local_date, harness_id, model_id, input_tokens, output_tokens,
          total_tokens, event_count
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,1)
        ON CONFLICT (user_id, local_date, harness_id, model_id) DO UPDATE SET
          input_tokens = daily_usage.input_tokens + excluded.input_tokens,
          output_tokens = daily_usage.output_tokens + excluded.output_tokens,
          total_tokens = daily_usage.total_tokens + excluded.total_tokens,
          event_count = daily_usage.event_count + 1`,
        [
          device.user_id, record.local_date, record.harness_id,
          record.model_id ?? "unknown", record.input_tokens, record.output_tokens,
          record.total_tokens
        ]
      );
    }
    const receipt = await one<{ id: string }>(
      `INSERT INTO sync_batches (
        device_id, batch_id, accepted_count, duplicate_count, rejected_count
       ) VALUES ($1, $2, $3, $4, 0) RETURNING id`,
      [device.id, batch.batch_id, accepted, duplicate],
      client
    );
    await client.query(
      "UPDATE devices SET last_sync_at = now(), last_seen_at = now() WHERE id = $1",
      [device.id]
    );
    await client.query("COMMIT");
    return {
      acknowledgement: receipt!.id,
      accepted,
      duplicate,
      rejected: 0,
      replay: false
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getSyncBatch(deviceId: string, receiptId: string) {
  return one<{
    id: string;
    batch_id: string;
    accepted_count: number;
    duplicate_count: number;
    rejected_count: number;
    created_at: Date;
  }>(
    `SELECT id, batch_id, accepted_count, duplicate_count, rejected_count, created_at
     FROM sync_batches WHERE id = $1 AND device_id = $2`,
    [receiptId, deviceId]
  );
}

export async function listDevices(userId: string) {
  const result = await pool.query(
    `SELECT d.id, d.name, d.platform, d.agent_version, d.last_sync_at,
            d.last_seen_at, d.paused, d.revoked_at, d.created_at,
            COALESCE(json_agg(json_build_object(
              'harness_id', ds.harness_id,
              'status', ds.status,
              'version', ds.version,
              'last_collected_at', ds.last_collected_at
            ) ORDER BY ds.harness_id) FILTER (WHERE ds.harness_id IS NOT NULL), '[]') AS sources
     FROM devices d
     LEFT JOIN device_sources ds ON ds.device_id = d.id
     WHERE d.user_id = $1
     GROUP BY d.id ORDER BY d.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function revokeDevice(userId: string, deviceId: string) {
  const result = await pool.query(
    `UPDATE devices SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [deviceId, userId]
  );
  return result.rowCount === 1;
}

export async function updateProfile(userId: string, patch: ProfilePatch) {
  // Older web bundles may still submit this retired preference briefly after
  // deployment. Accept it at the wire boundary, but do not persist it.
  const entries = Object.entries(patch).filter(([key]) => key !== "show_cost");
  if (!entries.length) return;
  const columns = entries.map(
    ([key], index) => `${key} = $${index + 2}`
  );
  if (patch.is_public) columns.push("published_at = COALESCE(published_at, now())");
  columns.push("updated_at = now()");
  await pool.query(
    `UPDATE profiles SET ${columns.join(", ")} WHERE user_id = $1`,
    [userId, ...entries.map(([, value]) => value)]
  );
}

export async function completeOnboardingProfile(userId: string, profile: OnboardingProfile) {
  const result = await pool.query(
    `UPDATE profiles
     SET handle = $2, display_name = $3, timezone = $4,
         onboarding_complete = true, updated_at = now()
     WHERE user_id = $1 AND onboarding_complete = false`,
    [userId, profile.handle, profile.display_name, profile.timezone]
  );
  return result.rowCount === 1;
}

export async function isProfileHandleAvailable(userId: string, handle: string) {
  const result = await pool.query(
    `SELECT 1 FROM profiles
     WHERE handle = $1 AND user_id <> $2
     LIMIT 1`,
    [handle, userId]
  );
  return result.rowCount === 0;
}

export type FriendshipEntry = {
  id: string;
  status: "pending" | "accepted" | "blocked";
  direction: "incoming" | "outgoing" | "friend" | "blocked";
  createdAt: string;
  other: {
    handle: string;
    displayName: string;
  };
};

export type FriendshipList = {
  friends: FriendshipEntry[];
  incoming: FriendshipEntry[];
  outgoing: FriendshipEntry[];
  blocked: FriendshipEntry[];
};

export async function listFriendships(userId: string): Promise<FriendshipList> {
  const result = await pool.query<{
    id: string;
    status: "pending" | "accepted" | "blocked";
    requester_id: string;
    created_at: Date;
    other_handle: string;
    other_display_name: string;
  }>(
    `SELECT f.id, f.status, f.requester_id, f.created_at,
            other.handle AS other_handle, other.display_name AS other_display_name
     FROM friendships f
     JOIN profiles other ON other.user_id = CASE
       WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id = $1 OR f.addressee_id = $1)
       AND (f.status <> 'blocked' OR f.blocked_by = $1)
     ORDER BY f.created_at DESC`,
    [userId]
  );
  const lists: FriendshipList = { friends: [], incoming: [], outgoing: [], blocked: [] };
  for (const row of result.rows) {
    const direction = friendshipDirection(row.status, row.requester_id, userId);
    const entry: FriendshipEntry = {
      id: row.id,
      status: row.status,
      direction,
      createdAt: row.created_at.toISOString(),
      other: {
        handle: row.other_handle,
        displayName: row.other_display_name
      }
    };
    if (direction === "friend") lists.friends.push(entry);
    else if (direction === "incoming") lists.incoming.push(entry);
    else if (direction === "outgoing") lists.outgoing.push(entry);
    else lists.blocked.push(entry);
  }
  return lists;
}

export async function findFriendCandidate(userId: string, handle: string) {
  const candidate = await one<{
    id: string;
    handle: string;
    display_name: string;
    friendship_id: string | null;
    friendship_status: "pending" | "accepted" | null;
    requester_id: string | null;
  }>(
    `SELECT p.user_id AS id, p.handle, p.display_name,
            f.id AS friendship_id, f.status AS friendship_status, f.requester_id
     FROM profiles p
     LEFT JOIN friendships f ON
       LEAST(f.requester_id, f.addressee_id) = LEAST($1::uuid, p.user_id) AND
       GREATEST(f.requester_id, f.addressee_id) = GREATEST($1::uuid, p.user_id)
     WHERE p.handle = $2 AND p.user_id <> $1 AND p.onboarding_complete
       AND (f.id IS NULL OR f.status <> 'blocked')`,
    [userId, handle]
  );
  if (!candidate) return null;
  return {
    id: candidate.id,
    handle: candidate.handle,
    displayName: candidate.display_name,
    friendshipId: candidate.friendship_id,
    relationship: candidate.friendship_status,
    direction: candidateDirection(candidate.friendship_status, candidate.requester_id, userId)
  };
}

function friendshipDirection(
  status: "pending" | "accepted" | "blocked",
  requesterId: string,
  userId: string
): FriendshipEntry["direction"] {
  if (status === "accepted") return "friend";
  if (status === "blocked") return "blocked";
  return requesterId === userId ? "outgoing" : "incoming";
}

function candidateDirection(
  status: "pending" | "accepted" | null,
  requesterId: string | null,
  userId: string
) {
  if (status === "accepted") return "friend" as const;
  if (status === "pending") return requesterId === userId ? "outgoing" as const : "incoming" as const;
  return null;
}

export async function sendFriendRequest(userId: string, handle: string) {
  const candidate = await findFriendCandidate(userId, handle);
  if (!candidate) return { status: "not_found" as const };
  if (candidate.friendshipId) return { status: "exists" as const, candidate };
  try {
    const friendship = await one<{ id: string }>(
      `INSERT INTO friendships (requester_id, addressee_id)
       VALUES ($1, $2) RETURNING id`,
      [userId, candidate.id]
    );
    return { status: "created" as const, id: friendship!.id };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "23505") {
      return { status: "exists" as const, candidate: await findFriendCandidate(userId, handle) };
    }
    throw error;
  }
}

export async function actOnFriendship(
  userId: string,
  friendshipId: string,
  action: "accept" | "decline" | "block" | "unblock"
) {
  if (action === "accept") {
    const result = await pool.query(
      `UPDATE friendships SET status = 'accepted', responded_at = now()
       WHERE id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [friendshipId, userId]
    );
    return result.rowCount === 1;
  }
  if (action === "decline") {
    const result = await pool.query(
      `DELETE FROM friendships
       WHERE id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [friendshipId, userId]
    );
    return result.rowCount === 1;
  }
  if (action === "unblock") {
    const result = await pool.query(
      `DELETE FROM friendships
       WHERE id = $1 AND blocked_by = $2 AND status = 'blocked'`,
      [friendshipId, userId]
    );
    return result.rowCount === 1;
  }
  const result = await pool.query(
    `UPDATE friendships
     SET status = 'blocked', blocked_by = $2, responded_at = now()
     WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)
       AND status IN ('pending', 'accepted')`,
    [friendshipId, userId]
  );
  return result.rowCount === 1;
}

export async function removeFriendship(userId: string, friendshipId: string) {
  const result = await pool.query(
    `DELETE FROM friendships
     WHERE id = $1 AND (
       status = 'accepted' AND (requester_id = $2 OR addressee_id = $2) OR
       status = 'pending' AND requester_id = $2
     )`,
    [friendshipId, userId]
  );
  return result.rowCount === 1;
}

type ComparisonProfile = {
  id: string;
  handle: string;
  displayName: string;
  showTokens: boolean;
  showHarnesses: boolean;
  showModels: boolean;
  showStreaks: boolean;
};

export async function getFriendComparison(userId: string, friendshipId: string, windowDays: 7 | 30 | 90) {
  const friendship = await one<{
    comparison_date: string;
    mine_id: string;
    mine_handle: string;
    mine_display_name: string;
    mine_show_tokens: boolean;
    mine_show_harnesses: boolean;
    mine_show_models: boolean;
    mine_show_streaks: boolean;
    other_id: string;
    other_handle: string;
    other_display_name: string;
    other_show_tokens: boolean;
    other_show_harnesses: boolean;
    other_show_models: boolean;
    other_show_streaks: boolean;
  }>(
    `SELECT current_date::text AS comparison_date,
            mine.user_id AS mine_id, mine.handle AS mine_handle,
            mine.display_name AS mine_display_name,
            mine.show_tokens AS mine_show_tokens,
            mine.show_harnesses AS mine_show_harnesses,
            mine.show_models AS mine_show_models,
            mine.show_streaks AS mine_show_streaks,
            other.user_id AS other_id, other.handle AS other_handle,
            other.display_name AS other_display_name,
            other.show_tokens AS other_show_tokens,
            other.show_harnesses AS other_show_harnesses,
            other.show_models AS other_show_models,
            other.show_streaks AS other_show_streaks
     FROM friendships f
     JOIN profiles mine ON mine.user_id = $2
     JOIN profiles other ON other.user_id = CASE
       WHEN f.requester_id = $2 THEN f.addressee_id ELSE f.requester_id END
     WHERE f.id = $1 AND f.status = 'accepted'
       AND (f.requester_id = $2 OR f.addressee_id = $2)`,
    [friendshipId, userId]
  );
  if (!friendship) return null;

  const mine: ComparisonProfile = {
    id: friendship.mine_id,
    handle: friendship.mine_handle,
    displayName: friendship.mine_display_name,
    showTokens: friendship.mine_show_tokens,
    showHarnesses: friendship.mine_show_harnesses,
    showModels: friendship.mine_show_models,
    showStreaks: friendship.mine_show_streaks
  };
  const other: ComparisonProfile = {
    id: friendship.other_id,
    handle: friendship.other_handle,
    displayName: friendship.other_display_name,
    showTokens: friendship.other_show_tokens,
    showHarnesses: friendship.other_show_harnesses,
    showModels: friendship.other_show_models,
    showStreaks: friendship.other_show_streaks
  };

  const usage = await pool.query<{
    user_id: string;
    local_date: string;
    harness_id: string;
    model_id: string;
    total_tokens: string;
  }>(
    `SELECT user_id, local_date::text, harness_id, model_id, total_tokens::text
     FROM daily_usage
     WHERE user_id = ANY($1::uuid[])
       AND local_date BETWEEN $2::date - ($3::int - 1) AND $2::date
     ORDER BY local_date`,
    [[mine.id, other.id], friendship.comparison_date, windowDays]
  );
  const visibility = {
    tokens: mine.showTokens && other.showTokens,
    harnesses: mine.showHarnesses && other.showHarnesses,
    models: mine.showModels && other.showModels,
    streaks: mine.showStreaks && other.showStreaks
  };
  const dates = comparisonDates(friendship.comparison_date, windowDays);
  return {
    status: "ready" as const,
    friendshipId,
    windowDays,
    visibility,
    people: [
      buildComparisonPerson(mine, usage.rows.filter((row) => row.user_id === mine.id), dates, visibility),
      buildComparisonPerson(other, usage.rows.filter((row) => row.user_id === other.id), dates, visibility)
    ] as const
  };
}

function comparisonDates(today: string, windowDays: number) {
  const end = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: windowDays }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (windowDays - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function normalizedMix(values: Record<string, number>): Record<string, number> {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (total === 0) return {};
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value / total])
  );
}

function buildComparisonPerson(
  profile: ComparisonProfile,
  rows: { local_date: string; harness_id: string; model_id: string; total_tokens: string }[],
  dates: string[],
  visibility: { tokens: boolean; harnesses: boolean; models: boolean; streaks: boolean }
) {
  const byDate = new Map<string, number>();
  const harnesses: Record<string, number> = {};
  const models: Record<string, number> = {};
  for (const row of rows) {
    const tokens = Number(row.total_tokens);
    byDate.set(row.local_date, (byDate.get(row.local_date) ?? 0) + tokens);
    harnesses[row.harness_id] = (harnesses[row.harness_id] ?? 0) + tokens;
    models[row.model_id] = (models[row.model_id] ?? 0) + tokens;
  }
  const totals = dates.map((date) => ({ date, tokens: byDate.get(date) ?? 0 }));
  const thresholds = intensityThresholds(totals.map((day) => day.tokens));
  const streaks = calculateStreaks(
    totals.map((day) => ({ localDate: day.date, totalTokens: day.tokens })),
    dates.at(-1)!
  );
  const totalTokens = totals.reduce((sum, day) => sum + day.tokens, 0);
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    summary: {
      totalTokens: visibility.tokens ? totalTokens : null,
      activeDays: visibility.streaks ? totals.filter((day) => day.tokens > 0).length : null,
      currentStreak: visibility.streaks ? streaks.current : null,
      longestStreak: visibility.streaks ? streaks.longest : null
    },
    activity: totals.map((day) => ({
      date: day.date,
      tokens: visibility.tokens ? day.tokens : null,
      level: intensityFor(day.tokens, thresholds)
    })),
    harnesses: visibility.harnesses ? normalizedMix(harnesses) : {},
    models: visibility.models ? normalizedMix(models) : {}
  };
}

export async function getProfile(handle: string, viewerId?: string) {
  const profile = await one<Viewer>(
    `SELECT u.id, u.email, u.created_at, p.handle, p.display_name, p.bio,
            p.timezone, p.is_public, p.show_tokens,
            p.show_harnesses, p.show_models, p.show_streaks, p.onboarding_complete
     FROM profiles p JOIN users u ON u.id = p.user_id
     WHERE p.handle = $1 AND (p.is_public OR p.user_id = $2)`,
    [handle, viewerId ?? null]
  );
  if (!profile) return null;

  const dailyResult = await pool.query<{
    local_date: string;
    harness_id: string;
    model_id: string;
    total_tokens: string;
    event_count: number;
  }>(
    `SELECT local_date::text, harness_id, model_id,
            total_tokens::text, event_count
     FROM daily_usage
     WHERE user_id = $1 AND local_date >= current_date - interval '1 year'
     ORDER BY local_date`,
    [profile.id]
  );
  const daily = dailyResult.rows;
  const byDate = new Map<string, {
    date: string;
    tokens: number;
    events: number;
    harnesses: Record<string, number>;
  }>();
  const harnesses: Record<string, number> = {};
  const models: Record<string, number> = {};
  for (const row of daily) {
    const tokens = Number(row.total_tokens);
    const day = byDate.get(row.local_date) ?? {
      date: row.local_date,
      tokens: 0,
      events: 0,
      harnesses: {}
    };
    day.tokens += tokens;
    day.events += row.event_count;
    day.harnesses[row.harness_id] = (day.harnesses[row.harness_id] ?? 0) + tokens;
    byDate.set(row.local_date, day);
    harnesses[row.harness_id] = (harnesses[row.harness_id] ?? 0) + tokens;
    models[row.model_id] = (models[row.model_id] ?? 0) + tokens;
  }
  const activity = [...byDate.values()];
  const totalTokens = activity.reduce((sum, day) => sum + day.tokens, 0);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: profile.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const streaks = calculateStreaks(
    activity.map((day) => ({ localDate: day.date, totalTokens: day.tokens })),
    today
  );
  const summary: {
    totalTokens: number;
    activeDays: number;
    currentStreak: number;
    longestStreak: number;
    mostUsedHarness: string | null;
  } = {
    totalTokens,
    activeDays: activity.length,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    mostUsedHarness:
      Object.entries(harnesses).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  };
  const result = {
    profile,
    activity,
    harnesses,
    models,
    thresholds: intensityThresholds(activity.map((day) => day.tokens)),
    summary,
    // Only shares the owner explicitly marked public reach a profile. Unlisted
    // and friends-only shares stay off it entirely, including for the owner's
    // own view, so the section always shows what a visitor would see.
    sharedSessions: await listPublicShares(profile.id)
  };
  const isOwner = viewerId === profile.id;
  if (!isOwner) {
    if (!profile.show_tokens) {
      result.activity = result.activity.map((day) => ({
        ...day,
        tokens: intensityFor(day.tokens, result.thresholds),
        harnesses: profile.show_harnesses
          ? Object.fromEntries(Object.entries(day.harnesses).map(([key, value]) => [
              key,
              day.tokens > 0 ? value / day.tokens : 0
            ]))
          : {}
      }));
      result.thresholds = [1, 2, 3, 4];
      result.summary.totalTokens = 0;
    }
    if (!profile.show_harnesses) {
      result.harnesses = {};
      result.activity = result.activity.map((day) => ({ ...day, harnesses: {} }));
      result.summary.mostUsedHarness = null;
    }
    if (!profile.show_models) result.models = {};
    if (!profile.show_streaks) {
      result.summary.currentStreak = 0;
      result.summary.longestStreak = 0;
    }
  }
  return result;
}

export type ProfileIdentity = {
  handle: string;
  displayName: string;
  isPublic: boolean;
};

export async function getProfileIdentity(handle: string) {
  return one<ProfileIdentity>(
    `SELECT handle, display_name AS "displayName", is_public AS "isPublic"
     FROM profiles
     WHERE handle = $1 AND onboarding_complete = true`,
    [handle]
  );
}

export async function searchPublicProfiles(query: string, limit = 6) {
  const escaped = query.replace(/[\\%_]/g, "\\$&");
  const match = `%${escaped}%`;
  const prefix = `${escaped}%`;
  const boundedLimit = Math.min(Math.max(limit, 1), 10);
  const result = await pool.query<Omit<ProfileIdentity, "isPublic">>(
    `SELECT handle, display_name AS "displayName"
     FROM profiles
     WHERE onboarding_complete = true
       AND is_public = true
       AND (handle ILIKE $1 ESCAPE '\\' OR display_name ILIKE $1 ESCAPE '\\')
     ORDER BY
       CASE
         WHEN lower(handle) = lower($2) THEN 0
         WHEN handle ILIKE $3 ESCAPE '\\' THEN 1
         WHEN display_name ILIKE $3 ESCAPE '\\' THEN 2
         ELSE 3
       END,
       handle
     LIMIT $4`,
    [match, query, prefix, boundedLimit]
  );
  return result.rows;
}

export async function listIndexablePages() {
  const [profiles, shares] = await Promise.all([
    pool.query<{ handle: string; updated_at: Date }>(
      `SELECT handle, updated_at
       FROM profiles
       WHERE onboarding_complete = true AND is_public = true
       ORDER BY updated_at DESC`
    ),
    pool.query<{ slug: string; updated_at: Date }>(
      `SELECT slug, updated_at
       FROM shared_sessions
       WHERE visibility = 'public'
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY updated_at DESC`
    )
  ]);

  return { profiles: profiles.rows, shares: shares.rows };
}

export async function usageExport(userId: string) {
  const user = await one<{ email: string; created_at: Date }>(
    "SELECT email, created_at FROM users WHERE id = $1",
    [userId]
  );
  const profile = await one<Record<string, unknown>>(
    `SELECT user_id, handle, display_name, bio, timezone, is_public,
            show_tokens, show_harnesses, show_models, show_streaks,
            onboarding_complete, published_at, updated_at
     FROM profiles WHERE user_id = $1`,
    [userId]
  );
  const devices = await listDevices(userId);
  const friendships = await listFriendships(userId);
  const usage = await pool.query(
    `SELECT event_id, schema_version, occurred_at, local_date, harness_id,
            harness_version, provider_id, model_id, input_tokens::text,
            output_tokens::text, cached_input_tokens::text,
            reasoning_tokens::text, total_tokens::text, source_fingerprint
     FROM usage_events WHERE user_id = $1 ORDER BY occurred_at`,
    [userId]
  );
  const shares = await shareExport(userId);
  return {
    exportedAt: new Date().toISOString(),
    account: user,
    profile,
    devices,
    friendships,
    usage: usage.rows,
    sharedSessions: shares
  };
}

export async function deleteAccount(userId: string) {
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

/* Session sharing. */

export type ShareSummary = {
  id: string;
  slug: string;
  harness_id: string;
  harness_version: string | null;
  title: string;
  summary: string;
  visibility: ShareVisibility;
  redaction_level: RedactionLevel;
  redaction_stats: Record<string, number>;
  turn_count: number;
  total_tokens: string;
  model_ids: string[];
  started_at: Date;
  ended_at: Date;
  published_at: Date;
  updated_at: Date;
  expires_at: Date | null;
  view_count: string;
};

const shareFields = [
  "id", "slug", "harness_id", "harness_version", "title", "summary", "visibility",
  "redaction_level", "redaction_stats", "turn_count", "total_tokens::text",
  "model_ids", "started_at", "ended_at",
  "published_at", "updated_at", "expires_at", "view_count::text"
];
const shareColumns = shareFields.join(", ");
const prefixedShareColumns = shareFields.map((field) => `s.${field}`).join(", ");

function shareSlug() {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(22);
  let slug = "";
  for (const byte of bytes) slug += alphabet[byte % alphabet.length];
  return slug;
}

/*
 * Publishing is idempotent per (user, session_fingerprint): re-sharing the same
 * harness session after more work replaces the transcript in place and keeps
 * the existing URL, so a link someone already sent stays correct.
 */
export async function publishShare(
  input: { userId: string; deviceId?: string | null },
  share: SessionShare
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await one<{ id: string; slug: string }>(
      "SELECT id, slug FROM shared_sessions WHERE user_id = $1 AND session_fingerprint = $2 FOR UPDATE",
      [input.userId, share.session_fingerprint],
      client
    );
    const values = [
      input.userId,
      input.deviceId ?? null,
      share.harness_id,
      share.harness_version ?? null,
      share.title,
      share.summary ?? "",
      share.visibility,
      share.redaction_level,
      JSON.stringify(share.redaction),
      share.turns.length,
      share.totals.input_tokens,
      share.totals.output_tokens,
      share.totals.total_tokens,
      share.model_ids,
      share.started_at,
      share.ended_at,
      share.expires_at ?? null
    ];
    let row: { id: string; slug: string } | null;
    if (existing) {
      row = await one<{ id: string; slug: string }>(
        `UPDATE shared_sessions SET
           device_id = $2, harness_id = $3, harness_version = $4, title = $5,
           summary = $6, visibility = $7, redaction_level = $8,
           redaction_stats = $9::jsonb, turn_count = $10, input_tokens = $11,
           output_tokens = $12, total_tokens = $13, model_ids = $14,
           started_at = $15, ended_at = $16, expires_at = $17, updated_at = now()
         WHERE user_id = $1 AND session_fingerprint = $18
         RETURNING id, slug`,
        [...values, share.session_fingerprint],
        client
      );
      await client.query("DELETE FROM shared_session_turns WHERE share_id = $1", [existing.id]);
    } else {
      row = await one<{ id: string; slug: string }>(
        `INSERT INTO shared_sessions (
           user_id, device_id, harness_id, harness_version, title, summary,
           visibility, redaction_level, redaction_stats, turn_count,
           input_tokens, output_tokens, total_tokens, model_ids,
           started_at, ended_at, expires_at,
           session_fingerprint, slug
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12,
                   $13, $14, $15, $16, $17, $18, $19)
         RETURNING id, slug`,
        [...values, share.session_fingerprint, shareSlug()],
        client
      );
    }
    if (!row) throw new Error("share was not persisted");
    for (const turn of share.turns) {
      await client.query(
        `INSERT INTO shared_session_turns (share_id, index, role, occurred_at, model_id, blocks)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [row.id, turn.index, turn.role, turn.at ?? null, turn.model_id ?? null, JSON.stringify(turn.blocks)]
      );
    }
    await client.query("COMMIT");
    return { id: row.id, slug: row.slug, replaced: Boolean(existing) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listShares(userId: string) {
  const result = await pool.query<ShareSummary>(
    `SELECT ${shareColumns} FROM shared_sessions
     WHERE user_id = $1 ORDER BY published_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function listPublicShares(userId: string, limit = 6) {
  const result = await pool.query<ShareSummary>(
    `SELECT ${shareColumns} FROM shared_sessions
     WHERE user_id = $1 AND visibility = 'public'
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY published_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function updateShare(userId: string, shareId: string, patch: SharePatch) {
  const assignments: string[] = [];
  const values: unknown[] = [userId, shareId];
  for (const [column, value] of Object.entries(patch)) {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }
  if (assignments.length === 0) return null;
  return one<ShareSummary>(
    `UPDATE shared_sessions SET ${assignments.join(", ")}, updated_at = now()
     WHERE user_id = $1 AND id = $2
     RETURNING ${shareColumns}`,
    values
  );
}

/*
 * Revoking is a hard delete, not a flag. A shared session is content the owner
 * asked us to publish; withdrawing consent has to actually remove it.
 */
export async function revokeShare(userId: string, shareId: string) {
  const result = await pool.query(
    "DELETE FROM shared_sessions WHERE user_id = $1 AND id = $2",
    [userId, shareId]
  );
  return (result.rowCount ?? 0) > 0;
}

export type SharedSessionView = ShareSummary & {
  author: { handle: string; display_name: string; is_public: boolean };
  turns: Array<{
    index: number;
    role: string;
    occurred_at: Date | null;
    model_id: string | null;
    blocks: TranscriptBlock[];
  }>;
  total_turns: number;
};

export async function getSharedSession(
  slug: string,
  viewerId: string | undefined,
  page: { offset: number; limit: number } = { offset: 0, limit: 200 }
) {
  const share = await one<ShareSummary & {
    user_id: string;
    visibility: ShareVisibility;
    handle: string;
    display_name: string;
    is_public: boolean;
  }>(
    `SELECT s.user_id, ${prefixedShareColumns},
            p.handle, p.display_name, p.is_public
     FROM shared_sessions s
     JOIN profiles p ON p.user_id = s.user_id
     WHERE s.slug = $1 AND (s.expires_at IS NULL OR s.expires_at > now())`,
    [slug]
  );
  if (!share) return null;

  const isOwner = viewerId === share.user_id;
  if (!isOwner && share.visibility === "friends") {
    const friendship = viewerId
      ? await one<{ id: string }>(
          `SELECT id FROM friendships
           WHERE status = 'accepted'
             AND ((requester_id = $1 AND addressee_id = $2)
               OR (requester_id = $2 AND addressee_id = $1))`,
          [share.user_id, viewerId]
        )
      : null;
    if (!friendship) return null;
  }

  const turns = await pool.query<{
    index: number;
    role: string;
    occurred_at: Date | null;
    model_id: string | null;
    blocks: TranscriptBlock[];
  }>(
    `SELECT index, role, occurred_at, model_id, blocks
     FROM shared_session_turns
     WHERE share_id = $1 AND index >= $2
     ORDER BY index LIMIT $3`,
    [share.id, page.offset, page.limit]
  );
  return { ...share, turns: turns.rows, total_turns: share.turn_count, isOwner };
}

export async function recordShareView(slug: string) {
  await pool.query(
    "UPDATE shared_sessions SET view_count = view_count + 1 WHERE slug = $1",
    [slug]
  );
}

export async function shareExport(userId: string) {
  const result = await pool.query(
    `SELECT s.slug, s.harness_id, s.title, s.visibility, s.redaction_level,
            s.published_at, s.expires_at,
            coalesce(jsonb_agg(
              jsonb_build_object(
                'index', t.index, 'role', t.role, 'at', t.occurred_at,
                'model_id', t.model_id, 'blocks', t.blocks
              ) ORDER BY t.index
            ) FILTER (WHERE t.share_id IS NOT NULL), '[]'::jsonb) AS turns
     FROM shared_sessions s
     LEFT JOIN shared_session_turns t ON t.share_id = s.id
     WHERE s.user_id = $1
     GROUP BY s.id
     ORDER BY s.published_at`,
    [userId]
  );
  return result.rows;
}

export function uuid() {
  return randomUUID();
}

export async function consumeRateLimit(key: string, maximum: number, windowSeconds: number) {
  const result = await one<{ request_count: number }>(
    `INSERT INTO api_rate_limits (key, window_started_at, request_count)
     VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       request_count = CASE
         WHEN api_rate_limits.window_started_at < now() - make_interval(secs => $2)
           THEN 1
         ELSE api_rate_limits.request_count + 1
       END,
       window_started_at = CASE
         WHEN api_rate_limits.window_started_at < now() - make_interval(secs => $2)
           THEN now()
         ELSE api_rate_limits.window_started_at
       END
     RETURNING request_count`,
    [key, windowSeconds]
  );
  return (result?.request_count ?? maximum + 1) <= maximum;
}
