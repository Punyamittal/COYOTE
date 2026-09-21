import { describe, expect, it } from "vitest";
import {
  classifyEvent,
  findAffectedSlots,
  normalizeTime,
  pointInSlot,
  timeToMinutes,
} from "@/lib/time-slots/classify";
import { DEFAULT_TIME_SLOTS } from "@/lib/time-slots/config";
import { detectConflicts } from "@/lib/time-slots/conflicts";
import { roleHasPermission } from "@/lib/permissions";
import type { ScheduleEvent } from "@/types";

const slots = DEFAULT_TIME_SLOTS.map((s) => ({ ...s, active: true }));

describe("normalizeTime", () => {
  it("parses 24h and 12h", () => {
    expect(normalizeTime("08:00")).toBe("08:00");
    expect(normalizeTime("10:10 AM")).toBe("10:10");
    expect(normalizeTime("2:00 PM")).toBe("14:00");
    expect(normalizeTime("12:00 PM")).toBe("12:00");
    expect(normalizeTime("12:00 AM")).toBe("00:00");
  });
});

describe("time categorization", () => {
  it("maps 08:00 to first slot", () => {
    const affected = findAffectedSlots("08:00", "08:00", slots);
    expect(affected.map((s) => s.id)).toEqual(["morning-1"]);
  });

  it("maps 08:50 to first slot boundary", () => {
    expect(pointInSlot("08:50", slots[0])).toBe(true);
    const affected = findAffectedSlots("08:50", "08:50", slots);
    expect(affected[0]?.id).toBe("morning-1");
  });

  it("maps 08:55 to second slot", () => {
    const affected = findAffectedSlots("08:55", "08:55", slots);
    expect(affected[0]?.id).toBe("morning-2");
  });

  it("maps 10:10 to third slot", () => {
    const affected = findAffectedSlots("10:10", "10:10", slots);
    expect(affected[0]?.id).toBe("morning-3");
  });

  it("maps duration 10:15–12:00 across three morning slots", () => {
    const affected = findAffectedSlots("10:15", "12:00", slots);
    expect(affected.map((s) => s.id)).toEqual(["morning-3", "morning-4", "morning-5"]);
  });

  it("classifies 08:00–13:20 as half day morning", () => {
    const result = classifyEvent("08:00", "13:20", slots);
    expect(result.halfDay).toBe("MORNING");
    expect(result.categoryLabel).toContain("HALF DAY");
  });

  it("classifies 14:00–19:20 as half day evening", () => {
    const result = classifyEvent("14:00", "19:20", slots);
    expect(result.halfDay).toBe("EVENING");
  });

  it("classifies 08:00–19:20 as full day", () => {
    const result = classifyEvent("08:00", "19:20", slots);
    expect(result.dayCategory).toBe("FULL_DAY");
    expect(result.halfDay).toBe("FULL_DAY");
  });

  it("maps 14:00 to afternoon first slot", () => {
    expect(findAffectedSlots("14:00", "14:00", slots)[0]?.id).toBe("evening-1");
  });

  it("maps 19:20 to final slot", () => {
    expect(findAffectedSlots("19:20", "19:20", slots)[0]?.id).toBe("evening-6");
  });

  it("includes 13:20 as morning half-day boundary in morning-6", () => {
    expect(timeToMinutes("13:20")).toBe(13 * 60 + 20);
    expect(findAffectedSlots("13:20", "13:20", slots)[0]?.id).toBe("morning-6");
  });
});

function ev(partial: Partial<ScheduleEvent> & Pick<ScheduleEvent, "id" | "startTime" | "endTime">): ScheduleEvent {
  return {
    date: "2026-09-21",
    name: "A",
    registrationNumber: "R1",
    eventName: "E",
    location: "L1",
    remarks: null,
    description: null,
    department: null,
    categoryId: null,
    organizer: null,
    contactInfo: null,
    dayCategory: "MORNING",
    affectedSlots: [],
    createdBy: null,
    updatedBy: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("conflict detection", () => {
  const base = ev({ id: "1", startTime: "10:00", endTime: "11:00", name: "Rahul", registrationNumber: "24BAI1234", location: "MG" });

  it("detects overlapping person conflict", () => {
    const result = detectConflicts(
      {
        date: "2026-09-21",
        startTime: "10:30",
        endTime: "11:30",
        name: "Rahul",
        registrationNumber: "24BAI1234",
        location: "Lab",
        eventName: "Other",
      },
      [base]
    );
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts.some((c) => c.type === "PERSON")).toBe(true);
  });

  it("allows non-overlapping events", () => {
    const result = detectConflicts(
      {
        date: "2026-09-21",
        startTime: "11:00",
        endTime: "12:00",
        name: "Rahul",
        registrationNumber: "24BAI1234",
        location: "MG",
        eventName: "Other",
      },
      [base]
    );
    expect(result.hasConflicts).toBe(false);
  });

  it("detects location overlap", () => {
    const result = detectConflicts(
      {
        date: "2026-09-21",
        startTime: "10:30",
        endTime: "11:30",
        name: "Priya",
        registrationNumber: "24BAI9999",
        location: "MG",
        eventName: "Setup",
      },
      [base]
    );
    expect(result.conflicts.some((c) => c.type === "LOCATION")).toBe(true);
  });

  it("ignores different location without person match", () => {
    const result = detectConflicts(
      {
        date: "2026-09-21",
        startTime: "10:30",
        endTime: "11:30",
        name: "Priya",
        registrationNumber: "24BAI9999",
        location: "Lab 3",
        eventName: "Setup",
      },
      [base]
    );
    expect(result.hasConflicts).toBe(false);
  });

  it("ignores different registration when names differ", () => {
    const result = detectConflicts(
      {
        date: "2026-09-21",
        startTime: "10:30",
        endTime: "11:30",
        name: "Other Person",
        registrationNumber: "XX",
        location: "Elsewhere",
        eventName: "X",
      },
      [base]
    );
    expect(result.hasConflicts).toBe(false);
  });
});

describe("permissions", () => {
  it("grants Main Admin full access", () => {
    expect(roleHasPermission("MAIN_ADMIN", "users:manage")).toBe(true);
    expect(roleHasPermission("MAIN_ADMIN", "settings:manage")).toBe(true);
    expect(roleHasPermission("MAIN_ADMIN", "conflicts:override")).toBe(true);
  });

  it("restricts Admin from settings by default", () => {
    expect(roleHasPermission("ADMIN", "settings:manage")).toBe(false);
    expect(roleHasPermission("ADMIN", "events:delete")).toBe(true);
  });

  it("limits User to own updates", () => {
    expect(roleHasPermission("USER", "events:update")).toBe(false);
    expect(roleHasPermission("USER", "events:update_own")).toBe(true);
    expect(roleHasPermission("USER", "users:manage")).toBe(false);
  });
});
