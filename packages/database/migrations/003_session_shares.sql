-- Session sharing.
--
-- This is the only table family in the schema that holds harness content, and
-- it exists on a separate pipeline from usage ingestion: every row here is the
-- result of one explicit, per-session publish action by the owner. The name is
-- shared_sessions rather than sessions because sessions already holds browser
-- authentication sessions.

CREATE TABLE IF NOT EXISTS shared_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[A-Za-z0-9]{16,32}$'),
  harness_id text NOT NULL,
  harness_version text,
  session_fingerprint text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'unlisted'
    CHECK (visibility IN ('unlisted', 'public', 'friends')),
  redaction_level text NOT NULL
    CHECK (redaction_level IN ('strict', 'balanced', 'full')),
  redaction_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  turn_count integer NOT NULL DEFAULT 0 CHECK (turn_count >= 0),
  input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens bigint NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  estimated_cost_micros bigint,
  cost_basis text CHECK (cost_basis IN ('reported', 'price-table', 'unavailable')),
  model_ids text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  view_count bigint NOT NULL DEFAULT 0,
  UNIQUE (user_id, session_fingerprint)
);

CREATE TABLE IF NOT EXISTS shared_session_turns (
  share_id uuid NOT NULL REFERENCES shared_sessions(id) ON DELETE CASCADE,
  index integer NOT NULL CHECK (index >= 0),
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  occurred_at timestamptz,
  model_id text,
  blocks jsonb NOT NULL,
  PRIMARY KEY (share_id, index)
);

CREATE INDEX IF NOT EXISTS shared_sessions_user_idx
  ON shared_sessions(user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS shared_sessions_public_idx
  ON shared_sessions(user_id, published_at DESC)
  WHERE visibility = 'public';
