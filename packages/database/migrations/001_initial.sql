CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_account_id),
  UNIQUE (provider, user_id)
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle text NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$'),
  display_name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'UTC',
  is_public boolean NOT NULL DEFAULT false,
  show_tokens boolean NOT NULL DEFAULT true,
  show_cost boolean NOT NULL DEFAULT false,
  show_harnesses boolean NOT NULL DEFAULT true,
  show_models boolean NOT NULL DEFAULT true,
  show_streaks boolean NOT NULL DEFAULT true,
  onboarding_complete boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code_hash text NOT NULL UNIQUE,
  user_code text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'consumed', 'denied')),
  expires_at timestamptz NOT NULL,
  interval_seconds integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  platform text NOT NULL,
  agent_version text NOT NULL,
  last_sync_at timestamptz,
  last_seen_at timestamptz,
  paused boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_credentials (
  device_id uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  credential_hash text NOT NULL UNIQUE,
  signing_public_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE device_credentials ADD COLUMN IF NOT EXISTS signing_public_key text;

CREATE TABLE IF NOT EXISTS device_sources (
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  harness_id text NOT NULL,
  status text NOT NULL DEFAULT 'detected',
  version text,
  last_collected_at timestamptz,
  PRIMARY KEY (device_id, harness_id)
);

CREATE TABLE IF NOT EXISTS sync_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  accepted_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, batch_id)
);

CREATE TABLE IF NOT EXISTS usage_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  schema_version integer NOT NULL,
  occurred_at timestamptz NOT NULL,
  local_date date NOT NULL,
  harness_id text NOT NULL,
  harness_version text,
  provider_id text,
  model_id text,
  input_tokens bigint NOT NULL CHECK (input_tokens >= 0),
  output_tokens bigint NOT NULL CHECK (output_tokens >= 0),
  cached_input_tokens bigint,
  reasoning_tokens bigint,
  total_tokens bigint NOT NULL CHECK (total_tokens >= 0),
  estimated_cost_micros bigint,
  cost_basis text CHECK (cost_basis IN ('reported', 'price-table', 'unavailable')),
  source_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS daily_usage (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  harness_id text NOT NULL,
  model_id text NOT NULL DEFAULT 'unknown',
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  estimated_cost_micros bigint NOT NULL DEFAULT 0,
  event_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, local_date, harness_id, model_id)
);

CREATE INDEX IF NOT EXISTS daily_usage_user_date_idx ON daily_usage(user_id, local_date);
CREATE INDEX IF NOT EXISTS usage_events_user_date_idx ON usage_events(user_id, local_date);
CREATE INDEX IF NOT EXISTS devices_user_idx ON devices(user_id);

CREATE TABLE IF NOT EXISTS export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ready',
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1
);
