"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { isAdminOrAbove, isMainAdmin } from "@/lib/permissions";
import { formatTime12h, normalizeTime } from "@/lib/time-slots";

export type OdSlot = {
  id?: string;
  startTime: string;
  endTime: string;
  status?: OdStatus | null;
};

export type OdStatus = "pending" | "approved" | "rejected";

export type OdRequest = {
  id: string;
  profileId: string;
  eventId: string | null;
  eventName: string | null;
  date: string;
  name: string;
  userId: string;
  status: OdStatus | null;
  reason: string;
  slots: OdSlot[];
};

type Result<T> = { success: true; data: T } | { success: false; error: string };

function odSelect(withSlotStatus: boolean, withReason = true) {
  const slots = withSlotStatus
    ? "od_request_slots(id, start_time, end_time, position, status)"
    : "od_request_slots(id, start_time, end_time, position)";
  const reason = withReason ? "reason, " : "";
  return `id, profile_id, event_id, date, status, ${reason}start_time, end_time, start_time_2, end_time_2, profiles!profile_id(name, user_id), events!event_id(event_name), ${slots}`;
}

function missingSlotStatus(message: string | undefined) {
  return Boolean(message && message.includes("od_request_slots") && message.includes("status"));
}

async function selectOd(
  supabase: Awaited<ReturnType<typeof createClient>>,
  apply: (
    query: ReturnType<ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>["select"]>
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>
) {
  let withSlots = true;
  let withReason = true;
  let result = await apply(supabase.from("od_requests").select(odSelect(withSlots, withReason)));
  if (missingSlotStatus(result.error?.message)) {
    withSlots = false;
    result = await apply(supabase.from("od_requests").select(odSelect(withSlots, withReason)));
  }
  if (result.error?.message.includes("reason")) {
    withReason = false;
    result = await apply(supabase.from("od_requests").select(odSelect(withSlots, withReason)));
  }
  return result;
}

function trimTime(t: string | null | undefined): string {
  return t ? String(t).slice(0, 5) : "";
}

type SlotRow = {
  id?: string;
  start_time: string;
  end_time: string;
  position: number;
  status?: OdStatus | null;
};

function slotsFromRow(row: {
  start_time: string;
  end_time: string;
  start_time_2: string | null;
  end_time_2: string | null;
  od_request_slots?: SlotRow[] | null;
}): OdSlot[] {
  const nested = row.od_request_slots ?? [];
  if (nested.length > 0) {
    return [...nested]
      .sort((a, b) => a.position - b.position)
      .map((slot) => ({
        id: slot.id,
        startTime: trimTime(slot.start_time),
        endTime: trimTime(slot.end_time),
        status: (slot.status ?? "pending") as OdStatus,
      }));
  }
  const slots: OdSlot[] = [
    {
      startTime: trimTime(row.start_time),
      endTime: trimTime(row.end_time),
      status: "pending",
    },
  ];
  if (row.start_time_2 && row.end_time_2) {
    slots.push({
      startTime: trimTime(row.start_time_2),
      endTime: trimTime(row.end_time_2),
      status: "pending",
    });
  }
  return slots;
}

type NameRow = { name: string; user_id: string };
type EventNameRow = { event_name: string };

type OdRow = {
  id: string;
  profile_id: string;
  event_id: string | null;
  date: string;
  status?: OdStatus | null;
  reason?: string | null;
  start_time: string;
  end_time: string;
  start_time_2: string | null;
  end_time_2: string | null;
  od_request_slots?: SlotRow[] | null;
  profiles: NameRow | NameRow[] | null;
  events?: EventNameRow | EventNameRow[] | null;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapRow(row: OdRow, revealStatus: boolean): OdRequest {
  const profile = firstOf(row.profiles);
  const event = firstOf(row.events);
  const slots = slotsFromRow(row).map((slot) => ({
    ...slot,
    status: revealStatus ? (slot.status ?? "pending") : null,
  }));
  const visible = slots.map((slot) => slot.status).filter((status): status is OdStatus => Boolean(status));
  const shared = visible.length > 0 && visible.every((status) => status === visible[0]) ? visible[0] : null;
  return {
    id: row.id,
    profileId: row.profile_id,
    eventId: row.event_id,
    eventName: event?.event_name ?? null,
    date: String(row.date).slice(0, 10),
    name: profile?.name ?? "Student",
    userId: profile?.user_id ?? "",
    status: revealStatus ? shared : null,
    reason: revealStatus ? (row.reason ?? "").trim() : "",
    slots,
  };
}

function cleanReason(reason: string | undefined): string | null {
  const text = (reason ?? "").trim();
  if (!text) return null;
  if (text.length > 500) return null;
  return text;
}

function validateSlots(slots: OdSlot[], bounds?: { start: string; end: string }): string | null {
  if (slots.length < 1) return "Add at least one time range.";
  let normalized: OdSlot[];
  try {
    normalized = slots.map((slot) => ({
      startTime: normalizeTime(slot.startTime),
      endTime: normalizeTime(slot.endTime),
    }));
  } catch (err) {
    return err instanceof Error ? err.message : "Enter a valid time.";
  }
  for (const slot of normalized) {
    if (slot.endTime <= slot.startTime) return "Each end time must be later than its start time.";
    if (bounds && (slot.startTime < bounds.start || slot.endTime > bounds.end)) {
      return `Times must fall within the event (${bounds.start} – ${bounds.end}).`;
    }
  }
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i];
      const b = normalized[j];
      if (a.startTime < b.endTime && b.startTime < a.endTime) {
        return "Time ranges must not overlap.";
      }
    }
  }
  return null;
}

async function replaceSlots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  slots: OdSlot[]
) {
  const { data: existing, error: loadError } = await supabase
    .from("od_request_slots")
    .select("id, start_time, end_time")
    .eq("od_request_id", requestId);
  if (loadError) return loadError.message;

  const pool = [...(existing ?? [])];
  for (let index = 0; index < slots.length; index++) {
    const start = normalizeTime(slots[index].startTime);
    const end = normalizeTime(slots[index].endTime);
    const matchIndex = pool.findIndex(
      (row) => trimTime(row.start_time) === start && trimTime(row.end_time) === end
    );
    if (matchIndex >= 0) {
      const match = pool.splice(matchIndex, 1)[0];
      const { error } = await supabase
        .from("od_request_slots")
        .update({ position: index + 1 })
        .eq("id", match.id);
      if (error) return error.message;
      continue;
    }
    const { error } = await supabase.from("od_request_slots").insert({
      od_request_id: requestId,
      start_time: start,
      end_time: end,
      position: index + 1,
    });
    if (error) return error.message;
  }

  if (pool.length > 0) {
    const { error } = await supabase
      .from("od_request_slots")
      .delete()
      .in(
        "id",
        pool.map((row) => row.id)
      );
    if (error) return error.message;
  }
  return null;
}

async function upsertMine(input: {
  eventId: string | null;
  date: string;
  slots: OdSlot[];
  reason: string;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const normalized = input.slots.map((slot) => ({
    startTime: normalizeTime(slot.startTime),
    endTime: normalizeTime(slot.endTime),
  }));
  const payload = {
    profile_id: user.id,
    event_id: input.eventId,
    date: input.date,
    start_time: normalized[0].startTime,
    end_time: normalized[0].endTime,
    start_time_2: normalized[1]?.startTime ?? null,
    end_time_2: normalized[1]?.endTime ?? null,
    reason: input.reason,
  };

  let query = supabase.from("od_requests").select("id").eq("profile_id", user.id);
  query = input.eventId ? query.eq("event_id", input.eventId) : query.is("event_id", null).eq("date", input.date);
  const { data: existing, error: findError } = await query.maybeSingle();
  if (findError) return { success: false as const, error: findError.message };

  const write = existing
    ? supabase.from("od_requests").update(payload).eq("id", existing.id)
    : supabase.from("od_requests").insert(payload);

  const { data, error } = await write.select("id").single();
  if (error) return { success: false as const, error: error.message };

  const slotError = await replaceSlots(supabase, data.id, normalized);
  if (slotError) return { success: false as const, error: slotError };

  const { data: fresh, error: freshError } = await selectOd(supabase, (query) =>
    query.eq("id", data.id).single()
  );
  if (freshError) return { success: false as const, error: freshError.message };

  revalidatePath("/calendar");
  revalidatePath("/reports");
  revalidatePath("/od");
  if (input.eventId) revalidatePath(`/events/${input.eventId}`);

  return { success: true as const, data: mapRow(fresh as OdRow, true) };
}

export async function listEventOd(
  eventId: string
): Promise<Result<{ requests: OdRequest[]; myProfileId: string }>> {
  try {
    const me = await requireUser();
    const supabase = await createClient();
    const { data, error } = await selectOd(supabase, (query) =>
      query.eq("event_id", eventId).order("start_time")
    );
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: {
        myProfileId: me.id,
        requests: ((data ?? []) as OdRow[]).map((row) =>
          mapRow(row, row.profile_id === me.id)
        ),
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to load OD requests." };
  }
}

export async function saveEventOd(input: {
  eventId: string;
  slots: OdSlot[];
  reason: string;
}): Promise<Result<OdRequest>> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: event, error } = await supabase
      .from("events")
      .select("id, date, start_time, end_time")
      .eq("id", input.eventId)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!event) return { success: false, error: "Event not found." };

    const problem = validateSlots(input.slots, {
      start: trimTime(event.start_time),
      end: trimTime(event.end_time),
    });
    if (problem) return { success: false, error: problem };
    const reason = cleanReason(input.reason);
    if (!reason) return { success: false, error: "Enter a reason for this OD." };

    return upsertMine({
      eventId: input.eventId,
      date: String(event.date).slice(0, 10),
      slots: input.slots,
      reason,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to save OD." };
  }
}

export async function listMyOd(from: string, to: string): Promise<Result<OdRequest[]>> {
  try {
    const me = await requireUser();
    const supabase = await createClient();
    const { data, error } = await selectOd(supabase, (query) =>
      query.eq("profile_id", me.id).gte("date", from).lte("date", to).order("date")
    );
    if (error) return { success: false, error: error.message };
    return { success: true, data: ((data ?? []) as OdRow[]).map((row) => mapRow(row, true)) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to load OD." };
  }
}

export async function getMyFreeOd(date: string): Promise<Result<OdRequest | null>> {
  try {
    const me = await requireUser();
    const supabase = await createClient();
    const { data, error } = await selectOd(supabase, (query) =>
      query.eq("profile_id", me.id).is("event_id", null).eq("date", date).maybeSingle()
    );
    if (error) return { success: false, error: error.message };
    return { success: true, data: data ? mapRow(data as OdRow, true) : null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to load OD." };
  }
}

export async function saveFreeOd(input: {
  date: string;
  slots: OdSlot[];
  reason: string;
}): Promise<Result<OdRequest>> {
  try {
    if (!input.date) return { success: false, error: "Choose a date." };
    const problem = validateSlots(input.slots);
    if (problem) return { success: false, error: problem };
    const reason = cleanReason(input.reason);
    if (!reason) return { success: false, error: "Enter a reason for this OD." };
    return upsertMine({ eventId: null, date: input.date, slots: input.slots, reason });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to save OD." };
  }
}

export async function loadOdReview(): Promise<
  Result<{ requests: OdRequest[]; events: CalendarEventReview[] }>
> {
  const [requests, events] = await Promise.all([listOdForReview(), listCalendarEventsForReview()]);
  if (!requests.success) return { success: false, error: requests.error };
  if (!events.success) return { success: false, error: events.error };
  return { success: true, data: { requests: requests.data, events: events.data } };
}

export async function listOdForReview(): Promise<Result<OdRequest[]>> {
  try {
    const me = await requireUser();
    if (!isMainAdmin(me)) return { success: false, error: "Only the main admin can review OD." };
    const supabase = await createClient();
    const { data, error } = await selectOd(supabase, (query) =>
      query.order("date", { ascending: false }).order("start_time")
    );
    if (error) return { success: false, error: error.message };
    const rows = ((data ?? []) as OdRow[]).map((row) => mapRow(row, true));
    const rank = (row: OdRequest) => {
      if (row.slots.some((slot) => (slot.status ?? "pending") === "pending")) return 0;
      if (row.slots.some((slot) => slot.status === "rejected")) return 1;
      return 2;
    };
    rows.sort((a, b) => rank(a) - rank(b) || b.date.localeCompare(a.date));
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to load OD requests." };
  }
}

export type CalendarEventReview = {
  id: string;
  eventName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: OdStatus;
};

function mapCalendarEvent(row: {
  id: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  od_status?: OdStatus | null;
}): CalendarEventReview {
  return {
    id: row.id,
    eventName: row.event_name,
    date: String(row.date).slice(0, 10),
    startTime: trimTime(row.start_time),
    endTime: trimTime(row.end_time),
    location: row.location,
    status: row.od_status ?? "pending",
  };
}

export async function listCalendarEventsForReview(): Promise<Result<CalendarEventReview[]>> {
  try {
    const me = await requireUser();
    if (!isMainAdmin(me)) return { success: false, error: "Only the main admin can review OD." };
    const supabase = await createClient();
    const full = await supabase
      .from("events")
      .select("id, event_name, date, start_time, end_time, location, od_status")
      .order("date", { ascending: false })
      .order("start_time", { ascending: true });
    const missing = full.error?.message.includes("od_status");
    const result = missing
      ? await supabase
          .from("events")
          .select("id, event_name, date, start_time, end_time, location")
          .order("date", { ascending: false })
          .order("start_time", { ascending: true })
      : full;
    if (result.error) return { success: false, error: result.error.message };
    const rows = ((result.data ?? []) as Parameters<typeof mapCalendarEvent>[0][]).map(mapCalendarEvent);
    const rank: Record<OdStatus, number> = { pending: 0, rejected: 1, approved: 2 };
    rows.sort((a, b) => rank[a.status] - rank[b.status] || b.date.localeCompare(a.date));
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to load calendar events." };
  }
}

export async function reviewCalendarEvent(
  id: string,
  status: Exclude<OdStatus, "pending">
): Promise<Result<null>> {
  try {
    const me = await requireUser();
    if (!isMainAdmin(me)) return { success: false, error: "Only the main admin can review OD." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("events")
      .update({
        od_status: status,
        od_reviewed_by: me.id,
        od_reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/calendar");
    revalidatePath("/reports");
    revalidatePath("/od");
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to update the event." };
  }
}

export async function reviewOdSlot(
  slotId: string,
  status: Exclude<OdStatus, "pending">
): Promise<Result<null>> {
  try {
    const me = await requireUser();
    if (!isMainAdmin(me)) return { success: false, error: "Only the main admin can review OD." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("od_request_slots")
      .update({
        status,
        reviewed_by: me.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", slotId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/calendar");
    revalidatePath("/reports");
    revalidatePath("/od");
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to update OD." };
  }
}

export async function removeMyOd(id: string): Promise<Result<null>> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("od_requests")
      .delete()
      .eq("id", id)
      .eq("profile_id", user.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/calendar");
    revalidatePath("/od");
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to remove OD." };
  }
}

export type OdCount = {
  applied: number;
  approved: number;
  rejected: number;
  pending: number;
};

export type MyOdSummary = {
  total: OdCount;
  calendar: OdCount;
  requests: OdRequest[];
  calendarEvents: CalendarEventReview[];
};

function countStatuses(statuses: OdStatus[]): OdCount {
  return {
    applied: statuses.length,
    approved: statuses.filter((status) => status === "approved").length,
    rejected: statuses.filter((status) => status === "rejected").length,
    pending: statuses.filter((status) => status === "pending").length,
  };
}

async function loadOwnedCalendarEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string
) {
  const full = await supabase
    .from("events")
    .select("id, event_name, date, start_time, end_time, location, od_status")
    .eq("created_by", profileId)
    .order("date", { ascending: false });
  if (full.error?.message.includes("od_status")) {
    const plain = await supabase
      .from("events")
      .select("id, event_name, date, start_time, end_time, location")
      .eq("created_by", profileId)
      .order("date", { ascending: false });
    if (plain.error) return { error: plain.error.message, events: [] as CalendarEventReview[] };
    return {
      error: null,
      events: ((plain.data ?? []) as Parameters<typeof mapCalendarEvent>[0][]).map(mapCalendarEvent),
    };
  }
  if (full.error) return { error: full.error.message, events: [] as CalendarEventReview[] };
  return {
    error: null,
    events: ((full.data ?? []) as Parameters<typeof mapCalendarEvent>[0][]).map(mapCalendarEvent),
  };
}

export async function getMyOdSummary(): Promise<Result<MyOdSummary>> {
  try {
    const me = await requireUser();
    const supabase = await createClient();
    const [selected, owned] = await Promise.all([
      selectOd(supabase, (query) => query.eq("profile_id", me.id).order("date", { ascending: false })),
      loadOwnedCalendarEvents(supabase, me.id),
    ]);
    if (selected.error) return { success: false, error: selected.error.message };
    const requests = ((selected.data ?? []) as OdRow[]).map((row) => mapRow(row, true));
    if (owned.error) return { success: false, error: owned.error };

    const applicationStatuses = requests.flatMap((row) =>
      row.slots.map((slot) => slot.status ?? "pending")
    );
    const calendarStatuses = [
      ...requests
        .filter((row) => row.eventId)
        .flatMap((row) => row.slots.map((slot) => slot.status ?? "pending")),
      ...owned.events.map((event) => event.status),
    ];
    return {
      success: true,
      data: {
        total: countStatuses([...applicationStatuses, ...owned.events.map((event) => event.status)]),
        calendar: countStatuses(calendarStatuses),
        requests,
        calendarEvents: owned.events,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to load your OD." };
  }
}

export async function exportAllOdExcel(): Promise<
  Result<{ base64: string; filename: string; count: number }>
> {
  try {
    const me = await requireUser();
    if (!isAdminOrAbove(me)) return { success: false, error: "Only an admin can export OD." };
    const supabase = await createClient();
    const { data, error } = await selectOd(supabase, (query) =>
      query.order("date", { ascending: false }).order("start_time")
    );
    if (error) return { success: false, error: error.message };
    const requests = ((data ?? []) as OdRow[]).map((row) => mapRow(row, true));

    const eventsResult = await supabase
      .from("events")
      .select("id, event_name, date, start_time, end_time, location, od_status")
      .order("date", { ascending: false });
    const events = eventsResult.error?.message.includes("od_status")
      ? []
      : ((eventsResult.data ?? []) as Parameters<typeof mapCalendarEvent>[0][]).map(mapCalendarEvent);
    if (eventsResult.error && !eventsResult.error.message.includes("od_status")) {
      return { success: false, error: eventsResult.error.message };
    }

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const applications = workbook.addWorksheet("OD applications");
    applications.addRow([
      "Student",
      "Login ID",
      "Date",
      "Source",
      "Event",
      "From",
      "Until",
      "Status",
      "Reason",
    ]);
    applications.getRow(1).font = { bold: true };
    for (const request of requests) {
      for (const slot of request.slots) {
        applications.addRow([
          request.name,
          request.userId,
          request.date,
          request.eventId ? "Calendar event" : "No event",
          request.eventName ?? "",
          formatTime12h(slot.startTime),
          formatTime12h(slot.endTime),
          slot.status ?? "pending",
          request.reason,
        ]);
      }
    }
    applications.columns.forEach((column) => {
      column.width = 22;
    });

    const calendar = workbook.addWorksheet("Calendar events");
    calendar.addRow(["Event", "Date", "From", "Until", "Location", "Status"]);
    calendar.getRow(1).font = { bold: true };
    for (const event of events) {
      calendar.addRow([
        event.eventName,
        event.date,
        formatTime12h(event.startTime),
        formatTime12h(event.endTime),
        event.location,
        event.status,
      ]);
    }
    calendar.columns.forEach((column) => {
      column.width = 22;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const count = requests.reduce((sum, request) => sum + request.slots.length, 0) + events.length;
    return {
      success: true,
      data: {
        base64,
        filename: `coyote-od-${new Date().toISOString().slice(0, 10)}.xlsx`,
        count,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unable to export OD." };
  }
}
