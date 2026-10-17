"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getMyFreeOd, removeMyOd, saveFreeOd, type OdSlot } from "@/actions/od";
import { odSetupHint } from "@/components/calendar/od-status-badge";
import { OdTimeFields } from "@/components/calendar/od-time-fields";
import { todayIST } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const blankSlot = (): OdSlot => ({ startTime: "08:00", endTime: "09:00" });

export function OdApplyDialog({
  open,
  date: dateSeed,
  onOpenChange,
}: {
  open: boolean;
  date?: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [date, setDate] = useState(dateSeed || todayIST());
  const [requestId, setRequestId] = useState<string | null>(null);
  const [slots, setSlots] = useState<OdSlot[]>([blankSlot()]);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setDate(dateSeed || todayIST());
  }, [open, dateSeed]);

  useEffect(() => {
    if (!open || !date) return;
    let cancelled = false;
    void getMyFreeOd(date).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      const row = result.data;
      setRequestId(row?.id ?? null);
      setReason(row?.reason ?? "");
      setSlots(row?.slots.length ? row.slots : [blankSlot()]);
    });
    return () => {
      cancelled = true;
    };
  }, [open, date]);

  function save() {
    startTransition(async () => {
      const result = await saveFreeOd({ date, slots, reason });
      if (!result.success) {
        toast.error(odSetupHint(result.error));
        return;
      }
      setRequestId(result.data.id);
      toast.success("OD saved");
      onOpenChange(false);
    });
  }

  function remove() {
    if (!requestId) return;
    startTransition(async () => {
      const result = await removeMyOd(requestId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRequestId(null);
      toast.success("OD removed");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply for OD</DialogTitle>
          <DialogDescription>
            Apply without an event. Add as many time ranges as you need on this day.
          </DialogDescription>
        </DialogHeader>
        {loadError ? <p className="text-xs text-red-700">{odSetupHint(loadError)}</p> : null}
        <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Date
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
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
        <div className="flex flex-wrap justify-end gap-2">
          {requestId ? (
            <Button type="button" variant="outline" onClick={remove} disabled={pending}>
              Remove
            </Button>
          ) : null}
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save OD"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
