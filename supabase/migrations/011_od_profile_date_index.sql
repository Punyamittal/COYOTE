-- Speeds up "my OD" lookups by student and date.
-- Safe to re-run. Does not change existing rows.

CREATE INDEX IF NOT EXISTS idx_od_requests_profile_date
  ON od_requests (profile_id, date);
