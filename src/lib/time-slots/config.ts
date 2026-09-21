import type { TimeSlot } from "@/types";

/**
 * Central time-slot configuration (Asia/Kolkata institutional schedule).
 * Seeded into DB; also used client/server for classification without a round-trip.
 */
export const DEFAULT_TIME_SLOTS: Omit<TimeSlot, "active">[] = [
  { id: "morning-1", label: "08:00 AM – 08:50 AM", startTime: "08:00", endTime: "08:50", category: "MORNING", displayOrder: 1 },
  { id: "morning-2", label: "08:55 AM – 09:45 AM", startTime: "08:55", endTime: "09:45", category: "MORNING", displayOrder: 2 },
  { id: "morning-3", label: "09:50 AM – 10:40 AM", startTime: "09:50", endTime: "10:40", category: "MORNING", displayOrder: 3 },
  { id: "morning-4", label: "10:45 AM – 11:35 AM", startTime: "10:45", endTime: "11:35", category: "MORNING", displayOrder: 4 },
  { id: "morning-5", label: "11:40 AM – 12:30 PM", startTime: "11:40", endTime: "12:30", category: "MORNING", displayOrder: 5 },
  { id: "morning-6", label: "12:30 PM – 01:20 PM", startTime: "12:30", endTime: "13:20", category: "MORNING", displayOrder: 6 },
  { id: "evening-1", label: "02:00 PM – 02:50 PM", startTime: "14:00", endTime: "14:50", category: "EVENING", displayOrder: 7 },
  { id: "evening-2", label: "02:55 PM – 03:45 PM", startTime: "14:55", endTime: "15:45", category: "EVENING", displayOrder: 8 },
  { id: "evening-3", label: "03:50 PM – 04:40 PM", startTime: "15:50", endTime: "16:40", category: "EVENING", displayOrder: 9 },
  { id: "evening-4", label: "04:45 PM – 05:35 PM", startTime: "16:45", endTime: "17:35", category: "EVENING", displayOrder: 10 },
  { id: "evening-5", label: "05:40 PM – 06:30 PM", startTime: "17:40", endTime: "18:30", category: "EVENING", displayOrder: 11 },
  { id: "evening-6", label: "06:30 PM – 07:20 PM", startTime: "18:30", endTime: "19:20", category: "EVENING", displayOrder: 12 },
];

export const HALF_DAY_MORNING = {
  id: "half-day-morning",
  label: "08:00 AM – 01:20 PM",
  startTime: "08:00",
  endTime: "13:20",
  category: "HALF_DAY_MORNING" as const,
};

export const HALF_DAY_EVENING = {
  id: "half-day-evening",
  label: "02:00 PM – 07:20 PM",
  startTime: "14:00",
  endTime: "19:20",
  category: "HALF_DAY_EVENING" as const,
};

export const FULL_DAY = {
  id: "full-day",
  label: "08:00 AM – 07:20 PM",
  startTime: "08:00",
  endTime: "19:20",
  category: "FULL_DAY" as const,
};

/** Excel / timetable column headers matching institutional format */
export const TIMETABLE_COLUMNS = [
  { key: "sl_no", header: "SL No" },
  { key: "date", header: "DATE" },
  { key: "half_day_morning", header: "HALF DAY Morning\n8:00 AM TO 1:20 PM" },
  { key: "half_day_evening", header: "HALF DAY Evening\n2:00 PM TO 7:20 PM" },
  { key: "full_day", header: "FULL DAY\n8:00 AM TO 7:20 PM" },
  { key: "morning-1", header: "8:00 AM TO 8:50 AM" },
  { key: "morning-2", header: "8:55 AM TO 9:45 AM" },
  { key: "morning-3", header: "09:50 AM TO 10:40 AM" },
  { key: "morning-4", header: "10:45 AM TO 11:35 AM" },
  { key: "morning-5", header: "11:40 AM TO 12:30 PM" },
  { key: "morning-6", header: "12:30 PM TO 1:20 PM" },
  { key: "evening-1", header: "2:00 PM TO 2:50 PM" },
  { key: "evening-2", header: "2:55 PM TO 3:45 PM" },
  { key: "evening-3", header: "3:50 PM TO 4:40 PM" },
  { key: "evening-4", header: "4:45 PM TO 5:35 PM" },
  { key: "evening-5", header: "5:40 PM TO 6:30 PM" },
  { key: "evening-6", header: "6:30 PM TO 7:20 PM" },
  { key: "remarks", header: "REMARKS" },
] as const;

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
