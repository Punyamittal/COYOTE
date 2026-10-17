"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { getViewerAccess, type ViewerAccess } from "@/actions/auth";
import { deleteEvent } from "@/actions/events";
import { listEventOd, removeMyOd, saveEventOd, type OdRequest, type OdSlot } from "@/actions/od";
import { OdStatusBadge, odSetupHint } from "@/components/calendar/od-status-badge";
import { OdTimeFields } from "@/components/calendar/od-time-fields";
import { formatTime12h } from "@/lib/time-slots";
import { formatDateIST } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { DayCategory, ScheduleEvent } from "@/types";

function dayCategoryClass(cat: DayCategory): string {
  switch (cat) {
    case "MORNING":
      return "bg-[var(--morning)]";
    case "EVENING":
      return "bg-[var(--evening)]";
    case "FULL_DAY":
      return "bg-[var(--fullday)]";
    case "MULTI_SLOT":
      return "bg-[var(--multislot)]";
    default:
      return "bg-[var(--muted)]";
  }
}

export function EventDetailContent({
  event,
  onDeleted,
  showActions = true,
}: {
  event: ScheduleEvent;
  onDeleted?: () => void;
  showActions?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [access, setAccess] = useState<ViewerAccess | null>(null);

  useEffect(() => {
    void getViewerAccess().then(setAccess);
  }, []);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Event deleted");
      setConfirmOpen(false);
      onDeleted?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold text-[var(--primary)]">
            {event.eventName}
            <OdStatusBadge status={event.odStatus ?? null} />
          </h2>
          {!event.registrationNumber.startsWith("open-") && event.name !== "—" ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              {event.name} · {event.registrationNumber}
            </p>
          ) : null}
        </div>
        <Badge className={dayCategoryClass(event.dayCategory)} variant="secondary">
          {event.dayCategory.replace("_", " ")}
        </Badge>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Detail label="Date" value={formatDateIST(event.date)} />
        <Detail
          label="Time"
          value={`${formatTime12h(event.startTime)} – ${formatTime12h(event.endTime)}`}
        />
        <Detail label="Location" value={event.location} />
        <Detail label="Department" value={event.department || "—"} />
        <Detail label="Organizer" value={event.organizer || "—"} />
        <Detail label="Contact" value={event.contactInfo || "—"} />
        <Detail label="Remarks" value={event.remarks || "—"} className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Affected slots
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {event.affectedSlots.length === 0 ? (
              <span>—</span>
            ) : (
              event.affectedSlots.map((id) => (
                <Badge key={id} variant="outline">
                  {id}
                </Badge>
              ))
            )}
          </dd>
        </div>
      </dl>

      <EventOdSignup event={event} />

      {event.conflictFlags && event.conflictFlags.length > 0 && (
        <div className="rounded-md bg-[var(--conflict)] p-3 text-sm">
          <p className="font-medium">Conflicts</p>
          <ul className="mt-1 list-disc pl-4">
            {event.conflictFlags.map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
          </ul>
        </div>
      )}

      {showActions && access?.canEditEvents ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          <Button asChild size="sm" variant="outline">
            <Link href={`/events/${event.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/events/new?duplicate=${event.id}`)}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
          {access.canDeleteEvents ? (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={pending}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes &quot;{event.eventName}&quot; on {event.date}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={pending}>
                  {pending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EventOdSignup({ event }: { event: ScheduleEvent }) {
  const [requests, setRequests] = useState<OdRequest[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [mineId, setMineId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [slots, setSlots] = useState<OdSlot[]>([
    { startTime: event.startTime, endTime: event.endTime },
  ]);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listEventOd(event.id).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      setRequests(result.data.requests);
      setMyId(result.data.myProfileId);
      const mine = result.data.requests.find((row) => row.profileId === result.data.myProfileId);
      setMineId(mine?.id ?? null);
      setApplying(Boolean(mine));
      setReason(mine?.reason ?? "");
      setSlots(
        mine?.slots.length
          ? mine.slots
          : [{ startTime: event.startTime, endTime: event.endTime }]
      );
    });
    return () => {
      cancelled = true;
    };
  }, [event.id, event.startTime, event.endTime]);

  function save() {
    startTransition(async () => {
      if (!applying) {
        if (!mineId) return;
        const result = await removeMyOd(mineId);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setRequests((prev) => prev.filter((row) => row.id !== mineId));
        setMineId(null);
        toast.success("OD removed");
        return;
      }
      const result = await saveEventOd({ eventId: event.id, slots, reason });
      if (!result.success) {
        toast.error(odSetupHint(result.error));
        return;
      }
      setMineId(result.data.id);
      setRequests((prev) => {
        const rest = prev.filter((row) => row.profileId !== result.data.profileId);
        return [...rest, result.data];
      });
      toast.success("OD saved");
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/40 bg-white/30 p-4">
      <p className="text-sm font-semibold text-[var(--foreground)]">Apply for OD</p>
      <p className="text-xs text-[var(--muted-foreground)]">
        Mark OD for this event. Add as many time ranges as you need on this day.
      </p>
      {loadError ? <p className="text-xs text-red-700">{odSetupHint(loadError)}</p> : null}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#3B82F6]"
          checked={applying}
          onChange={(e) => setApplying(e.target.checked)}
        />
        I need OD for this event
      </label>
      {applying ? (
        <>
          <OdTimeFields slots={slots} onChange={setSlots} />
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Reason
            <Textarea
              required
              value={reason}
              maxLength={500}
              placeholder="Why do you need OD?"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </>
      ) : null}
      <Button type="button" size="sm" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save OD"}
      </Button>
      {requests.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {requests.map((row) => (
            <li key={row.id}>
              <span className="flex flex-wrap items-center gap-2 font-medium">
                <span>
                  {row.name}
                  {row.userId ? ` · ${row.userId}` : ""}
                  {row.profileId === myId ? " (you)" : ""}
                </span>
              </span>
              {row.profileId === myId && row.reason ? (
                <p className="mt-1 text-sm">{row.reason}</p>
              ) : null}
              <div className="mt-1 space-y-1 text-[var(--muted-foreground)]">
                {row.slots.map((slot, index) => (
                  <div key={slot.id ?? index} className="flex flex-wrap items-center gap-2">
                    <span>
                      {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                    </span>
                    {row.profileId === myId ? <OdStatusBadge status={slot.status ?? null} /> : null}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">No OD requests yet.</p>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

export function EventDetailDialog({
  event,
  open,
  onOpenChange,
}: {
  event: ScheduleEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Event details</DialogTitle>
          <DialogDescription>View schedule entry and manage actions.</DialogDescription>
        </DialogHeader>
        {event ? (
          <EventDetailContent event={event} onDeleted={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
