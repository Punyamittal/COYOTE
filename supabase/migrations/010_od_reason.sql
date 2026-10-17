-- Reason is required when someone applies for OD.
-- Existing rows are left blank. Does not delete rows.

ALTER TABLE od_requests
  ADD COLUMN IF NOT EXISTS reason TEXT;
