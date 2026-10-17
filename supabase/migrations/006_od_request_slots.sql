-- Extra OD times. One request can have as many ranges as needed.
-- Copies any times already stored on od_requests. Does not delete those columns or rows.
-- Run 005_od_requests.sql first.

CREATE TABLE IF NOT EXISTS od_request_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  od_request_id UUID NOT NULL REFERENCES od_requests(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  position INT NOT NULL DEFAULT 1,
  CONSTRAINT od_slot_time_order CHECK (end_time >= start_time)
);

CREATE INDEX IF NOT EXISTS idx_od_request_slots_request
  ON od_request_slots(od_request_id, position);

ALTER TABLE od_request_slots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY od_request_slots_select ON od_request_slots
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY od_request_slots_insert ON od_request_slots
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM od_requests r
        WHERE r.id = od_request_id AND r.profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY od_request_slots_update ON od_request_slots
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM od_requests r
        WHERE r.id = od_request_id AND r.profile_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM od_requests r
        WHERE r.id = od_request_id AND r.profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY od_request_slots_delete ON od_request_slots
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM od_requests r
        WHERE r.id = od_request_id AND r.profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO od_request_slots (od_request_id, start_time, end_time, position)
SELECT r.id, r.start_time, r.end_time, 1
FROM od_requests r
WHERE NOT EXISTS (
  SELECT 1 FROM od_request_slots s WHERE s.od_request_id = r.id AND s.position = 1
);

INSERT INTO od_request_slots (od_request_id, start_time, end_time, position)
SELECT r.id, r.start_time_2, r.end_time_2, 2
FROM od_requests r
WHERE r.start_time_2 IS NOT NULL
  AND r.end_time_2 IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM od_request_slots s WHERE s.od_request_id = r.id AND s.position = 2
  );
