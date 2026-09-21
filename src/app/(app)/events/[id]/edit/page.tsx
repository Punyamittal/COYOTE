import { notFound } from "next/navigation";
import { getEvent } from "@/actions/events";
import { EventForm } from "@/components/events/event-form";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getEvent(id);
  if (!result.success) notFound();
  const e = result.data;

  return (
    <EventForm
      mode="edit"
      eventId={e.id}
      defaultValues={{
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
      }}
    />
  );
}
