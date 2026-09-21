"use client";

import dynamic from "next/dynamic";
import { ScheduleCalendarSkeleton } from "@/components/calendar/schedule-calendar";

const ScheduleCalendar = dynamic(
  () =>
    import("@/components/calendar/schedule-calendar").then((m) => ({
      default: m.ScheduleCalendar,
    })),
  { loading: () => <ScheduleCalendarSkeleton />, ssr: false }
);

export function CalendarClient() {
  return <ScheduleCalendar />;
}
