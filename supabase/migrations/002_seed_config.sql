-- Seed default time slots, locations, categories, permissions
-- Run after 001_initial_schema.sql
--
-- SAFE / ADDITIVE ONLY:
-- Inserts missing rows only. Never updates or deletes existing data.

INSERT INTO time_slots (id, label, start_time, end_time, category, display_order, active) VALUES
  ('morning-1', '08:00 AM – 08:50 AM', '08:00', '08:50', 'MORNING', 1, TRUE),
  ('morning-2', '08:55 AM – 09:45 AM', '08:55', '09:45', 'MORNING', 2, TRUE),
  ('morning-3', '09:50 AM – 10:40 AM', '09:50', '10:40', 'MORNING', 3, TRUE),
  ('morning-4', '10:45 AM – 11:35 AM', '10:45', '11:35', 'MORNING', 4, TRUE),
  ('morning-5', '11:40 AM – 12:30 PM', '11:40', '12:30', 'MORNING', 5, TRUE),
  ('morning-6', '12:30 PM – 01:20 PM', '12:30', '13:20', 'MORNING', 6, TRUE),
  ('evening-1', '02:00 PM – 02:50 PM', '14:00', '14:50', 'EVENING', 7, TRUE),
  ('evening-2', '02:55 PM – 03:45 PM', '14:55', '15:45', 'EVENING', 8, TRUE),
  ('evening-3', '03:50 PM – 04:40 PM', '15:50', '16:40', 'EVENING', 9, TRUE),
  ('evening-4', '04:45 PM – 05:35 PM', '16:45', '17:35', 'EVENING', 10, TRUE),
  ('evening-5', '05:40 PM – 06:30 PM', '17:40', '18:30', 'EVENING', 11, TRUE),
  ('evening-6', '06:30 PM – 07:20 PM', '18:30', '19:20', 'EVENING', 12, TRUE),
  ('half-day-morning', '08:00 AM – 01:20 PM', '08:00', '13:20', 'HALF_DAY_MORNING', 100, TRUE),
  ('half-day-evening', '02:00 PM – 07:20 PM', '14:00', '19:20', 'HALF_DAY_EVENING', 101, TRUE),
  ('full-day', '08:00 AM – 07:20 PM', '08:00', '19:20', 'FULL_DAY', 102, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO locations (name, description, active) VALUES
  ('MG Auditorium', 'Main auditorium', TRUE),
  ('Lab 3', 'Computer Lab 3', TRUE),
  ('Seminar Hall A', 'Seminar Hall A', TRUE),
  ('Conference Room', 'Admin conference room', TRUE),
  ('Library Hall', 'Central library hall', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO event_categories (name, color, active) VALUES
  ('Academic', '#1e5a8a', TRUE),
  ('Internship', '#2d6a4f', TRUE),
  ('Review', '#9a3412', TRUE),
  ('Meeting', '#4c1d95', TRUE),
  ('Other', '#475569', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Default permissions
INSERT INTO permissions (role, permission, enabled) VALUES
  ('MAIN_ADMIN', 'events:create', TRUE),
  ('MAIN_ADMIN', 'events:read', TRUE),
  ('MAIN_ADMIN', 'events:update', TRUE),
  ('MAIN_ADMIN', 'events:delete', TRUE),
  ('MAIN_ADMIN', 'events:export', TRUE),
  ('MAIN_ADMIN', 'events:import', TRUE),
  ('MAIN_ADMIN', 'events:bulk', TRUE),
  ('MAIN_ADMIN', 'users:manage', TRUE),
  ('MAIN_ADMIN', 'settings:manage', TRUE),
  ('MAIN_ADMIN', 'audit:read', TRUE),
  ('MAIN_ADMIN', 'conflicts:override', TRUE),
  ('MAIN_ADMIN', 'locations:manage', TRUE),
  ('MAIN_ADMIN', 'categories:manage', TRUE),
  ('MAIN_ADMIN', 'timeslots:manage', TRUE),
  ('MAIN_ADMIN', 'reports:read', TRUE),
  ('ADMIN', 'events:create', TRUE),
  ('ADMIN', 'events:read', TRUE),
  ('ADMIN', 'events:update', TRUE),
  ('ADMIN', 'events:delete', TRUE),
  ('ADMIN', 'events:export', TRUE),
  ('ADMIN', 'events:import', TRUE),
  ('ADMIN', 'events:bulk', TRUE),
  ('ADMIN', 'conflicts:override', TRUE),
  ('ADMIN', 'locations:manage', TRUE),
  ('ADMIN', 'categories:manage', TRUE),
  ('ADMIN', 'reports:read', TRUE),
  ('USER', 'events:create', TRUE),
  ('USER', 'events:read', TRUE),
  ('USER', 'events:update_own', TRUE),
  ('USER', 'events:delete_own', TRUE),
  ('USER', 'events:export', TRUE),
  ('USER', 'reports:read', TRUE)
ON CONFLICT (role, permission) DO NOTHING;

-- Only set defaults if the settings row is still at stock values
UPDATE system_settings SET
  institution_name = 'Institution Scheduling System',
  timezone = 'Asia/Kolkata'
WHERE id = 1
  AND institution_name = 'Institution'
  AND timezone = 'Asia/Kolkata';
