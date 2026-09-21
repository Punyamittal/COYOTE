import { EventForm } from "@/components/events/event-form";
import { getEvent } from "@/actions/events";
import type { EventFormValues } from "@/lib/validation";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; start?: string; duplicate?: string }>;
}) {
  const params = await searchParams;
  let defaultValues: Partial<EventFormValues> = {};
  let mode: "create" | "duplicate" = "create";

  if (params.duplicate) {
    const result = await getEvent(params.duplicate);
    if (result.success) {
      const e = result.data;
      mode = "duplicate";
      defaultValues = {
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        name: e.name,
        registrationNumber: e.registrationNumber,
        eventName: e.eventName,
        location: e.location,
        remarks: e.remarks,
        description: e.description,
        department: e.department,
        organizer: e.organizer,
        contactInfo: e.contactInfo,
      };
    }
  } else {
    if (params.date) defaultValues.date = params.date;
    if (params.start) {
      defaultValues.startTime = params.start;
      // default 50-minute slot when coming from calendar click
      const [h, m] = params.start.split(":").map(Number);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        const endMins = h * 60 + m + 50;
        const eh = Math.floor(endMins / 60) % 24;
        const em = endMins % 60;
        defaultValues.endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
      }
    }
  }

  return <EventForm mode={mode} defaultValues={defaultValues} />;
}
