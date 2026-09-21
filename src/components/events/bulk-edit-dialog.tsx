"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { bulkUpdateEvents } from "@/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function BulkEditDialog({
  ids,
  onDone,
}: {
  ids: string[];
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location && !date) {
      toast.error("Choose a new location and/or date.");
      return;
    }
    startTransition(async () => {
      const result = await bulkUpdateEvents(ids, {
        location: location || undefined,
        date: date || undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Updated ${result.data.count} event(s).`);
      setOpen(false);
      setLocation("");
      setDate("");
      onDone?.();
    });
  }

  if (ids.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Pencil className="h-4 w-4" />
          Bulk Edit ({ids.length})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk edit {ids.length} events</DialogTitle>
          <DialogDescription>
            Leave a field blank to keep existing values. Destructive changes should be confirmed
            carefully.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bulk-location">New location</Label>
            <Input
              id="bulk-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-date">New date</Label>
            <Input
              id="bulk-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Apply changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
