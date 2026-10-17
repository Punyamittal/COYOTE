"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { loadCalendarWindow, type CalendarWindow } from "@/actions/calendar";
import { visibleMonthRange } from "@/lib/calendar-range";
import { Skeleton } from "@/components/ui/skeleton";

const ScheduleCalendar = dynamic(
  () =>
    import("@/components/calendar/schedule-calendar").then((m) => ({
      default: m.ScheduleCalendar,
    })),
  { loading: () => <CalendarSkeleton />, ssr: false }
);

let inflight: { key: string; promise: Promise<CalendarWindow> } | null = null;

function prefetchCalendarWindow(from: string, to: string) {
  const key = `${from}|${to}`;
  if (inflight?.key === key) return inflight.promise;
  const promise = loadCalendarWindow(from, to);
  inflight = { key, promise };
  void promise.finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  return promise;
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="h-[min(720px,calc(100dvh-12.5rem))] w-full rounded-[28px]" />
    </div>
  );
}

export function CalendarClient() {
  const [seedRange] = useState(visibleMonthRange);
  const [seedPromise, setSeedPromise] = useState<Promise<CalendarWindow> | null>(null);

  useEffect(() => {
    setSeedPromise(prefetchCalendarWindow(seedRange.from, seedRange.to));
  }, [seedRange]);

  return <ScheduleCalendar seedRange={seedRange} seedPromise={seedPromise} />;
}
