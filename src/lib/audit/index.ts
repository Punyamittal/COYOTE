import { createClient } from "@/lib/supabase/server";

export async function writeAuditLog(params: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string | null;
}) {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
      ip_address: params.ipAddress ?? null,
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}
