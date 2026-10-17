-- OD review status. Existing requests stay pending.
-- Does not delete rows. Only the main admin can set approved or rejected.

DO $$ BEGIN
  CREATE TYPE od_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE od_requests
  ADD COLUMN IF NOT EXISTS status od_status NOT NULL DEFAULT 'pending';

ALTER TABLE od_requests
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id);

ALTER TABLE od_requests
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION guard_od_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role user_role;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
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

  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS od_requests_guard_review ON od_requests;
CREATE TRIGGER od_requests_guard_review
  BEFORE UPDATE ON od_requests
  FOR EACH ROW
  EXECUTE FUNCTION guard_od_review();

DO $$ BEGIN
  CREATE POLICY od_requests_main_review ON od_requests
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
