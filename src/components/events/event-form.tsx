"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createEvent, updateEvent } from "@/actions/events";
import { eventFormSchema, type EventFormValues } from "@/lib/validation";
import { classifyEvent } from "@/lib/time-slots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ConflictResult, ScheduleEvent } from "@/types";

export type EventFormMode = "create" | "edit" | "duplicate";

const emptyDefaults: EventFormValues = {
  date: "",
  startTime: "08:00",
  endTime: "08:50",
  name: "",
  registrationNumber: "",
  eventName: "",
  location: "",
  remarks: "",
  description: "",
  department: "",
  organizer: "",
  contactInfo: "",
  overrideConflicts: false,
};

function categoryTone(label: string): string {
  const l = label.toUpperCase();
  if (l.includes("FULL")) return "bg-[var(--fullday)]";
  if (l.includes("EVENING")) return "bg-[var(--evening)]";
  if (l.includes("MORNING")) return "bg-[var(--morning)]";
  if (l.includes("MULTI")) return "bg-[var(--multislot)]";
  return "bg-[var(--muted)]";
}

export function EventForm({
  mode,
  eventId,
  defaultValues,
  onSuccess,
}: {
  mode: EventFormMode;
  eventId?: string;
  defaultValues?: Partial<EventFormValues>;
  onSuccess?: (event: ScheduleEvent) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictResult | null>(null);
  const [pendingPayload, setPendingPayload] = useState<EventFormValues | null>(null);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
    reset,
  } = form;

  useEffect(() => {
    reset({ ...emptyDefaults, ...defaultValues });
  }, [defaultValues, reset]);

  const startTime = useWatch({ control, name: "startTime" });
  const endTime = useWatch({ control, name: "endTime" });

  const classification = useMemo(() => {
    try {
      if (!startTime || !endTime) return null;
      return classifyEvent(startTime, endTime);
    } catch {
      return null;
    }
  }, [startTime, endTime]);

  function submitValues(values: EventFormValues, override = false) {
    const payload: EventFormValues = {
      ...values,
      remarks: values.remarks || null,
      description: values.description || null,
      department: values.department || null,
      organizer: values.organizer || null,
      contactInfo: values.contactInfo || null,
      overrideConflicts: override,
    };

    startTransition(async () => {
      const result =
        mode === "edit" && eventId
          ? await updateEvent(eventId, payload)
          : await createEvent(payload);

      if (!result.success) {
        if (result.conflicts?.hasConflicts) {
          setPendingPayload(payload);
          setPendingConflicts(result.conflicts);
          setConflictOpen(true);
          return;
        }
        toast.error(result.error);
        return;
      }

      toast.success(mode === "edit" ? "Event updated" : "Event created");
      onSuccess?.(result.data);
      router.push(`/events/${result.data.id}`);
      router.refresh();
    });
  }

  function onValid(values: EventFormValues) {
    submitValues(values, false);
  }

  function onSaveAnyway() {
    if (!pendingPayload) return;
    setConflictOpen(false);
    setValue("overrideConflicts", true);
    submitValues({ ...pendingPayload, overrideConflicts: true }, true);
  }

  const title =
    mode === "edit" ? "Edit Event" : mode === "duplicate" ? "Duplicate Event" : "New Event";

  return (
    <>
      <form onSubmit={handleSubmit(onValid)} className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">{title}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Required fields marked with *. Classification updates as you edit times.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "edit" ? "Save Changes" : "Create Event"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
              <Field label="Date *" error={errors.date?.message}>
                <Input type="date" {...register("date")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start *" error={errors.startTime?.message}>
                  <Input type="time" {...register("startTime")} />
                </Field>
                <Field label="End *" error={errors.endTime?.message}>
                  <Input type="time" {...register("endTime")} />
                </Field>
              </div>
              <Field label="Name *" error={errors.name?.message}>
                <Input {...register("name")} placeholder="Participant / person name" />
              </Field>
              <Field label="Registration No. *" error={errors.registrationNumber?.message}>
                <Input {...register("registrationNumber")} />
              </Field>
              <Field label="Event / Work Name *" error={errors.eventName?.message} className="sm:col-span-2">
                <Input {...register("eventName")} />
              </Field>
              <Field label="Location *" error={errors.location?.message}>
                <Input {...register("location")} />
              </Field>
              <Field label="Department" error={errors.department?.message}>
                <Input {...register("department")} />
              </Field>
              <Field label="Organizer" error={errors.organizer?.message}>
                <Input {...register("organizer")} />
              </Field>
              <Field label="Contact Info" error={errors.contactInfo?.message}>
                <Input {...register("contactInfo")} />
              </Field>
              <Field label="Remarks" error={errors.remarks?.message} className="sm:col-span-2">
                <Textarea rows={2} {...register("remarks")} />
              </Field>
              <Field label="Description" error={errors.description?.message} className="sm:col-span-2">
                <Textarea rows={3} {...register("description")} />
              </Field>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Classification preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {classification ? (
                <>
                  <div
                    className={`rounded-md px-3 py-2 text-sm font-medium ${categoryTone(classification.categoryLabel)}`}
                  >
                    {classification.categoryLabel}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Day category: <Badge variant="outline">{classification.dayCategory}</Badge>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">
                      Affected slots
                    </p>
                    {classification.affectedSlots.length === 0 ? (
                      <p className="text-xs text-[var(--muted-foreground)]">None</p>
                    ) : (
                      <ul className="space-y-1">
                        {classification.affectedSlots.map((s) => (
                          <li key={s.id} className="text-xs">
                            {s.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">Enter valid start and end times.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </form>

      <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scheduling conflict detected</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>This event overlaps with existing bookings. Review the conflicts below.</p>
                <ul className="list-disc space-y-1 pl-4 text-sm text-[var(--foreground)]">
                  {pendingConflicts?.conflicts.map((c, i) => (
                    <li key={`${c.conflictingEventId}-${i}`}>{c.message}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingPayload(null);
                setPendingConflicts(null);
              }}
            >
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction onClick={onSaveAnyway}>Save Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-[var(--destructive)]">{error}</p> : null}
    </div>
  );
}
