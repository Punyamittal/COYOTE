"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  reviewCalendarEvent,
  reviewOdSlot,
  type CalendarEventReview,
  type OdRequest,
  type OdStatus,
} from "@/actions/od";
import { OdStatusBadge, odSetupHint } from "@/components/calendar/od-status-badge";
import { formatTime12h } from "@/lib/time-slots";
import { formatDateIST } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Filter = "all" | OdStatus;

export function OdReviewPanel({
  requests,
  events: initialEvents,
  loadError,
}: {
  requests: OdRequest[];
  events: CalendarEventReview[];
  loadError: string | null;
}) {
  const [rows, setRows] = useState(requests);
  const [events, setEvents] = useState(initialEvents);
  const [filter, setFilter] = useState<Filter>("pending");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function decide(slotId: string, status: "approved" | "rejected") {
    setBusyId(slotId);
    startTransition(async () => {
      const result = await reviewOdSlot(slotId, status);
      setBusyId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRows((current) =>
        current.map((row) => ({
          ...row,
          slots: row.slots.map((slot) => (slot.id === slotId ? { ...slot, status } : slot)),
        }))
      );
      toast.success(status === "approved" ? "Time approved" : "Time rejected");
    });
  }

  function decideEvent(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    startTransition(async () => {
      const result = await reviewCalendarEvent(id, status);
      setBusyId(null);
      if (!result.success) {
        toast.error(odSetupHint(result.error));
        return;
      }
      setEvents((current) => current.map((event) => (event.id === id ? { ...event, status } : event)));
      toast.success(status === "approved" ? "Event approved" : "Event rejected");
    });
  }

  const visibleEvents = events.filter((event) => filter === "all" || event.status === filter);
  const visible = rows.filter(
    (row) => filter === "all" || row.slots.some((slot) => (slot.status ?? "pending") === filter)
  );
  const filters: { id: Filter; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "all", label: "All" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>OD requests</CardTitle>
        <p className="text-sm text-[var(--muted-foreground)]">
          Approve or reject each calendar event and each OD time. Students only see the status of what they applied for.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filter === item.id ? "default" : "outline"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        {loadError ? <p className="text-sm text-red-700">{odSetupHint(loadError)}</p> : null}
        {!loadError && visibleEvents.length === 0 && visible.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">Nothing in this list.</p>
        ) : null}
        {visibleEvents.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Calendar
            </p>
            <ul className="space-y-3">
              {visibleEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/50 bg-white/40 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{event.eventName}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {formatDateIST(event.date)}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>
                        {formatTime12h(event.startTime)} – {formatTime12h(event.endTime)}
                      </span>
                      <OdStatusBadge status={event.status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || busyId === event.id || event.status === "approved"}
                      onClick={() => decideEvent(event.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending || busyId === event.id || event.status === "rejected"}
                      onClick={() => decideEvent(event.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {visible.length > 0 ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            OD applications
          </p>
        ) : null}
        <ul className="space-y-3">
          {visible.map((row) => (
            <li
              key={row.id}
              className="space-y-3 rounded-2xl border border-white/50 bg-white/40 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {row.name}
                    {row.userId ? ` · ${row.userId}` : ""}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {formatDateIST(row.date)}
                    {row.eventName ? ` · ${row.eventName}` : " · No event"}
                  </p>
                  {row.reason ? <p className="mt-1 text-sm">{row.reason}</p> : null}
                </div>
              </div>
              <ul className="space-y-2">
                {row.slots.map((slot, index) => (
                  <li
                    key={slot.id ?? index}
                    className="flex flex-col gap-2 rounded-xl bg-white/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>
                        {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                      </span>
                      <OdStatusBadge status={slot.status ?? null} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!slot.id || pending || busyId === slot.id || slot.status === "approved"}
                        onClick={() => slot.id && decide(slot.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!slot.id || pending || busyId === slot.id || slot.status === "rejected"}
                        onClick={() => slot.id && decide(slot.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
