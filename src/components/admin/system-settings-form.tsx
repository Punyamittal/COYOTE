"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSettingsAction } from "@/actions/admin";
import type { SystemSettings } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CALENDAR_VIEWS: SystemSettings["defaultCalendarView"][] = [
  "dayGridMonth",
  "timeGridWeek",
  "timeGridDay",
  "listWeek",
];

export function SystemSettingsForm({ initial }: { initial: SystemSettings }) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSettingsAction({
        institutionName: form.institutionName,
        logoUrl: form.logoUrl ?? "",
        timezone: form.timezone,
        defaultCalendarView: form.defaultCalendarView,
        defaultWorkingHoursStart: form.defaultWorkingHoursStart,
        defaultWorkingHoursEnd: form.defaultWorkingHoursEnd,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setForm(res.data);
      toast.success("Settings saved");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="institutionName">Institution name</Label>
          <Input
            id="institutionName"
            value={form.institutionName}
            onChange={(e) => setForm((f) => ({ ...f, institutionName: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            type="url"
            placeholder="https://…"
            value={form.logoUrl ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value || null }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Default calendar view</Label>
          <Select
            value={form.defaultCalendarView}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                defaultCalendarView: v as SystemSettings["defaultCalendarView"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CALENDAR_VIEWS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whStart">Working hours start</Label>
          <Input
            id="whStart"
            type="time"
            value={form.defaultWorkingHoursStart}
            onChange={(e) =>
              setForm((f) => ({ ...f, defaultWorkingHoursStart: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whEnd">Working hours end</Label>
          <Input
            id="whEnd"
            type="time"
            value={form.defaultWorkingHoursEnd}
            onChange={(e) =>
              setForm((f) => ({ ...f, defaultWorkingHoursEnd: e.target.value }))
            }
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
