"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { getViewerAccess, type ViewerAccess } from "@/actions/auth";
import { deleteEvent } from "@/actions/events";
import {
  listEventVolunteers,
  removeMyVolunteer,
  saveMyVolunteer,
  type VolunteerEntry,
} from "@/actions/volunteers";
import { Input } from "@/components/ui/input";
import { formatTime12h } from "@/lib/time-slots";
import { formatDateIST } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
          <h2 className="font-display text-xl font-semibold text-[var(--primary)]">
            {event.eventName}
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

      <VolunteerSignup event={event} />

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

function VolunteerSignup({ event }: { event: ScheduleEvent }) {
  const [volunteers, setVolunteers] = useState<VolunteerEntry[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [volunteered, setVolunteered] = useState(false);
  const [startTime, setStartTime] = useState(event.startTime);
  const [endTime, setEndTime] = useState(event.endTime);
  const [pending, startTransition] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listEventVolunteers(event.id).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      setVolunteers(result.data.volunteers);
      setMyId(result.data.myProfileId);
      const mine = result.data.volunteers.find((v) => v.profileId === result.data.myProfileId);
      setVolunteered(Boolean(mine));
      setStartTime(mine?.startTime ?? event.startTime);
      setEndTime(mine?.endTime ?? event.endTime);
    });
    return () => {
      cancelled = true;
    };
  }, [event.id, event.startTime, event.endTime]);

  function save() {
    startTransition(async () => {
      if (!volunteered) {
        const result = await removeMyVolunteer(event.id);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setVolunteers((prev) => prev.filter((v) => v.profileId !== myId));
        toast.success("Volunteer signup removed");
        return;
      }
      const result = await saveMyVolunteer({
        eventId: event.id,
        startTime,
        endTime,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setVolunteers((prev) => {
        const rest = prev.filter((v) => v.profileId !== result.data.profileId);
        return [...rest, result.data].sort((a, b) => a.startTime.localeCompare(b.startTime));
      });
      toast.success("Volunteer time saved");
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/40 bg-white/30 p-4">
      <p className="text-sm font-semibold text-[var(--foreground)]">Volunteer</p>
      <p className="text-xs text-[var(--muted-foreground)]">
        Use your account to say you volunteered and the time you need for this event.
      </p>
      {loadError ? (
        <p className="text-xs text-red-700">
          {loadError.includes("event_volunteers")
            ? "Run supabase/migrations/004_event_volunteers.sql in the SQL editor, then try again."
            : loadError}
        </p>
      ) : null}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#3B82F6]"
          checked={volunteered}
          onChange={(e) => setVolunteered(e.target.checked)}
        />
        I volunteered at this event
      </label>
      {volunteered ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Time I need from
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Until
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
      ) : null}
      <Button type="button" size="sm" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save volunteer time"}
      </Button>
      {volunteers.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {volunteers.map((v) => (
            <li key={v.id} className="flex justify-between gap-3">
              <span>
                {v.name}
                {v.userId ? ` · ${v.userId}` : ""}
                {v.profileId === myId ? " (you)" : ""}
              </span>
              <span className="text-[var(--muted-foreground)]">
                {formatTime12h(v.startTime)} – {formatTime12h(v.endTime)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">No volunteers yet.</p>
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
