-- Volunteer sign-ups for calendar events (additive; does not delete events).
-- Run in the Supabase SQL editor after 001–003.

CREATE TABLE IF NOT EXISTS event_volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, profile_id),
  CONSTRAINT event_volunteers_time_order CHECK (end_time >= start_time)
);

CREATE INDEX IF NOT EXISTS idx_event_volunteers_event ON event_volunteers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_volunteers_profile ON event_volunteers(profile_id);

ALTER TABLE event_volunteers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY event_volunteers_select ON event_volunteers
    FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY event_volunteers_insert ON event_volunteers
    FOR INSERT TO authenticated
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY event_volunteers_update ON event_volunteers
    FOR UPDATE TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY event_volunteers_delete ON event_volunteers
    FOR DELETE TO authenticated
    USING (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
