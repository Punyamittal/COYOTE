"use client";

import type { AuditLog } from "@/types";
import { formatDateIST } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function AuditLogTable({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
        No audit entries yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--muted)]/40">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Action</th>
            <th className="px-3 py-2 font-medium">Entity</th>
            <th className="px-3 py-2 font-medium">User</th>
            <th className="px-3 py-2 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-[var(--border)] last:border-0 align-top">
              <td className="whitespace-nowrap px-3 py-2 text-[var(--muted-foreground)]">
                {formatDateIST(log.createdAt)}
                <div className="text-xs">
                  {new Date(log.createdAt).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </td>
              <td className="px-3 py-2">{log.action}</td>
              <td className="px-3 py-2">
                <Badge variant="outline">{log.entityType}</Badge>
                {log.entityId && (
                  <div className="mt-1 max-w-[140px] truncate font-mono text-xs text-[var(--muted-foreground)]">
                    {log.entityId}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-[var(--muted-foreground)]">
                {log.userId ? log.userId.slice(0, 8) + "…" : "—"}
              </td>
              <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                {log.newData || log.oldData ? (
                  <pre className="max-h-20 max-w-xs overflow-auto whitespace-pre-wrap rounded bg-[var(--muted)]/40 p-1.5">
                    {JSON.stringify(log.newData ?? log.oldData, null, 0)}
                  </pre>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
