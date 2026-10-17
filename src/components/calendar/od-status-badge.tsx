import { Badge } from "@/components/ui/badge";
import type { OdStatus } from "@/actions/od";

export function OdStatusBadge({ status }: { status: OdStatus | null }) {
  if (!status) return null;
  const variant =
    status === "approved" ? "success" : status === "rejected" ? "destructive" : "warning";
  const label = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
  return <Badge variant={variant}>{label}</Badge>;
}

export function odStatusTitle(status: OdStatus | null): string {
  if (status === "approved") return "OD · Approved";
  if (status === "rejected") return "OD · Rejected";
  if (status === "pending") return "OD · Pending";
  return "OD";
}

export function odSetupHint(error: string) {
  if (error.includes("od_status")) {
    return "Run supabase/migrations/009_event_review.sql in the SQL editor, then try again.";
  }
  if (error.includes("od_request_slots") && (error.includes("status") || error.includes("reviewed"))) {
    return "Run supabase/migrations/008_od_slot_status.sql in the SQL editor, then try again.";
  }
  if (error.includes("status") || error.includes("reviewed_by") || error.includes("od_status")) {
    return "Run supabase/migrations/007_od_status.sql in the SQL editor, then try again.";
  }
  if (error.includes("od_request_slots")) {
    return "Run supabase/migrations/006_od_request_slots.sql in the SQL editor, then try again.";
  }
  if (error.includes("od_requests")) {
    return "Run supabase/migrations/005_od_requests.sql in the SQL editor, then try again.";
  }
  return error;
}
