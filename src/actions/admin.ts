"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { can, isMainAdmin, isAdminOrAbove } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";
import { categorySchema, locationSchema, settingsSchema } from "@/lib/validation";
import { DEFAULT_TIME_SLOTS } from "@/lib/time-slots";
import type {
  AuditLog,
  EventCategory,
  Location,
  SystemSettings,
  TimeSlot,
} from "@/types";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function safeError(err: unknown, fallback: string): string {
  console.error(err);
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return "You must be logged in.";
    if (err.message === "ACCOUNT_DISABLED") return "Your account is disabled.";
    if (err.message === "FORBIDDEN") return "You do not have permission to perform this action.";
  }
  return fallback;
}

function mapLocation(row: {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
}): Location {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
  };
}

function mapCategory(row: {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
}): EventCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    active: row.active,
  };
}

function mapSettings(row: {
  institution_name: string;
  logo_url: string | null;
  timezone: string;
  default_calendar_view: SystemSettings["defaultCalendarView"];
  default_working_hours_start: string;
  default_working_hours_end: string;
}): SystemSettings {
  return {
    institutionName: row.institution_name,
    logoUrl: row.logo_url,
    timezone: row.timezone,
    defaultCalendarView: row.default_calendar_view,
    defaultWorkingHoursStart: String(row.default_working_hours_start).slice(0, 5),
    defaultWorkingHoursEnd: String(row.default_working_hours_end).slice(0, 5),
  };
}

function mapAudit(row: {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}): AuditLog {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldData: row.old_data,
    newData: row.new_data,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}

function mapTimeSlot(row: {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  category: TimeSlot["category"];
  display_order: number;
  active: boolean;
}): TimeSlot {
  return {
    id: row.id,
    label: row.label,
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    category: row.category,
    displayOrder: row.display_order,
    active: row.active,
  };
}

const DEFAULT_SETTINGS: SystemSettings = {
  institutionName: "Institution",
  logoUrl: null,
  timezone: "Asia/Kolkata",
  defaultCalendarView: "dayGridMonth",
  defaultWorkingHoursStart: "08:00",
  defaultWorkingHoursEnd: "19:20",
};

// ─── Locations ───────────────────────────────────────────────────────────────

export async function listLocations(): Promise<ActionResult<Location[]>> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return { success: true, data: (data ?? []).map(mapLocation) };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to load locations.") };
  }
}

export async function createLocationAction(raw: unknown): Promise<ActionResult<Location>> {
  try {
    const user = await requireUser();
    if (!can(user, "locations:manage")) throw new Error("FORBIDDEN");

    const parsed = locationSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .insert({
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        active: parsed.data.active,
      })
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      userId: user.id,
      action: "created location",
      entityType: "location",
      entityId: data.id,
      newData: { name: data.name },
    });

    revalidatePath("/admin");
    revalidatePath("/settings");
    return { success: true, data: mapLocation(data) };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to create location.") };
  }
}

export async function updateLocationAction(
  id: string,
  raw: unknown
): Promise<ActionResult<Location>> {
  try {
    const user = await requireUser();
    if (!can(user, "locations:manage")) throw new Error("FORBIDDEN");

    const parsed = locationSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .update({
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        active: parsed.data.active,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      userId: user.id,
      action: "updated location",
      entityType: "location",
      entityId: id,
      newData: { name: data.name, active: data.active },
    });

    revalidatePath("/admin");
    return { success: true, data: mapLocation(data) };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to update location.") };
  }
}

export async function deleteLocationAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    if (!can(user, "locations:manage")) throw new Error("FORBIDDEN");

    const supabase = await createClient();
    const { error } = await supabase.from("locations").delete().eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      userId: user.id,
      action: "deleted location",
      entityType: "location",
      entityId: id,
    });

    revalidatePath("/admin");
    return { success: true, data: { id } };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to delete location.") };
  }
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function listCategories(): Promise<ActionResult<EventCategory[]>> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("event_categories")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return { success: true, data: (data ?? []).map(mapCategory) };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to load categories.") };
  }
}

export async function createCategoryAction(raw: unknown): Promise<ActionResult<EventCategory>> {
  try {
    const user = await requireUser();
    if (!can(user, "categories:manage")) throw new Error("FORBIDDEN");

    const parsed = categorySchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("event_categories")
      .insert({
        name: parsed.data.name.trim(),
        color: parsed.data.color?.trim() || null,
        active: parsed.data.active,
      })
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      userId: user.id,
      action: "created category",
      entityType: "category",
      entityId: data.id,
      newData: { name: data.name },
    });

    revalidatePath("/admin");
    return { success: true, data: mapCategory(data) };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to create category.") };
  }
}

export async function updateCategoryAction(
  id: string,
  raw: unknown
): Promise<ActionResult<EventCategory>> {
  try {
    const user = await requireUser();
    if (!can(user, "categories:manage")) throw new Error("FORBIDDEN");

    const parsed = categorySchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("event_categories")
      .update({
        name: parsed.data.name.trim(),
        color: parsed.data.color?.trim() || null,
        active: parsed.data.active,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      userId: user.id,
      action: "updated category",
      entityType: "category",
      entityId: id,
      newData: { name: data.name, active: data.active },
    });

    revalidatePath("/admin");
    return { success: true, data: mapCategory(data) };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to update category.") };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    if (!can(user, "categories:manage")) throw new Error("FORBIDDEN");

    const supabase = await createClient();
    const { error } = await supabase.from("event_categories").delete().eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      userId: user.id,
      action: "deleted category",
      entityType: "category",
      entityId: id,
    });

    revalidatePath("/admin");
    return { success: true, data: { id } };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to delete category.") };
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<ActionResult<SystemSettings>> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return { success: true, data: data ? mapSettings(data) : DEFAULT_SETTINGS };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to load settings.") };
  }
}

export async function updateSettingsAction(raw: unknown): Promise<ActionResult<SystemSettings>> {
  try {
    const user = await requireUser();
    if (!can(user, "settings:manage") || !isMainAdmin(user)) throw new Error("FORBIDDEN");

    const parsed = settingsSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const values = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .upsert({
        id: 1,
        institution_name: values.institutionName.trim(),
        logo_url: values.logoUrl?.trim() || null,
        timezone: values.timezone,
        default_calendar_view: values.defaultCalendarView,
        default_working_hours_start: values.defaultWorkingHoursStart,
        default_working_hours_end: values.defaultWorkingHoursEnd,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      userId: user.id,
      action: "updated system settings",
      entityType: "settings",
      entityId: "1",
      newData: { institutionName: values.institutionName },
    });

    revalidatePath("/admin");
    revalidatePath("/settings");
    return { success: true, data: mapSettings(data) };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to update settings.") };
  }
}

// ─── Audit logs ──────────────────────────────────────────────────────────────

export async function listAuditLogs(
  limit = 100
): Promise<ActionResult<AuditLog[]>> {
  try {
    const user = await requireUser();
    if (!can(user, "audit:read") && !isMainAdmin(user)) throw new Error("FORBIDDEN");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));
    if (error) throw error;
    return { success: true, data: (data ?? []).map(mapAudit) };
  } catch (err) {
    return { success: false, error: safeError(err, "Unable to load audit logs.") };
  }
}

// ─── Time slots ──────────────────────────────────────────────────────────────

export async function listTimeSlots(): Promise<ActionResult<TimeSlot[]>> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("time_slots")
      .select("*")
      .order("display_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return {
        success: true,
        data: DEFAULT_TIME_SLOTS.map((s) => ({ ...s, active: true })),
      };
    }

    return { success: true, data: data.map(mapTimeSlot) };
  } catch (err) {
    console.error(err);
    return {
      success: true,
      data: DEFAULT_TIME_SLOTS.map((s) => ({ ...s, active: true })),
    };
  }
}

export async function requireAdminAccess(): Promise<ActionResult<{ ok: true }>> {
  try {
    const user = await requireUser();
    if (!isAdminOrAbove(user)) throw new Error("FORBIDDEN");
    return { success: true, data: { ok: true } };
  } catch (err) {
    return { success: false, error: safeError(err, "Forbidden") };
  }
}
