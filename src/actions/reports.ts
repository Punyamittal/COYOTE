"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { mapEvent, type EventRow } from "@/lib/db/mappers";
import { todayIST } from "@/lib/utils";
import { DEFAULT_TIME_SLOTS } from "@/lib/time-slots";
import type { ScheduleEvent } from "@/types";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function safeError(err: unknown): string {
  console.error(err);
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return "You must be logged in.";
    if (err.message === "ACCOUNT_DISABLED") return "Your account is disabled.";
    if (err.message === "FORBIDDEN") return "You do not have permission to perform this action.";
  }
  return "Unable to load report.";
}

async function requireReportsAccess() {
  const user = await requireUser();
  if (!can(user, "reports:read")) throw new Error("FORBIDDEN");
  return user;
}

async function fetchEvents(opts: {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  name?: string;
  registrationNumber?: string;
  location?: string;
}): Promise<ScheduleEvent[]> {
  const supabase = await createClient();
  let query = supabase.from("events").select("*");

  if (opts.date) query = query.eq("date", opts.date);
  if (opts.dateFrom) query = query.gte("date", opts.dateFrom);
  if (opts.dateTo) query = query.lte("date", opts.dateTo);
  if (opts.name) query = query.ilike("name", `%${opts.name}%`);
  if (opts.registrationNumber)
    query = query.ilike("registration_number", `%${opts.registrationNumber}%`);
  if (opts.location) query = query.ilike("location", `%${opts.location}%`);

  query = query.order("date", { ascending: true }).order("start_time", { ascending: true }).limit(5000);

  const { data, error } = await query;
  if (error) throw error;
  return ((data as EventRow[]) ?? []).map(mapEvent);
}

export type DailyReportData = {
  date: string;
  total: number;
  morning: number;
  evening: number;
  fullDay: number;
  events: ScheduleEvent[];
};

export async function getDailyReport(
  date?: string
): Promise<ActionResult<DailyReportData>> {
  try {
    await requireReportsAccess();
    const day = date || todayIST();
    const events = await fetchEvents({ date: day });
    return {
      success: true,
      data: {
        date: day,
        total: events.length,
        morning: events.filter((e) => e.dayCategory === "MORNING" || e.dayCategory === "MULTI_SLOT")
          .length,
        evening: events.filter((e) => e.dayCategory === "EVENING").length,
        fullDay: events.filter((e) => e.dayCategory === "FULL_DAY").length,
        events,
      },
    };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export type DateRangeReportData = {
  dateFrom: string;
  dateTo: string;
  total: number;
  byDate: { date: string; count: number }[];
  events: ScheduleEvent[];
};

export async function getDateRangeReport(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<DateRangeReportData>> {
  try {
    await requireReportsAccess();
    if (!dateFrom || !dateTo) {
      return { success: false, error: "Start and end dates are required." };
    }
    const events = await fetchEvents({ dateFrom, dateTo });
    const counts = new Map<string, number>();
    for (const e of events) {
      counts.set(e.date, (counts.get(e.date) ?? 0) + 1);
    }
    const byDate = [...counts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      data: { dateFrom, dateTo, total: events.length, byDate, events },
    };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export type LocationUtilizationRow = {
  location: string;
  eventCount: number;
  uniqueDates: number;
  uniquePeople: number;
};

export async function getLocationUtilization(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ dateFrom: string; dateTo: string; rows: LocationUtilizationRow[] }>> {
  try {
    await requireReportsAccess();
    const events = await fetchEvents({ dateFrom, dateTo });
    const map = new Map<
      string,
      { eventCount: number; dates: Set<string>; people: Set<string> }
    >();

    for (const e of events) {
      const key = e.location.trim() || "(unnamed)";
      let entry = map.get(key);
      if (!entry) {
        entry = { eventCount: 0, dates: new Set(), people: new Set() };
        map.set(key, entry);
      }
      entry.eventCount += 1;
      entry.dates.add(e.date);
      entry.people.add(`${e.name}|${e.registrationNumber}`);
    }

    const rows = [...map.entries()]
      .map(([location, v]) => ({
        location,
        eventCount: v.eventCount,
        uniqueDates: v.dates.size,
        uniquePeople: v.people.size,
      }))
      .sort((a, b) => b.eventCount - a.eventCount);

    return { success: true, data: { dateFrom, dateTo, rows } };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export type PersonReportRow = {
  name: string;
  registrationNumber: string;
  eventCount: number;
  locations: string[];
  events: ScheduleEvent[];
};

export async function getPersonReport(opts: {
  query?: string;
  registrationNumber?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ActionResult<{ rows: PersonReportRow[]; events: ScheduleEvent[] }>> {
  try {
    await requireReportsAccess();
    const events = await fetchEvents({
      name: opts.query,
      registrationNumber: opts.registrationNumber,
      dateFrom: opts.dateFrom,
      dateTo: opts.dateTo,
    });

    const map = new Map<string, PersonReportRow>();
    for (const e of events) {
      const key = `${e.registrationNumber}::${e.name}`.toLowerCase();
      let row = map.get(key);
      if (!row) {
        row = {
          name: e.name,
          registrationNumber: e.registrationNumber,
          eventCount: 0,
          locations: [],
          events: [],
        };
        map.set(key, row);
      }
      row.eventCount += 1;
      row.events.push(e);
      if (!row.locations.includes(e.location)) row.locations.push(e.location);
    }

    const rows = [...map.values()].sort((a, b) => b.eventCount - a.eventCount);
    return { success: true, data: { rows, events } };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}

export type TimeSlotUtilizationRow = {
  slotId: string;
  label: string;
  category: string;
  eventCount: number;
};

export async function getTimeSlotUtilization(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ dateFrom: string; dateTo: string; rows: TimeSlotUtilizationRow[] }>> {
  try {
    await requireReportsAccess();
    const events = await fetchEvents({ dateFrom, dateTo });
    const counts = new Map<string, number>();

    for (const e of events) {
      for (const slotId of e.affectedSlots) {
        counts.set(slotId, (counts.get(slotId) ?? 0) + 1);
      }
    }

    const rows = DEFAULT_TIME_SLOTS.map((s) => ({
      slotId: s.id,
      label: s.label,
      category: s.category,
      eventCount: counts.get(s.id) ?? 0,
    }));

    return { success: true, data: { dateFrom, dateTo, rows } };
  } catch (err) {
    return { success: false, error: safeError(err) };
  }
}
