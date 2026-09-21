-- Event & Activity Scheduling Management System
-- PostgreSQL schema for Supabase
-- Timezone: Asia/Kolkata
--
-- SAFE / ADDITIVE ONLY:
-- Does NOT drop tables, delete rows, or truncate data.
-- Re-running skips objects that already exist.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('MAIN_ADMIN', 'ADMIN', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ACTIVE', 'DISABLED', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE time_slot_category AS ENUM (
    'MORNING', 'EVENING', 'HALF_DAY_MORNING', 'HALF_DAY_EVENING', 'FULL_DAY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE day_category AS ENUM (
    'MORNING', 'EVENING', 'FULL_DAY', 'MULTI_SLOT', 'CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  role user_role NOT NULL DEFAULT 'USER',
  status user_status NOT NULL DEFAULT 'ACTIVE',
  force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If profiles already existed (e.g. Supabase starter), add any missing columns.
-- Never drops or renames existing columns.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'USER';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status user_status DEFAULT 'ACTIVE';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill login id for existing rows that lack user_id (does not overwrite set values)
UPDATE profiles
SET user_id = COALESCE(
  NULLIF(user_id, ''),
  NULLIF(split_part(COALESCE(email, ''), '@', 1), ''),
  id::text
)
WHERE user_id IS NULL OR user_id = '';

UPDATE profiles SET name = COALESCE(NULLIF(name, ''), email, 'User') WHERE name IS NULL OR name = '';
UPDATE profiles SET role = 'USER' WHERE role IS NULL;
UPDATE profiles SET status = 'ACTIVE' WHERE status IS NULL;
UPDATE profiles SET force_password_change = FALSE WHERE force_password_change IS NULL;
UPDATE profiles SET created_at = NOW() WHERE created_at IS NULL;
UPDATE profiles SET updated_at = NOW() WHERE updated_at IS NULL;

DO $$ BEGIN
  ALTER TABLE profiles ALTER COLUMN user_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ALTER COLUMN name SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL; -- unique indexes are relations (42P07)
  WHEN unique_violation THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- Time slots
CREATE TABLE IF NOT EXISTS time_slots (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  category time_slot_category NOT NULL,
  display_order INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE time_slots ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE time_slots ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE time_slots ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE time_slots ADD COLUMN IF NOT EXISTS category time_slot_category;
ALTER TABLE time_slots ADD COLUMN IF NOT EXISTS display_order INT;
ALTER TABLE time_slots ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
  ALTER TABLE locations ADD CONSTRAINT locations_name_key UNIQUE (name);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN unique_violation THEN NULL;
END $$;

-- Event categories
CREATE TABLE IF NOT EXISTS event_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE event_categories ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE event_categories ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE event_categories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

DO $$ BEGIN
  ALTER TABLE event_categories ADD CONSTRAINT event_categories_name_key UNIQUE (name);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN unique_violation THEN NULL;
END $$;

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  event_name TEXT NOT NULL,
  location TEXT NOT NULL,
  remarks TEXT,
  description TEXT,
  department TEXT,
  category_id UUID REFERENCES event_categories(id) ON DELETE SET NULL,
  organizer TEXT,
  contact_info TEXT,
  day_category day_category NOT NULL DEFAULT 'CUSTOM',
  affected_slots TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_time_order CHECK (end_time >= start_time)
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS contact_info TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS day_category day_category DEFAULT 'CUSTOM';
ALTER TABLE events ADD COLUMN IF NOT EXISTS affected_slots TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_end_time ON events(end_time);
CREATE INDEX IF NOT EXISTS idx_events_registration_number ON events(registration_number);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location);
CREATE INDEX IF NOT EXISTS idx_events_event_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_date_range ON events(date, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_events_affected_slots ON events USING GIN (affected_slots);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  permission TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (role, permission)
);

ALTER TABLE permissions ADD COLUMN IF NOT EXISTS role user_role;
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS permission TEXT;
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;

-- System settings (single row)
CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  institution_name TEXT NOT NULL DEFAULT 'Institution',
  logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  default_calendar_view TEXT NOT NULL DEFAULT 'dayGridMonth',
  default_working_hours_start TIME NOT NULL DEFAULT '08:00',
  default_working_hours_end TIME NOT NULL DEFAULT '19:20',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS institution_name TEXT DEFAULT 'Institution';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS default_calendar_view TEXT DEFAULT 'dayGridMonth';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS default_working_hours_start TIME DEFAULT '08:00';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS default_working_hours_end TIME DEFAULT '19:20';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_data JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_data JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Updated_at trigger (create function only if missing — do not replace existing)
DO $$ BEGIN
  CREATE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $fn$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql;
EXCEPTION WHEN duplicate_function THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-create profile on auth signup (create only if missing)
DO $$ BEGIN
  CREATE FUNCTION handle_new_user()
  RETURNS TRIGGER AS $fn$
  BEGIN
    INSERT INTO public.profiles (id, name, user_id, email, role, status, force_password_change)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
      COALESCE(NEW.raw_user_meta_data->>'user_id', split_part(NEW.email, '@', 1)),
      NEW.email,
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'USER'),
      'ACTIVE',
      COALESCE((NEW.raw_user_meta_data->>'force_password_change')::boolean, FALSE)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql SECURITY DEFINER;
EXCEPTION WHEN duplicate_function THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS (idempotent — enabling when already on is a no-op)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions (create only if missing)
DO $$ BEGIN
  CREATE FUNCTION current_user_role()
  RETURNS user_role AS $fn$
    SELECT role FROM profiles WHERE id = auth.uid();
  $fn$ LANGUAGE sql STABLE SECURITY DEFINER;
EXCEPTION WHEN duplicate_function THEN NULL;
END $$;

DO $$ BEGIN
  CREATE FUNCTION is_active_user()
  RETURNS BOOLEAN AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'ACTIVE'
    );
  $fn$ LANGUAGE sql STABLE SECURITY DEFINER;
EXCEPTION WHEN duplicate_function THEN NULL;
END $$;

-- Policies: create only if missing (never drop existing policies)
DO $$ BEGIN
  CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
    USING (is_active_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY profiles_admin_all ON profiles FOR ALL TO authenticated
    USING (current_user_role() IN ('MAIN_ADMIN', 'ADMIN'))
    WITH CHECK (current_user_role() = 'MAIN_ADMIN' OR (current_user_role() = 'ADMIN' AND role <> 'MAIN_ADMIN'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY events_select ON events FOR SELECT TO authenticated
    USING (is_active_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY events_insert ON events FOR INSERT TO authenticated
    WITH CHECK (is_active_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY events_update ON events FOR UPDATE TO authenticated
    USING (
      current_user_role() IN ('MAIN_ADMIN', 'ADMIN')
      OR created_by = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY events_delete ON events FOR DELETE TO authenticated
    USING (
      current_user_role() IN ('MAIN_ADMIN', 'ADMIN')
      OR created_by = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY time_slots_select ON time_slots FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY time_slots_admin ON time_slots FOR ALL TO authenticated
    USING (current_user_role() = 'MAIN_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY locations_select ON locations FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY locations_write ON locations FOR ALL TO authenticated
    USING (current_user_role() IN ('MAIN_ADMIN', 'ADMIN'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY categories_select ON event_categories FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY categories_write ON event_categories FOR ALL TO authenticated
    USING (current_user_role() IN ('MAIN_ADMIN', 'ADMIN'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY permissions_select ON permissions FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY permissions_admin ON permissions FOR ALL TO authenticated
    USING (current_user_role() = 'MAIN_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY settings_select ON system_settings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY settings_admin ON system_settings FOR ALL TO authenticated
    USING (current_user_role() = 'MAIN_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY audit_select ON audit_logs FOR SELECT TO authenticated
    USING (current_user_role() = 'MAIN_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY audit_insert ON audit_logs FOR INSERT TO authenticated
    WITH CHECK (is_active_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
