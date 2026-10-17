import { notFound, redirect } from "next/navigation";
import { getEvent } from "@/actions/events";
import { EventForm } from "@/components/events/event-form";
import { getSessionUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/permissions";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  const result = await getEvent(id);
  if (!result.success) notFound();
  const e = result.data;
  if (!canEditEvent(user, e.createdBy)) redirect(`/events/${e.id}`);
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
        department: e.department,
        organizer: e.organizer,
        contactInfo: e.contactInfo,
      }}
    />
  );
}
