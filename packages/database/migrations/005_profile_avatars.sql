CREATE TABLE IF NOT EXISTS profile_avatars (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  object_key text,
  image_data bytea,
  CONSTRAINT profile_avatars_image_data_check CHECK (octet_length(image_data) <= 5242880),
  CONSTRAINT profile_avatars_storage_check CHECK ((object_key IS NULL) <> (image_data IS NULL)),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Compatibility for databases that ran the first version of this branch,
-- where avatar bytes were stored directly in PostgreSQL.
ALTER TABLE profile_avatars ADD COLUMN IF NOT EXISTS object_key text;
ALTER TABLE profile_avatars ALTER COLUMN image_data DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'profile_avatars'::regclass
      AND conname = 'profile_avatars_image_data_check'
      AND pg_get_constraintdef(oid) LIKE '%1048576%'
  ) THEN
    ALTER TABLE profile_avatars DROP CONSTRAINT profile_avatars_image_data_check;
    ALTER TABLE profile_avatars
      ADD CONSTRAINT profile_avatars_image_data_check
      CHECK (octet_length(image_data) <= 5242880);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'profile_avatars'::regclass
      AND conname = 'profile_avatars_storage_check'
  ) THEN
    ALTER TABLE profile_avatars
      ADD CONSTRAINT profile_avatars_storage_check
      CHECK ((object_key IS NULL) <> (image_data IS NULL));
  END IF;
END $$;
