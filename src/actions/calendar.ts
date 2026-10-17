"use server";

import { listEvents } from "@/actions/events";
import { listMyOd, type OdRequest } from "@/actions/od";
import type { ScheduleEvent } from "@/types";

export type CalendarWindow = {
  events: ScheduleEvent[];
  od: OdRequest[];
  eventsError: string | null;
  odError: string | null;
};

/** Events and OD for one visible range, in a single round trip. */
export async function loadCalendarWindow(from: string, to: string): Promise<CalendarWindow> {
  const [events, od] = await Promise.all([
    listEvents({
      dateFrom: from,
      dateTo: to,
      page: 1,
      pageSize: 200,
      sortBy: "date",
      sortDir: "asc",
      countTotal: false,
    }),
    listMyOd(from, to),
  ]);

  return {
    events: events.success ? events.data.data : [],
    od: od.success ? od.data : [],
    eventsError: events.success ? null : events.error,
    odError: od.success ? null : od.error,
  };
}
