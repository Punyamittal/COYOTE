import ExcelJS from "exceljs";
import type { ScheduleEvent } from "@/types";
import {
  DEFAULT_TIME_SLOTS,
  TIMETABLE_COLUMNS,
  detectConflicts,
  formatTime12h,
} from "@/lib/time-slots";

const MAX_COL_WIDTH = 40;
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2E8F0" },
};

function eventCellText(event: ScheduleEvent): string {
  return [event.eventName, event.name, event.registrationNumber, event.location]
    .map((s) => (s ?? "").trim())
    .join("\n");
}

function isHalfDayMorning(event: ScheduleEvent): boolean {
  if (event.dayCategory !== "MORNING") return false;
  const morningIds = DEFAULT_TIME_SLOTS.filter((s) => s.category === "MORNING").map((s) => s.id);
  return morningIds.every((id) => event.affectedSlots.includes(id));
}

function isHalfDayEvening(event: ScheduleEvent): boolean {
  if (event.dayCategory !== "EVENING") return false;
  const eveningIds = DEFAULT_TIME_SLOTS.filter((s) => s.category === "EVENING").map((s) => s.id);
  return eveningIds.every((id) => event.affectedSlots.includes(id));
}

/** Column keys (excluding sl_no / date / remarks) where this event should appear. */
function placementKeys(event: ScheduleEvent): string[] {
  if (event.dayCategory === "FULL_DAY") {
    return ["full_day"];
  }
  if (isHalfDayMorning(event)) {
    return ["half_day_morning"];
  }
  if (isHalfDayEvening(event)) {
    return ["half_day_evening"];
  }
  // Multi-slot and single-slot: one cell per affected slot
  return event.affectedSlots.filter((id) =>
    TIMETABLE_COLUMNS.some((c) => c.key === id)
  );
}

function appendCell(map: Map<string, string>, key: string, text: string) {
  const prev = map.get(key);
  map.set(key, prev ? `${prev}\n\n${text}` : text);
}

function applyHeaderRow(sheet: ExcelJS.Worksheet, headers: string[]) {
  const row = sheet.getRow(1);
  headers.forEach((header, i) => {
    const cell = row.getCell(i + 1);
    cell.value = header;
    cell.font = { bold: true, size: 11 };
    cell.fill = HEADER_FILL;
    cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
  });
  row.height = 36;
}

function styleDataCell(cell: ExcelJS.Cell, opts?: { date?: boolean; wrap?: boolean }) {
  cell.border = THIN_BORDER;
  cell.alignment = {
    wrapText: opts?.wrap ?? true,
    vertical: "top",
    horizontal: opts?.date ? "center" : "left",
  };
  if (opts?.date) {
    cell.numFmt = "dd-mmm-yyyy";
  }
}

function autoFitColumns(sheet: ExcelJS.Worksheet, minWidth = 8) {
  sheet.columns.forEach((col) => {
    let max = minWidth;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const raw = cell.value;
      const text =
        raw == null
          ? ""
          : typeof raw === "object" && "text" in raw
            ? String((raw as { text: string }).text)
            : String(raw);
      for (const line of text.split("\n")) {
        max = Math.max(max, line.length + 2);
      }
    });
    col.width = Math.min(max, MAX_COL_WIDTH);
  });
}

function parseDateValue(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function buildTimetableSheet(workbook: ExcelJS.Workbook, events: ScheduleEvent[]) {
  const sheet = workbook.addWorksheet("Timetable", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
  });

  const headers = TIMETABLE_COLUMNS.map((c) => c.header);
  applyHeaderRow(sheet, headers);

  const byDate = new Map<string, ScheduleEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }

  const dates = [...byDate.keys()].sort();
  let sl = 1;

  for (const date of dates) {
    const dayEvents = byDate.get(date) ?? [];
    dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));

    const cells = new Map<string, string>();
    const remarksParts: string[] = [];

    for (const event of dayEvents) {
      const text = eventCellText(event);
      for (const key of placementKeys(event)) {
        appendCell(cells, key, text);
      }
      if (event.remarks?.trim()) {
        remarksParts.push(`${event.eventName}: ${event.remarks.trim()}`);
      }
    }

    const row = sheet.addRow([]);
    TIMETABLE_COLUMNS.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      if (col.key === "sl_no") {
        cell.value = sl;
        styleDataCell(cell, { wrap: false });
        cell.alignment = { horizontal: "center", vertical: "top" };
      } else if (col.key === "date") {
        cell.value = parseDateValue(date);
        styleDataCell(cell, { date: true, wrap: false });
      } else if (col.key === "remarks") {
        cell.value = remarksParts.join("\n") || null;
        styleDataCell(cell);
      } else {
        cell.value = cells.get(col.key) ?? null;
        styleDataCell(cell);
      }
    });

    const contentLines = Math.max(
      1,
      ...[...cells.values()].map((v) => v.split("\n").length),
      remarksParts.length || 1
    );
    row.height = Math.min(15 + contentLines * 12, 120);
    sl += 1;
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, dates.length + 1), column: TIMETABLE_COLUMNS.length },
  };
  autoFitColumns(sheet, 10);
  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 14;
}

const ALL_EVENT_HEADERS = [
  "Date",
  "Start",
  "End",
  "Name",
  "Registration",
  "Event Name",
  "Location",
  "Day Category",
  "Affected Slots",
  "Remarks",
] as const;

function writeEventListSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  events: ScheduleEvent[],
  freezeCols = 1
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", xSplit: Math.min(freezeCols, 2), ySplit: 1 }],
  });
  applyHeaderRow(sheet, [...ALL_EVENT_HEADERS]);

  for (const event of events) {
    const row = sheet.addRow([
      parseDateValue(event.date),
      formatTime12h(event.startTime),
      formatTime12h(event.endTime),
      event.name,
      event.registrationNumber,
      event.eventName,
      event.location,
      event.dayCategory,
      event.affectedSlots.join(", "),
      event.remarks ?? "",
    ]);
    row.eachCell((cell, colNumber) => {
      styleDataCell(cell, { date: colNumber === 1, wrap: colNumber >= 6 });
    });
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, events.length + 1), column: ALL_EVENT_HEADERS.length },
  };
  autoFitColumns(sheet);
  sheet.getColumn(1).width = 14;
}

function buildConflictsSheet(workbook: ExcelJS.Workbook, events: ScheduleEvent[]) {
  const sheet = workbook.addWorksheet("Conflicts", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
  });
  const headers = [
    "Date",
    "Type",
    "Message",
    "Event A",
    "Reg A",
    "Event B ID",
    "Time A",
    "Location A",
  ];
  applyHeaderRow(sheet, headers);

  const byDate = new Map<string, ScheduleEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  const seenPairs = new Set<string>();
  let rowCount = 0;

  for (const [, dayEvents] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const event of dayEvents) {
      const result = detectConflicts(event, dayEvents);
      for (const flag of result.conflicts) {
        const pairKey = [event.id, flag.conflictingEventId].sort().join(":");
        const dedupe = `${pairKey}:${flag.type}`;
        if (seenPairs.has(dedupe)) continue;
        seenPairs.add(dedupe);

        const row = sheet.addRow([
          parseDateValue(event.date),
          flag.type,
          flag.message,
          event.eventName,
          event.registrationNumber,
          flag.conflictingEventId,
          `${formatTime12h(event.startTime)} – ${formatTime12h(event.endTime)}`,
          event.location,
        ]);
        row.eachCell((cell, colNumber) => {
          styleDataCell(cell, { date: colNumber === 1 });
        });
        rowCount += 1;
      }
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rowCount + 1), column: headers.length },
  };
  autoFitColumns(sheet);
}

function buildSummarySheet(workbook: ExcelJS.Workbook, events: ScheduleEvent[]) {
  const sheet = workbook.addWorksheet("Summary", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  });
  applyHeaderRow(sheet, ["Metric", "Value"]);

  const morning = events.filter(
    (e) => e.dayCategory === "MORNING" || isHalfDayMorning(e)
  ).length;
  const evening = events.filter(
    (e) => e.dayCategory === "EVENING" || isHalfDayEvening(e)
  ).length;
  const fullDay = events.filter((e) => e.dayCategory === "FULL_DAY").length;
  const multi = events.filter((e) => e.dayCategory === "MULTI_SLOT").length;
  const custom = events.filter((e) => e.dayCategory === "CUSTOM").length;
  const dates = new Set(events.map((e) => e.date));
  const locations = new Set(events.map((e) => e.location.trim().toLowerCase()));

  let conflictPairs = 0;
  const byDate = new Map<string, ScheduleEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  const seen = new Set<string>();
  for (const dayEvents of byDate.values()) {
    for (const event of dayEvents) {
      const result = detectConflicts(event, dayEvents);
      for (const flag of result.conflicts) {
        const key = [event.id, flag.conflictingEventId].sort().join(":");
        if (seen.has(key)) continue;
        seen.add(key);
        conflictPairs += 1;
      }
    }
  }

  const rows: [string, string | number][] = [
    ["Total events", events.length],
    ["Distinct dates", dates.size],
    ["Distinct locations", locations.size],
    ["Morning / half-day morning", morning],
    ["Evening / half-day evening", evening],
    ["Full day", fullDay],
    ["Multi-slot", multi],
    ["Custom / outside slots", custom],
    ["Conflict pairs", conflictPairs],
    ["Export generated at", new Date().toISOString()],
  ];

  for (const [metric, value] of rows) {
    const row = sheet.addRow([metric, value]);
    row.eachCell((cell) => styleDataCell(cell, { wrap: false }));
  }

  autoFitColumns(sheet, 12);
}

/**
 * Build a multi-sheet Excel workbook from schedule events.
 * Returns a Node.js Buffer suitable for download / base64 encoding.
 */
export async function exportEventsToExcel(events: ScheduleEvent[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Scheduling App";
  workbook.created = new Date();

  const sorted = [...events].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.startTime.localeCompare(b.startTime);
  });

  buildTimetableSheet(workbook, sorted);
  writeEventListSheet(workbook, "All Events", sorted, 2);

  const morningEvents = sorted.filter(
    (e) =>
      e.dayCategory === "MORNING" ||
      e.dayCategory === "FULL_DAY" ||
      (e.dayCategory === "MULTI_SLOT" &&
        e.affectedSlots.some((id) => id.startsWith("morning-")))
  );
  writeEventListSheet(workbook, "Morning", morningEvents, 2);

  const eveningEvents = sorted.filter(
    (e) =>
      e.dayCategory === "EVENING" ||
      e.dayCategory === "FULL_DAY" ||
      (e.dayCategory === "MULTI_SLOT" &&
        e.affectedSlots.some((id) => id.startsWith("evening-")))
  );
  writeEventListSheet(workbook, "Evening", eveningEvents, 2);

  buildConflictsSheet(workbook, sorted);
  buildSummarySheet(workbook, sorted);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
