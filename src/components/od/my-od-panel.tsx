import type { MyOdSummary, OdCount } from "@/actions/od";
import { OdStatusBadge, odSetupHint } from "@/components/calendar/od-status-badge";
import { formatTime12h } from "@/lib/time-slots";
import { formatDateIST } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

function CountCard({ label, count }: { label: string; count: OdCount }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-semibold">{label}</p>
        <p className="font-display text-3xl text-[var(--primary)]">{count.applied}</p>
        <p className="text-sm text-[var(--muted-foreground)]">
          {count.approved} approved · {count.rejected} rejected · {count.pending} pending
        </p>
      </CardContent>
    </Card>
  );
}

export function MyOdPanel({
  summary,
  error,
}: {
  summary: MyOdSummary | null;
  error: string | null;
}) {
  if (error) return <p className="text-sm text-red-700">{odSetupHint(error)}</p>;
  if (!summary) return <p className="text-sm text-[var(--muted-foreground)]">Loading your OD…</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <CountCard label="Applied, including calendar OD" count={summary.total} />
        <CountCard label="On a calendar event" count={summary.calendar} />
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Your applications
        </h2>
        {summary.requests.length === 0 && summary.calendarEvents.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">You have not applied for OD yet.</p>
        ) : null}
        <ul className="space-y-3">
          {summary.calendarEvents.map((event) => (
            <li key={event.id} className="rounded-2xl border border-white/50 bg-white/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{event.eventName}</p>
                <OdStatusBadge status={event.status} />
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {formatDateIST(event.date)} · Calendar event · {formatTime12h(event.startTime)} –{" "}
                {formatTime12h(event.endTime)}
              </p>
            </li>
          ))}
          {summary.requests.map((request) => (
            <li key={request.id} className="space-y-2 rounded-2xl border border-white/50 bg-white/40 p-4">
              <p className="font-medium">
                {formatDateIST(request.date)}
                {request.eventName ? ` · ${request.eventName}` : " · No event"}
              </p>
              {request.reason ? <p className="text-sm">{request.reason}</p> : null}
              <ul className="space-y-1 text-sm text-[var(--muted-foreground)]">
                {request.slots.map((slot, index) => (
                  <li key={slot.id ?? index} className="flex flex-wrap items-center gap-2">
                    <span>
                      {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                    </span>
                    <OdStatusBadge status={slot.status ?? null} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
