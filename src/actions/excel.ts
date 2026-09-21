"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { classifyEvent, normalizeTime } from "@/lib/time-slots";
import { mapEvent, type EventRow } from "@/lib/db/mappers";
import { exportEventsToExcel, parseImportExcel } from "@/lib/excel";
import type {
  EventFilters,
  ImportPreviewResult,
  ImportRow,
  ScheduleEvent,
} from "@/types";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function safeError(err: unknown): string {
  console.error(err);
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return "You must be logged in.";
    if (err.message === "ACCOUNT_DISABLED") return "Your account is disabled.";
    if (err.message === "FORBIDDEN") return "You do not have permission to perform this action.";
  }
  return "Something went wrong. Please try again.";
}

async function fetchEventsForExport(filters: EventFilters): Promise<ScheduleEvent[]> {
  const supabase = await createClient();
  let query = supabase.from("events").select("*");

  if (filters.date) query = query.eq("date", filters.date);
  if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("date", filters.dateTo);
  if (filters.name) query = query.ilike("name", `%${filters.name}%`);
  if (filters.registrationNumber)
    query = query.ilike("registration_number", `%${filters.registrationNumber}%`);
  if (filters.location) query = query.ilike("location", `%${filters.location}%`);
  if (filters.eventName) query = query.ilike("event_name", `%${filters.eventName}%`);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.createdBy) query = query.eq("created_by", filters.createdBy);
  if (filters.dayCategory === "HALF_DAY_MORNING") {
    query = query.eq("day_category", "MORNING").contains("affected_slots", [
      "morning-1",
      "morning-2",
      "morning-3",
      "morning-4",
      "morning-5",
      "morning-6",
    ]);
  } else if (filters.dayCategory === "HALF_DAY_EVENING") {
    query = query.eq("day_category", "EVENING");
  } else if (filters.dayCategory) {
    query = query.eq("day_category", filters.dayCategory);
  }
  if (filters.timeSlotId) {
    query = query.contains("affected_slots", [filters.timeSlotId]);
  }
  if (filters.search) {
    const s = filters.search.trim();
    query = query.or(
      `name.ilike.%${s}%,registration_number.ilike.%${s}%,event_name.ilike.%${s}%,location.ilike.%${s}%,remarks.ilike.%${s}%`
    );
  }

  const sortBy = filters.sortBy ?? "date";
  const sortDir = filters.sortDir !== "desc";
  const sortMap: Record<string, string> = {
    date: "date",
    name: "name",
    location: "location",
    eventName: "event_name",
    startTime: "start_time",
    registrationNumber: "registration_number",
  };
  query = query.order(sortMap[sortBy] ?? "date", { ascending: sortDir });
  if (sortBy === "date") {
    query = query.order("start_time", { ascending: true });
  }

  // Cap export size to keep memory bounded
  const { data, error } = await query.limit(10000);
  if (error) throw error;
  return ((data as EventRow[]) ?? []).map(mapEvent);
}

/**
 * Export filtered events as an .xlsx file (base64 payload).
 */
export async function exportEventsExcel(
  filters: EventFilters = {}
): Promise<ActionResult<{ base64: string; filename: string; count: number }>> {
  try {
    const user = await requireUser();
    if (!can(user, "events:export")) throw new Error("FORBIDDEN");

    const events = await fetchEventsForExport(filters);
    const buffer = await exportEventsToExcel(events);
    const base64 = buffer.toString("base64");

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `schedule-export-${stamp}.xlsx`;

    await writeAuditLog({
      userId: user.id,
      action: `exported ${events.length} events to Excel`,
      entityType: "event",
      newData: { count: events.length, filters },
    });

    return { success: true, data: { base64, filename, count: events.length } };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

/**
 * Decode a base64 .xlsx/.xls upload and return a validation preview.
 * Does not insert into the database.
 */
export async function previewImportExcel(
  base64: string
): Promise<ActionResult<ImportPreviewResult>> {
  try {
    const user = await requireUser();
    if (!can(user, "events:import")) throw new Error("FORBIDDEN");

    if (!base64?.trim()) {
      return { success: false, error: "No file data provided." };
    }

    const binary = Buffer.from(base64, "base64");
    const arrayBuffer = binary.buffer.slice(
      binary.byteOffset,
      binary.byteOffset + binary.byteLength
    );
    const result = parseImportExcel(arrayBuffer);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

/**
 * Insert previously validated import rows. Requires events:import.
 */
export async function commitImportExcel(
  rows: ImportRow[]
): Promise<ActionResult<{ inserted: number; ids: string[] }>> {
  try {
    const user = await requireUser();
    if (!can(user, "events:import")) throw new Error("FORBIDDEN");

    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, error: "No rows to import." };
    }

    const supabase = await createClient();
    const payload = rows.map((row) => {
      const startTime = normalizeTime(row.startTime);
      const endTime = normalizeTime(row.endTime);
      const classification = classifyEvent(startTime, endTime);
      return {
        date: row.date,
        start_time: startTime,
        end_time: endTime,
        name: row.name.trim(),
        registration_number: row.registrationNumber.trim(),
        event_name: row.eventName.trim(),
        location: row.location.trim(),
        remarks: row.remarks?.trim() || null,
        day_category: classification.dayCategory,
        affected_slots: classification.affectedSlots.map((s) => s.id),
        created_by: user.id,
        updated_by: user.id,
      };
    });

    const { data, error } = await supabase.from("events").insert(payload).select("id");
    if (error) throw error;

    const ids = ((data as { id: string }[]) ?? []).map((r) => r.id);

    await writeAuditLog({
      userId: user.id,
      action: `imported ${ids.length} events from Excel`,
      entityType: "event",
      newData: { count: ids.length, ids },
    });

    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath("/timetable");
    revalidatePath("/events");

    return { success: true, data: { inserted: ids.length, ids } };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}
