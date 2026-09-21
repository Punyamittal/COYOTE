"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { deleteEvent } from "@/actions/events";
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
          <p className="text-sm text-[var(--muted-foreground)]">
            {event.name} · {event.registrationNumber}
          </p>
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
        <Detail label="Description" value={event.description || "—"} className="sm:col-span-2" />
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

      {showActions && (
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
        </div>
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
