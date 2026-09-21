import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent } from "@/actions/events";
import { EventDetailContent } from "@/components/events/event-detail-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getEvent(id);
  if (!result.success) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/events">
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Link>
      </Button>
      <Card>
        <CardContent className="pt-5">
          <EventDetailContent event={result.data} />
        </CardContent>
      </Card>
    </div>
  );
}
