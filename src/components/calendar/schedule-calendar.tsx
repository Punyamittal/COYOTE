"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, DatesSetArg, EventInput } from "@fullcalendar/core";
import { listEvents } from "@/actions/events";
import { detectConflicts } from "@/lib/time-slots";
import { EventDetailDialog } from "@/components/events/event-detail-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DayCategory, ScheduleEvent } from "@/types";
import { toast } from "sonner";

function categoryClass(cat: DayCategory): string {
  switch (cat) {
    case "MORNING":
      return "event-morning";
    case "EVENING":
      return "event-evening";
    case "FULL_DAY":
      return "event-fullday";
    case "MULTI_SLOT":
      return "event-multislot";
    default:
      return "event-morning";
  }
}

function toFcEvents(events: ScheduleEvent[]): EventInput[] {
  return events.map((e) => {
    const conflicts = detectConflicts(e, events);
    const classNames = [categoryClass(e.dayCategory)];
    if (conflicts.hasConflicts) classNames.push("event-conflict");

    return {
      id: e.id,
      title: e.eventName,
      start: `${e.date}T${e.startTime}:00`,
      end: `${e.date}T${e.endTime}:00`,
      classNames,
      extendedProps: { event: e },
    };
  });
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ScheduleCalendar() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [selected, setSelected] = useState<ScheduleEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    async function run(from: string, to: string) {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      const result = await listEvents({
        dateFrom: from,
        dateTo: to,
        page: 1,
        pageSize: 200,
        sortBy: "date",
        sortDir: "asc",
      });
      if (cancelled) return;
      setLoading(false);
      if (!result.success) {
        toast.error(result.error);
        setEvents([]);
        return;
      }
      setEvents(result.data.data);
    }
    void run(range.from, range.to);
    return () => {
      cancelled = true;
    };
  }, [range]);

  const fcEvents = useMemo(() => toFcEvents(events), [events]);

  function onDatesSet(arg: DatesSetArg) {
    const from = arg.startStr.slice(0, 10);
    const endInclusive = new Date(arg.end);
    endInclusive.setDate(endInclusive.getDate() - 1);
    const to = formatYmd(endInclusive);
    setRange((prev) => (prev?.from === from && prev?.to === to ? prev : { from, to }));
  }

  function onDateSelect(arg: DateSelectArg) {
    const date = arg.startStr.slice(0, 10);
    const start = arg.startStr.length > 10 ? arg.startStr.slice(11, 16) : "08:00";
    router.push(`/events/new?date=${encodeURIComponent(date)}&start=${encodeURIComponent(start)}`);
  }

  function onEventClick(arg: EventClickArg) {
    const event = arg.event.extendedProps.event as ScheduleEvent | undefined;
    if (!event) return;
    setSelected(event);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">Calendar</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Month, week, day, and list views. Click an empty slot to add an event.
        </p>
      </div>

      <Card>
        <CardContent className="relative pt-5">
          {loading && (
            <div className="absolute inset-x-5 top-5 z-10">
              <Skeleton className="h-2 w-full" />
            </div>
          )}
          <div className="schedule-calendar min-h-[640px]">
            {!mounted ? (
              <Skeleton className="h-[640px] w-full" />
            ) : (
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
                }}
                height="auto"
                selectable
                selectMirror
                dayMaxEvents
                weekends
                nowIndicator
                slotMinTime="07:00:00"
                slotMaxTime="20:00:00"
                events={fcEvents}
                datesSet={onDatesSet}
                select={onDateSelect}
                eventClick={onEventClick}
                eventTimeFormat={{
                  hour: "numeric",
                  minute: "2-digit",
                  meridiem: "short",
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <EventDetailDialog event={selected} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
