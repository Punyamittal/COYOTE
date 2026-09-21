-- Demo events (mark as demo via remarks). Requires at least one profile to exist for created_by.
-- Safe to run in development after creating INITIAL_ADMIN.

INSERT INTO events (
  date, start_time, end_time, name, registration_number, event_name, location,
  remarks, day_category, affected_slots
) VALUES
  (
    CURRENT_DATE,
    '10:10', '11:30',
    'Rahul Sharma', '24BAI1234', 'Internship PPT Round', 'MG Auditorium',
    '[DEMO] Fidelity Internship Round',
    'MULTI_SLOT',
    ARRAY['morning-3', 'morning-4']
  ),
  (
    CURRENT_DATE,
    '08:00', '08:50',
    'Ananya Gupta', '24BCE1098', 'Project Review', 'Lab 3',
    '[DEMO] Morning slot demo',
    'MORNING',
    ARRAY['morning-1']
  ),
  (
    CURRENT_DATE,
    '08:00', '13:20',
    'Vikram Patel', '24BCE2001', 'Department Orientation', 'Seminar Hall A',
    '[DEMO] Half day morning',
    'MORNING',
    ARRAY['morning-1','morning-2','morning-3','morning-4','morning-5','morning-6']
  ),
  (
    CURRENT_DATE,
    '14:00', '19:20',
    'Sneha Reddy', '24BAI2100', 'Hackathon Mentoring', 'Library Hall',
    '[DEMO] Half day evening',
    'EVENING',
    ARRAY['evening-1','evening-2','evening-3','evening-4','evening-5','evening-6']
  ),
  (
    CURRENT_DATE,
    '08:00', '19:20',
    'Arjun Mehta', '24BCE3001', 'Open House Coordination', 'Conference Room',
    '[DEMO] Full day event',
    'FULL_DAY',
    ARRAY['morning-1','morning-2','morning-3','morning-4','morning-5','morning-6','evening-1','evening-2','evening-3','evening-4','evening-5','evening-6']
  ),
  (
    CURRENT_DATE,
    '10:00', '11:00',
    'Rahul Sharma', '24BAI1234', 'Faculty Meeting', 'Conference Room',
    '[DEMO] Intentional person conflict with Internship PPT',
    'MULTI_SLOT',
    ARRAY['morning-3']
  ),
  (
    CURRENT_DATE,
    '10:15', '11:00',
    'Priya Nair', '24BAI1450', 'Guest Lecture Setup', 'MG Auditorium',
    '[DEMO] Intentional location conflict at MG Auditorium',
    'MULTI_SLOT',
    ARRAY['morning-3','morning-4']
  ),
  (
    CURRENT_DATE,
    '15:50', '16:40',
    'Karan Singh', '24BCE1555', 'Club Meeting', 'Lab 3',
    '[DEMO] Evening single slot',
    'EVENING',
    ARRAY['evening-3']
  ),
  (
    CURRENT_DATE + 1,
    '09:50', '10:40',
    'Meera Iyer', '24BAI1670', 'Research Presentation', 'Seminar Hall A',
    '[DEMO] Upcoming event',
    'MORNING',
    ARRAY['morning-3']
  ),
  (
    CURRENT_DATE + 2,
    '14:55', '16:40',
    'Dev Kapoor', '24BCE1800', 'Industry Visit Briefing', 'MG Auditorium',
    '[DEMO] Multi-slot evening',
    'MULTI_SLOT',
    ARRAY['evening-2','evening-3']
  );
