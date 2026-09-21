import type { ClassificationResult, DayCategory, TimeSlot } from "@/types";
import {
  DEFAULT_TIME_SLOTS,
  FULL_DAY,
  HALF_DAY_EVENING,
  HALF_DAY_MORNING,
} from "./config";

/** Convert "HH:mm" to minutes since midnight */
export function timeToMinutes(time: string): number {
  const normalized = normalizeTime(time);
  const [h, m] = normalized.split(":").map(Number);
  return h * 60 + m;
}

/** Accept "HH:mm", "H:mm", "hh:mm AM/PM" */
export function normalizeTime(time: string): string {
  const trimmed = time.trim();
  const ampm = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const period = ampm[3].toUpperCase();
    if (period === "AM" && h === 12) h = 0;
    if (period === "PM" && h !== 12) h += 12;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid time: ${time}`);
  return `${String(parseInt(match[1], 10)).padStart(2, "0")}:${match[2]}`;
}

export function formatTime12h(time: string): string {
  const [hStr, m] = normalizeTime(time).split(":");
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${m} ${period}`;
}

/**
 * Two intervals overlap if startA < endB && startB < endA.
 * Adjacent slots that only touch at boundary (08:50 / 08:55) do not overlap.
 */
export function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a0 = timeToMinutes(startA);
  const a1 = timeToMinutes(endA);
  const b0 = timeToMinutes(startB);
  const b1 = timeToMinutes(endB);
  return a0 < b1 && b0 < a1;
}

/**
 * Point-in-slot: a point time belongs to a slot when start <= t < end,
 * except the last minute of a slot (end boundary) still belongs to that slot
 * when t === end (inclusive end for institutional boundaries like 08:50).
 */
export function pointInSlot(time: string, slot: Pick<TimeSlot, "startTime" | "endTime">): boolean {
  const t = timeToMinutes(time);
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  return t >= start && t <= end;
}

/** Duration overlaps a slot if intervals overlap (exclusive of mere boundary touch). */
export function durationOverlapsSlot(
  startTime: string,
  endTime: string,
  slot: Pick<TimeSlot, "startTime" | "endTime">
): boolean {
  return intervalsOverlap(startTime, endTime, slot.startTime, slot.endTime);
}

export function getActiveSlots(slots?: TimeSlot[]): TimeSlot[] {
  const list = slots?.length
    ? slots
    : DEFAULT_TIME_SLOTS.map((s) => ({ ...s, active: true }));
  return list.filter((s) => s.active !== false).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function findAffectedSlots(
  startTime: string,
  endTime: string,
  slots?: TimeSlot[]
): TimeSlot[] {
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  const active = getActiveSlots(slots);

  // Point event: start === end
  if (start === end) {
    const hit = active.find((s) => pointInSlot(start, s));
    return hit ? [hit] : [];
  }

  return active.filter((s) => durationOverlapsSlot(start, end, s));
}

function coversRange(
  startTime: string,
  endTime: string,
  rangeStart: string,
  rangeEnd: string
): boolean {
  return (
    timeToMinutes(startTime) <= timeToMinutes(rangeStart) &&
    timeToMinutes(endTime) >= timeToMinutes(rangeEnd)
  );
}

export function classifyEvent(
  startTime: string,
  endTime: string,
  slots?: TimeSlot[]
): ClassificationResult {
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  const affected = findAffectedSlots(start, end, slots);

  if (coversRange(start, end, FULL_DAY.startTime, FULL_DAY.endTime)) {
    return {
      dayCategory: "FULL_DAY",
      affectedSlots: affected,
      halfDay: "FULL_DAY",
      categoryLabel: "FULL DAY",
    };
  }

  if (coversRange(start, end, HALF_DAY_MORNING.startTime, HALF_DAY_MORNING.endTime)) {
    return {
      dayCategory: "MORNING",
      affectedSlots: affected,
      halfDay: "MORNING",
      categoryLabel: "HALF DAY – MORNING",
    };
  }

  if (coversRange(start, end, HALF_DAY_EVENING.startTime, HALF_DAY_EVENING.endTime)) {
    return {
      dayCategory: "EVENING",
      affectedSlots: affected,
      halfDay: "EVENING",
      categoryLabel: "HALF DAY – EVENING",
    };
  }

  const morningCount = affected.filter((s) => s.category === "MORNING").length;
  const eveningCount = affected.filter((s) => s.category === "EVENING").length;

  let dayCategory: DayCategory;
  let halfDay: ClassificationResult["halfDay"] = "NONE";
  let categoryLabel: string;

  if (affected.length === 0) {
    dayCategory = "CUSTOM";
    categoryLabel = "Outside defined slots";
  } else if (affected.length > 1) {
    dayCategory = "MULTI_SLOT";
    categoryLabel =
      morningCount > 0 && eveningCount > 0
        ? "Multi-slot (Morning & Evening)"
        : morningCount > 0
          ? "Multi-slot (Morning)"
          : "Multi-slot (Evening)";
    if (morningCount > 0 && eveningCount === 0) halfDay = "NONE";
  } else if (affected[0].category === "MORNING") {
    dayCategory = "MORNING";
    categoryLabel = "Morning";
  } else {
    dayCategory = "EVENING";
    categoryLabel = "Evening";
  }

  return { dayCategory, affectedSlots: affected, halfDay, categoryLabel };
}

export function slotIdsForEvent(startTime: string, endTime: string, slots?: TimeSlot[]): string[] {
  return findAffectedSlots(startTime, endTime, slots).map((s) => s.id);
}
