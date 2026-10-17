-- Calendar events can be approved or rejected from Reports.
-- Existing events stay pending. Does not delete rows.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS od_status od_status NOT NULL DEFAULT 'pending';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS od_reviewed_by UUID REFERENCES profiles(id);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS od_reviewed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION guard_event_od_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role user_role;
BEGIN
  IF NEW.od_status IS NOT DISTINCT FROM OLD.od_status
     AND NEW.od_reviewed_by IS NOT DISTINCT FROM OLD.od_reviewed_by
     AND NEW.od_reviewed_at IS NOT DISTINCT FROM OLD.od_reviewed_at THEN
    RETURN NEW;
  END IF;

  SELECT role INTO actor_role FROM profiles WHERE id = auth.uid();

  IF actor_role = 'MAIN_ADMIN' THEN
    RETURN NEW;
  END IF;

  IF NEW.od_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Only the main admin can approve or reject a calendar event';
  END IF;

  NEW.od_status := 'pending';
  NEW.od_reviewed_by := NULL;
  NEW.od_reviewed_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_guard_od_review ON events;
CREATE TRIGGER events_guard_od_review
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION guard_event_od_review();
