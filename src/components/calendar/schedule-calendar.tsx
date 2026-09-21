"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, DatesSetArg, EventInput } from "@fullcalendar/core";
import { listEvents } from "@/actions/events";
import { eventIdsWithConflicts } from "@/lib/time-slots";
import { EventDetailDialog } from "@/components/events/event-detail-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DayCategory, ScheduleEvent } from "@/types";
import { toast } from "sonner";

const calendarPlugins = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];

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

function toFcEvents(events: ScheduleEvent[], conflictIds: Set<string>): EventInput[] {
  return events.map((e) => {
    const classNames = [categoryClass(e.dayCategory)];
    if (conflictIds.has(e.id)) classNames.push("event-conflict");

    return {
      id: e.id,
      title: e.eventName,
      start: toLocalDateTime(e.date, e.startTime),
      end: toLocalDateTime(e.date, e.endTime),
      classNames,
      extendedProps: { event: e },
    };
  });
}

function toLocalDateTime(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time;
  return `${date}T${t}`;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ScheduleCalendar() {
  const router = useRouter();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [selected, setSelected] = useState<ScheduleEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    async function run(from: string, to: string) {
      setLoading(true);
      const result = await listEvents({
        dateFrom: from,
        dateTo: to,
        page: 1,
        pageSize: 200,
        sortBy: "date",
        sortDir: "asc",
        countTotal: false,
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

  const conflictIds = useMemo(() => eventIdsWithConflicts(events), [events]);
  const fcEvents = useMemo(() => toFcEvents(events, conflictIds), [events, conflictIds]);

  const onDatesSet = useCallback((arg: DatesSetArg) => {
    const from = arg.startStr.slice(0, 10);
    const endInclusive = new Date(arg.end);
    endInclusive.setDate(endInclusive.getDate() - 1);
    const to = formatYmd(endInclusive);
    setRange((prev) => (prev?.from === from && prev?.to === to ? prev : { from, to }));
  }, []);

  const onDateSelect = useCallback(
    (arg: DateSelectArg) => {
      const date = arg.startStr.slice(0, 10);
      let start = "08:00";
      if (!arg.allDay && arg.startStr.includes("T")) {
        start = arg.startStr.slice(11, 16);
      }
      router.push(`/events/new?date=${encodeURIComponent(date)}&start=${encodeURIComponent(start)}`);
    },
    [router]
  );

  const onEventClick = useCallback((arg: EventClickArg) => {
    const event = arg.event.extendedProps.event as ScheduleEvent | undefined;
    if (!event) return;
    setSelected(event);
    setDetailOpen(true);
  }, []);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">Calendar</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Month, week, day, and list views. Click a slot to add an event.
        </p>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="relative flex min-h-0 flex-1 flex-col p-3 pt-4 sm:p-5 sm:pt-5">
          {loading && (
            <div
              className="absolute inset-x-4 top-4 z-10 h-0.5 overflow-hidden rounded-full bg-white/40 sm:inset-x-5"
              aria-hidden
            >
              <div className="h-full w-1/3 animate-pulse rounded-full bg-[#3B82F6]/70" />
            </div>
          )}
          <div className="schedule-calendar min-h-[min(720px,calc(100dvh-12.5rem))] flex-1">
            <FullCalendar
              plugins={calendarPlugins}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
              }}
              height="100%"
              expandRows
              stickyHeaderDates
              selectable
              selectMirror
              dayMaxEvents={3}
              moreLinkClick="popover"
              weekends
              nowIndicator
              slotMinTime="07:00:00"
              slotMaxTime="20:00:00"
              slotDuration="00:30:00"
              allDaySlot={false}
              events={fcEvents}
              datesSet={onDatesSet}
              select={onDateSelect}
              eventClick={onEventClick}
              eventDisplay="block"
              eventTimeFormat={{
                hour: "numeric",
                minute: "2-digit",
                meridiem: "short",
              }}
              slotLabelFormat={{
                hour: "numeric",
                minute: "2-digit",
                meridiem: "short",
              }}
            />
          </div>
        </CardContent>
      </Card>

      <EventDetailDialog event={selected} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}

export function ScheduleCalendarSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="h-[min(720px,calc(100dvh-12.5rem))] w-full rounded-[28px]" />
    </div>
  );
}
