-- Owner-only display metadata for background session publication attempts.
-- These values are hints supplied before the worker validates the canonical
-- session payload, so public session readers must continue using shared_sessions.

ALTER TABLE session_share_uploads
  ADD COLUMN IF NOT EXISTS display_title text NOT NULL DEFAULT 'Session upload';

ALTER TABLE session_share_uploads
  ADD COLUMN IF NOT EXISTS harness_id text NOT NULL DEFAULT 'unknown';

ALTER TABLE session_share_uploads
  DROP CONSTRAINT IF EXISTS session_share_uploads_display_title_check;

ALTER TABLE session_share_uploads
  ADD CONSTRAINT session_share_uploads_display_title_check
  CHECK (char_length(display_title) BETWEEN 1 AND 140);

ALTER TABLE session_share_uploads
  DROP CONSTRAINT IF EXISTS session_share_uploads_harness_id_check;

ALTER TABLE session_share_uploads
  ADD CONSTRAINT session_share_uploads_harness_id_check
  CHECK (char_length(harness_id) BETWEEN 1 AND 80);
