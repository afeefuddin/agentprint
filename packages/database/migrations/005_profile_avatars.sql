CREATE TABLE IF NOT EXISTS profile_avatars (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  image_data bytea NOT NULL CHECK (octet_length(image_data) <= 1048576),
  updated_at timestamptz NOT NULL DEFAULT now()
);
