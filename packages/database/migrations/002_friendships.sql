ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS friends_can_compare boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'blocked')),
  blocked_by uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (requester_id <> addressee_id),
  CHECK (blocked_by IS NULL OR blocked_by IN (requester_id, addressee_id)),
  CHECK (
    (status = 'blocked' AND blocked_by IS NOT NULL) OR
    (status <> 'blocked' AND blocked_by IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique_pair_idx
  ON friendships (
    LEAST(requester_id, addressee_id),
    GREATEST(requester_id, addressee_id)
  );

CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships(addressee_id);
