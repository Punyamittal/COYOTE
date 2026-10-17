-- On-duty (OD) requests. One row can hold two time ranges on the same day.
-- event_id is optional so a student can apply without a calendar event.
-- Safe to re-run: does not delete existing rows.

CREATE TABLE IF NOT EXISTS od_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  start_time_2 TIME,
  end_time_2 TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT od_time_order CHECK (end_time >= start_time),
  CONSTRAINT od_time_2_pair CHECK (
    (start_time_2 IS NULL AND end_time_2 IS NULL)
    OR (
      start_time_2 IS NOT NULL
      AND end_time_2 IS NOT NULL
      AND end_time_2 >= start_time_2
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS od_requests_event_user
  ON od_requests (profile_id, event_id)
  WHERE event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS od_requests_free_day
  ON od_requests (profile_id, date)
  WHERE event_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_od_requests_date ON od_requests(date);

ALTER TABLE od_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY od_requests_select ON od_requests
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY od_requests_insert ON od_requests
    FOR INSERT TO authenticated
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY od_requests_update ON od_requests
    FOR UPDATE TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY od_requests_delete ON od_requests
    FOR DELETE TO authenticated
    USING (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
