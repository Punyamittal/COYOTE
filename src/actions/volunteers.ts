"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { normalizeTime } from "@/lib/time-slots";

export type VolunteerEntry = {
  id: string;
  eventId: string;
  profileId: string;
  name: string;
  userId: string;
  startTime: string;
  endTime: string;
};

type Result<T> = { success: true; data: T } | { success: false; error: string };

function trimTime(t: string): string {
  return String(t).slice(0, 5);
}

export async function listEventVolunteers(
  eventId: string
): Promise<Result<{ volunteers: VolunteerEntry[]; myProfileId: string }>> {
  try {
    const me = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("event_volunteers")
      .select("id, event_id, profile_id, start_time, end_time, profiles(name, user_id)")
      .eq("event_id", eventId)
      .order("start_time", { ascending: true });

    if (error) return { success: false, error: error.message };

    const rows = (data ?? []) as Array<{
      id: string;
      event_id: string;
      profile_id: string;
      start_time: string;
      end_time: string;
      profiles: { name: string; user_id: string } | { name: string; user_id: string }[] | null;
    }>;

    return {
      success: true,
      data: {
        myProfileId: me.id,
        volunteers: rows.map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: row.id,
          eventId: row.event_id,
          profileId: row.profile_id,
          name: profile?.name ?? "Volunteer",
          userId: profile?.user_id ?? "",
          startTime: trimTime(row.start_time),
          endTime: trimTime(row.end_time),
        };
      }),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to load volunteers.";
    return { success: false, error: message };
  }
}

export async function saveMyVolunteer(input: {
  eventId: string;
  startTime: string;
  endTime: string;
}): Promise<Result<VolunteerEntry>> {
  try {
    const user = await requireUser();
    const startTime = normalizeTime(input.startTime);
    const endTime = normalizeTime(input.endTime);
    if (endTime < startTime) {
      return { success: false, error: "End time must be later than start time." };
    }

    const supabase = await createClient();
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, start_time, end_time")
      .eq("id", input.eventId)
      .maybeSingle();
    if (eventError) return { success: false, error: eventError.message };
    if (!event) return { success: false, error: "Event not found." };

    const eventStart = trimTime(event.start_time);
    const eventEnd = trimTime(event.end_time);
    if (startTime < eventStart || endTime > eventEnd) {
      return {
        success: false,
        error: `Volunteer time must fall within the event (${eventStart} – ${eventEnd}).`,
      };
    }

    const { data, error } = await supabase
      .from("event_volunteers")
      .upsert(
        {
          event_id: input.eventId,
          profile_id: user.id,
          start_time: startTime,
          end_time: endTime,
        },
        { onConflict: "event_id,profile_id" }
      )
      .select("id, event_id, profile_id, start_time, end_time")
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/calendar");
    revalidatePath("/events");
    revalidatePath(`/events/${input.eventId}`);

    return {
      success: true,
      data: {
        id: data.id,
        eventId: data.event_id,
        profileId: data.profile_id,
        name: user.name,
        userId: user.userId,
        startTime: trimTime(data.start_time),
        endTime: trimTime(data.end_time),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to save volunteer time.";
    return { success: false, error: message };
  }
}

export async function removeMyVolunteer(eventId: string): Promise<Result<null>> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("event_volunteers")
      .delete()
      .eq("event_id", eventId)
      .eq("profile_id", user.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/calendar");
    revalidatePath(`/events/${eventId}`);
    return { success: true, data: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to remove volunteer signup.";
    return { success: false, error: message };
  }
}
