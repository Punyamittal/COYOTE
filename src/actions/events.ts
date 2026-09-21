"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { classifyEvent, detectConflicts, normalizeTime } from "@/lib/time-slots";
import { can, canDeleteEvent, canEditEvent } from "@/lib/permissions";
import { eventFormSchema } from "@/lib/validation";
import { mapEvent, type EventRow } from "@/lib/db/mappers";
import type { ConflictResult, EventFilters, PaginatedResult, ScheduleEvent } from "@/types";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; conflicts?: ConflictResult };

function safeError(err: unknown): string {
  console.error(err);
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return "You must be logged in.";
    if (err.message === "ACCOUNT_DISABLED") return "Your account is disabled.";
    if (err.message === "FORBIDDEN") return "You do not have permission to perform this action.";
  }
  return "Something went wrong. Please try again.";
}

export async function listEvents(
  filters: EventFilters = {}
): Promise<ActionResult<PaginatedResult<ScheduleEvent>>> {
  try {
    await requireUser();
    const supabase = await createClient();
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 50, 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const withCount = filters.countTotal !== false;
    let query = withCount
      ? supabase.from("events").select("*", { count: "exact" })
      : supabase.from("events").select("*");

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
    const sortDir = filters.sortDir === "asc";
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

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const events = (data as EventRow[]).map(mapEvent);
    const total = withCount ? (count ?? 0) : events.length;
    return {
      success: true,
      data: {
        data: events,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export async function getEvent(id: string): Promise<ActionResult<ScheduleEvent>> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
    if (error) throw error;
    return { success: true, data: mapEvent(data as EventRow) };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export async function checkEventConflicts(input: {
  id?: string;
  date: string;
  startTime: string;
  endTime: string;
  name: string;
  registrationNumber: string;
  location: string;
  eventName: string;
}): Promise<ActionResult<ConflictResult>> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.from("events").select("*").eq("date", input.date);
    if (error) throw error;
    const existing = (data as EventRow[]).map(mapEvent);
    return { success: true, data: detectConflicts(input, existing) };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export async function createEvent(
  raw: unknown
): Promise<ActionResult<ScheduleEvent & { conflicts?: ConflictResult }>> {
  try {
    const user = await requireUser();
    if (!can(user, "events:create")) throw new Error("FORBIDDEN");

    const parsed = eventFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const values = parsed.data;
    const startTime = normalizeTime(values.startTime);
    const endTime = normalizeTime(values.endTime);
    const classification = classifyEvent(startTime, endTime);

    const supabase = await createClient();
    const { data: sameDay } = await supabase.from("events").select("*").eq("date", values.date);
    const conflicts = detectConflicts(
      {
        date: values.date,
        startTime,
        endTime,
        name: values.name,
        registrationNumber: values.registrationNumber,
        location: values.location,
        eventName: values.eventName,
      },
      (sameDay as EventRow[] | null)?.map(mapEvent) ?? []
    );

    if (conflicts.hasConflicts && !values.overrideConflicts) {
      if (!can(user, "conflicts:override")) {
        return {
          success: false,
          error: "Scheduling conflict detected. An admin can override.",
          conflicts,
        };
      }
      return {
        success: false,
        error: "Scheduling conflict detected.",
        conflicts,
      };
    }

    if (conflicts.hasConflicts && values.overrideConflicts && !can(user, "conflicts:override")) {
      return { success: false, error: "You cannot override conflicts." };
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
        date: values.date,
        start_time: startTime,
        end_time: endTime,
        name: values.name,
        registration_number: values.registrationNumber,
        event_name: values.eventName,
        location: values.location,
        remarks: values.remarks ?? null,
        description: values.description ?? null,
        department: values.department ?? null,
        category_id: values.categoryId ?? null,
        organizer: values.organizer ?? null,
        contact_info: values.contactInfo ?? null,
        day_category: classification.dayCategory,
        affected_slots: classification.affectedSlots.map((s) => s.id),
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();

    if (error) throw error;
    const event = mapEvent(data as EventRow);
    await writeAuditLog({
      userId: user.id,
      action: "created event",
      entityType: "event",
      entityId: event.id,
      newData: event as unknown as Record<string, unknown>,
    });

    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath("/timetable");
    revalidatePath("/events");
    return { success: true, data: { ...event, conflicts } };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export async function updateEvent(
  id: string,
  raw: unknown
): Promise<ActionResult<ScheduleEvent>> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: existing, error: fetchErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;
    const current = mapEvent(existing as EventRow);
    if (!canEditEvent(user, current.createdBy)) throw new Error("FORBIDDEN");

    const parsed = eventFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const values = parsed.data;
    const startTime = normalizeTime(values.startTime);
    const endTime = normalizeTime(values.endTime);
    const classification = classifyEvent(startTime, endTime);

    const { data: sameDay } = await supabase.from("events").select("*").eq("date", values.date);
    const conflicts = detectConflicts(
      {
        id,
        date: values.date,
        startTime,
        endTime,
        name: values.name,
        registrationNumber: values.registrationNumber,
        location: values.location,
        eventName: values.eventName,
      },
      (sameDay as EventRow[] | null)?.map(mapEvent) ?? []
    );

    if (conflicts.hasConflicts && !values.overrideConflicts) {
      return { success: false, error: "Scheduling conflict detected.", conflicts };
    }
    if (conflicts.hasConflicts && values.overrideConflicts && !can(user, "conflicts:override")) {
      return { success: false, error: "You cannot override conflicts." };
    }

    const { data, error } = await supabase
      .from("events")
      .update({
        date: values.date,
        start_time: startTime,
        end_time: endTime,
        name: values.name,
        registration_number: values.registrationNumber,
        event_name: values.eventName,
        location: values.location,
        remarks: values.remarks ?? null,
        description: values.description ?? null,
        department: values.department ?? null,
        category_id: values.categoryId ?? null,
        organizer: values.organizer ?? null,
        contact_info: values.contactInfo ?? null,
        day_category: classification.dayCategory,
        affected_slots: classification.affectedSlots.map((s) => s.id),
        updated_by: user.id,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    const event = mapEvent(data as EventRow);
    await writeAuditLog({
      userId: user.id,
      action: "updated event",
      entityType: "event",
      entityId: id,
      oldData: current as unknown as Record<string, unknown>,
      newData: event as unknown as Record<string, unknown>,
    });

    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath("/timetable");
    revalidatePath("/events");
    return { success: true, data: event };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export async function deleteEvent(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: existing, error: fetchErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;
    const current = mapEvent(existing as EventRow);
    if (!canDeleteEvent(user, current.createdBy)) throw new Error("FORBIDDEN");

    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      userId: user.id,
      action: "deleted event",
      entityType: "event",
      entityId: id,
      oldData: current as unknown as Record<string, unknown>,
    });

    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath("/timetable");
    revalidatePath("/events");
    return { success: true, data: { id } };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export async function bulkDeleteEvents(ids: string[]): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    if (!can(user, "events:bulk")) throw new Error("FORBIDDEN");
    const supabase = await createClient();
    const { error, count } = await supabase
      .from("events")
      .delete({ count: "exact" })
      .in("id", ids);
    if (error) throw error;
    await writeAuditLog({
      userId: user.id,
      action: `bulk deleted ${ids.length} events`,
      entityType: "event",
      newData: { ids },
    });
    revalidatePath("/events");
    revalidatePath("/timetable");
    revalidatePath("/calendar");
    return { success: true, data: { count: count ?? ids.length } };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export async function bulkUpdateEvents(
  ids: string[],
  patch: { location?: string; date?: string; categoryId?: string | null }
): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    if (!can(user, "events:bulk")) throw new Error("FORBIDDEN");
    const supabase = await createClient();
    const update: Record<string, unknown> = { updated_by: user.id };
    if (patch.location !== undefined) update.location = patch.location;
    if (patch.date !== undefined) update.date = patch.date;
    if (patch.categoryId !== undefined) update.category_id = patch.categoryId;

    const { error, count } = await supabase
      .from("events")
      .update(update, { count: "exact" })
      .in("id", ids);
    if (error) throw error;
    await writeAuditLog({
      userId: user.id,
      action: `bulk updated ${ids.length} events`,
      entityType: "event",
      newData: { ids, patch },
    });
    revalidatePath("/events");
    return { success: true, data: { count: count ?? ids.length } };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}
