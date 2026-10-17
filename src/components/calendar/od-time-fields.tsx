"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OdSlot } from "@/actions/od";
import { OdStatusBadge } from "@/components/calendar/od-status-badge";

export function OdTimeFields({
  slots,
  onChange,
}: {
  slots: OdSlot[];
  onChange: (slots: OdSlot[]) => void;
}) {
  function update(index: number, field: "startTime" | "endTime", value: string) {
    onChange(
      slots.map((slot, i) =>
        i === index ? { startTime: slot.startTime, endTime: slot.endTime, [field]: value } : slot
      )
    );
  }

  return (
    <div className="space-y-3">
      {slots.map((slot, index) => (
        <div key={slot.id ?? index} className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Time {index + 1} from
            <Input
              type="time"
              value={slot.startTime}
              onChange={(e) => update(index, "startTime", e.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Until
            <Input
              type="time"
              value={slot.endTime}
              onChange={(e) => update(index, "endTime", e.target.value)}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mb-0.5"
            disabled={slots.length === 1}
            onClick={() => onChange(slots.filter((_, i) => i !== index))}
          >
            Remove
          </Button>
        </div>
        {slot.status ? <OdStatusBadge status={slot.status} /> : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...slots, { startTime: "08:00", endTime: "09:00" }])}
      >
        Add another time
      </Button>
    </div>
  );
}
