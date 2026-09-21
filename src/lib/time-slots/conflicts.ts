import type { ConflictFlag, ConflictResult, ScheduleEvent } from "@/types";
import { intervalsOverlap, normalizeTime } from "./classify";

export interface ConflictCheckInput {
  id?: string;
  date: string;
  startTime: string;
  endTime: string;
  name: string;
  registrationNumber: string;
  location: string;
  eventName: string;
}

function samePerson(a: ConflictCheckInput, b: Pick<ScheduleEvent, "name" | "registrationNumber">): boolean {
  const regA = a.registrationNumber.trim().toLowerCase();
  const regB = b.registrationNumber.trim().toLowerCase();
  if (regA && regB && regA === regB) return true;
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase() && !!regA && regA === regB;
}

export function detectConflicts(
  candidate: ConflictCheckInput,
  existing: ScheduleEvent[]
): ConflictResult {
  const conflicts: ConflictFlag[] = [];
  const start = normalizeTime(candidate.startTime);
  const end = normalizeTime(candidate.endTime);

  for (const event of existing) {
    if (candidate.id && event.id === candidate.id) continue;
    if (event.date !== candidate.date) continue;

    const overlaps = intervalsOverlap(start, end, event.startTime, event.endTime);
    if (!overlaps) continue;

    const regMatch =
      candidate.registrationNumber.trim().toLowerCase() ===
      event.registrationNumber.trim().toLowerCase();
    const nameMatch =
      candidate.name.trim().toLowerCase() === event.name.trim().toLowerCase();
    const locationMatch =
      candidate.location.trim().toLowerCase() === event.location.trim().toLowerCase();
    const exactMatch =
      regMatch &&
      nameMatch &&
      locationMatch &&
      candidate.eventName.trim().toLowerCase() === event.eventName.trim().toLowerCase();

    if (exactMatch) {
      conflicts.push({
        type: "EXACT",
        message: `Identical/overlapping entry already exists for ${event.name} (${event.registrationNumber}) at ${event.location} from ${event.startTime} – ${event.endTime}.`,
        conflictingEventId: event.id,
      });
    }

    if (regMatch || (nameMatch && regMatch)) {
      conflicts.push({
        type: "PERSON",
        message: `${event.name} (${event.registrationNumber}) is already scheduled from ${event.startTime} – ${event.endTime}. Current event: ${start} – ${end}.`,
        conflictingEventId: event.id,
      });
    } else if (nameMatch && samePerson(candidate, event)) {
      conflicts.push({
        type: "PERSON",
        message: `${event.name} is already scheduled from ${event.startTime} – ${event.endTime}.`,
        conflictingEventId: event.id,
      });
    }

    if (locationMatch) {
      conflicts.push({
        type: "LOCATION",
        message: `Location "${event.location}" is already booked from ${event.startTime} – ${event.endTime} by ${event.eventName}.`,
        conflictingEventId: event.id,
      });
    }
  }

  // Deduplicate by type+conflictingEventId
  const seen = new Set<string>();
  const unique = conflicts.filter((c) => {
    const key = `${c.type}:${c.conflictingEventId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { hasConflicts: unique.length > 0, conflicts: unique };
}
