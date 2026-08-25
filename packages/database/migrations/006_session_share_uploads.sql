-- Temporary, private objects used by the asynchronous session-share pipeline.
-- Transcript content remains in object storage; this table contains only the
-- authenticated reservation, integrity metadata, and processing state.

CREATE TABLE IF NOT EXISTS session_share_uploads (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  content_length integer NOT NULL CHECK (content_length > 0 AND content_length <= 8388608),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'queued', 'processing', 'published', 'failed')),
  trigger_run_id text,
  share_id uuid REFERENCES shared_sessions(id) ON DELETE SET NULL,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_share_uploads_user_created_idx
  ON session_share_uploads(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS session_share_uploads_pending_idx
  ON session_share_uploads(status, created_at)
  WHERE status IN ('created', 'queued', 'processing');
