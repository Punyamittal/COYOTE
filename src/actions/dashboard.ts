"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { detectConflicts } from "@/lib/time-slots";
import { mapEvent, type EventRow } from "@/lib/db/mappers";
import { todayIST } from "@/lib/utils";
import type { DashboardStats, ScheduleEvent } from "@/types";

export async function getDashboardStats(): Promise<
  { success: true; data: DashboardStats } | { success: false; error: string }
> {
  try {
    await requireUser();
    const supabase = await createClient();
    const today = todayIST();

    const { count: totalEvents } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true });

    const { data: todayRows } = await supabase.from("events").select("*").eq("date", today);
    const todayEvents = (todayRows as EventRow[] | null)?.map(mapEvent) ?? [];

    const { count: upcoming } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .gt("date", today);

    const locations = new Set(todayEvents.map((e) => e.location.toLowerCase()));

    let conflicts = 0;
    for (let i = 0; i < todayEvents.length; i++) {
      const result = detectConflicts(todayEvents[i], todayEvents);
      if (result.hasConflicts) conflicts += 1;
    }
    // Each conflict counted twice potentially — use unique pairs approximation
    conflicts = Math.floor(conflicts / 2);

    const stats: DashboardStats = {
      todayTotal: todayEvents.length,
      todayMorning: todayEvents.filter((e) => e.dayCategory === "MORNING" || e.dayCategory === "MULTI_SLOT").length,
      todayEvening: todayEvents.filter((e) => e.dayCategory === "EVENING").length,
      todayFullDay: todayEvents.filter((e) => e.dayCategory === "FULL_DAY").length,
      upcoming: upcoming ?? 0,
      totalEvents: totalEvents ?? 0,
      locationsInUse: locations.size,
      conflicts,
    };

    return { success: true, data: stats };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Unable to load dashboard." };
  }
}

export async function getUpcomingEvents(
  limit = 8
): Promise<{ success: true; data: ScheduleEvent[] } | { success: false; error: string }> {
  try {
    await requireUser();
    const supabase = await createClient();
    const today = todayIST();
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return { success: true, data: (data as EventRow[]).map(mapEvent) };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Unable to load upcoming events." };
  }
}
