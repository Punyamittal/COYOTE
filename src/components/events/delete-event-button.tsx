"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteEvent } from "@/actions/events";
import { Button } from "@/components/ui/button";

export function DeleteEventButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this event? This cannot be undone.")) return;
        startTransition(async () => {
          const result = await deleteEvent(id);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success("Event deleted.");
          router.push("/events");
          router.refresh();
        });
      }}
    >
      Delete
    </Button>
  );
}
