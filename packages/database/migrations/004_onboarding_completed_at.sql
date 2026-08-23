ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

UPDATE profiles
SET onboarding_completed_at = updated_at
WHERE onboarding_complete = true
  AND onboarding_completed_at IS NULL;
