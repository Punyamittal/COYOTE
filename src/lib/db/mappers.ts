import type { ScheduleEvent } from "@/types";

export type EventRow = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  name: string;
  registration_number: string;
  event_name: string;
  location: string;
  remarks: string | null;
  description: string | null;
  department: string | null;
  category_id: string | null;
  organizer: string | null;
  contact_info: string | null;
  day_category: ScheduleEvent["dayCategory"];
  affected_slots: string[] | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

function trimTime(t: string): string {
  // Postgres TIME may come as HH:MM:SS
  return t.slice(0, 5);
}

export function mapEvent(row: EventRow): ScheduleEvent {
  return {
    id: row.id,
    date: row.date,
    startTime: trimTime(row.start_time),
    endTime: trimTime(row.end_time),
    name: row.name,
    registrationNumber: row.registration_number,
    eventName: row.event_name,
    location: row.location,
    remarks: row.remarks,
    description: row.description,
    department: row.department,
    categoryId: row.category_id,
    organizer: row.organizer,
    contactInfo: row.contact_info,
    dayCategory: row.day_category,
    affectedSlots: row.affected_slots ?? [],
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
