-- Each OD time can be approved or rejected on its own.
-- Copies the request status onto existing times. Does not delete rows.

ALTER TABLE od_request_slots
  ADD COLUMN IF NOT EXISTS status od_status NOT NULL DEFAULT 'pending';

ALTER TABLE od_request_slots
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id);

ALTER TABLE od_request_slots
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

UPDATE od_request_slots AS slot
SET
  status = request.status,
  reviewed_by = request.reviewed_by,
  reviewed_at = request.reviewed_at
FROM od_requests AS request
WHERE slot.od_request_id = request.id
  AND slot.status = 'pending'
  AND request.status IS DISTINCT FROM 'pending';

CREATE OR REPLACE FUNCTION guard_od_slot_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role user_role;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by
     AND NEW.reviewed_at IS NOT DISTINCT FROM OLD.reviewed_at THEN
    RETURN NEW;
  END IF;

  SELECT role INTO actor_role FROM profiles WHERE id = auth.uid();

  IF actor_role = 'MAIN_ADMIN' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Only the main admin can approve or reject OD';
  END IF;

  NEW.status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS od_request_slots_guard_review ON od_request_slots;
CREATE TRIGGER od_request_slots_guard_review
  BEFORE INSERT OR UPDATE ON od_request_slots
  FOR EACH ROW
  EXECUTE FUNCTION guard_od_slot_review();

DO $$ BEGIN
  CREATE POLICY od_request_slots_main_review ON od_request_slots
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'MAIN_ADMIN'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'MAIN_ADMIN'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
