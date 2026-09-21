# ScheduleHub — Event & Activity Scheduling Management System

Production-oriented Next.js app for institutional event scheduling, timetable views, conflict detection, Excel export/import, and role-based administration.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL + Auth)
- FullCalendar, TanStack Table, ExcelJS, React Hook Form, Zod

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in keys.
3. Run SQL migrations in the Supabase SQL editor (in order):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_config.sql`
   - Optionally `supabase/seed/demo_events.sql` after creating the Main Admin
4. Install and run:

```bash
npm install
npm run dev
```

5. Open `/login` → **Run initial Main Admin setup** (uses `INITIAL_ADMIN_*` env vars).
6. Sign in and change the password when prompted.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Vitest (time slots, conflicts, permissions) |
| `npm run typecheck` | TypeScript check |

## Roles

- **MAIN_ADMIN** — full control (users, settings, audit, overrides). Final Main Admin cannot be deleted/demoted.
- **ADMIN** — manage events, export/import, locations/categories.
- **USER** — view calendar/timetable, manage own events, export.

## Time slots

Central config: `src/lib/time-slots/`. Events are auto-classified into morning/evening slots, half-day, or full-day. Duration events span all overlapping slots.

## Excel

- **Export Excel** on Events and Timetable supports current view, selected date, date range, or all records (Timetable / All Events / Morning / Evening / Conflicts / Summary sheets).
- **Import Excel** uploads a file, validates rows, shows a preview + errors, then commits only valid records.

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Never commit real passwords or `.env.local`.
- All mutations authorize on the server via session role checks.
# COYOTE
# COYOTE
