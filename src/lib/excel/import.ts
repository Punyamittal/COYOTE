import * as XLSX from "xlsx";
import type { ImportError, ImportPreviewResult, ImportRow } from "@/types";
import { normalizeTime } from "@/lib/time-slots";

const PREVIEW_LIMIT = 50;

type FieldKey =
  | "date"
  | "name"
  | "registrationNumber"
  | "eventName"
  | "location"
  | "startTime"
  | "endTime"
  | "remarks";

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  date: ["date", "dt", "event date", "day"],
  name: ["name", "person", "person name", "student name", "faculty name"],
  registrationNumber: [
    "registration",
    "registration number",
    "reg",
    "reg no",
    "reg. no",
    "regno",
    "roll",
    "roll no",
    "roll number",
  ],
  eventName: [
    "event",
    "event name",
    "work",
    "work being done",
    "activity",
    "title",
    "description",
  ],
  location: ["location", "venue", "place", "room", "hall"],
  startTime: ["start", "start time", "from", "begin", "starttime"],
  endTime: ["end", "end time", "to", "until", "endtime"],
  remarks: ["remarks", "remark", "notes", "note", "comment", "comments"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\n\r]+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function detectColumnMap(headers: unknown[]): Partial<Record<FieldKey, number>> {
  const map: Partial<Record<FieldKey, number>> = {};
  const normalized = headers.map(normalizeHeader);

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [FieldKey, string[]][]) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[field] = idx;
  }

  // Fallback: fuzzy contains match for unmatched fields
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [FieldKey, string[]][]) {
    if (map[field] !== undefined) continue;
    const idx = normalized.findIndex((h) =>
      aliases.some((a) => h === a || h.includes(a) || a.includes(h))
    );
    if (idx >= 0 && !Object.values(map).includes(idx)) {
      map[field] = idx;
    }
  }

  return map;
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    // Excel serial date?
    return String(value);
  }
  return String(value).trim();
}

function excelSerialToIsoDate(serial: number): string | null {
  // Excel epoch (Windows) 1899-12-30
  if (!Number.isFinite(serial) || serial < 1) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateValue(raw: unknown): string | null {
  if (raw == null || raw === "") return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof raw === "number") {
    return excelSerialToIsoDate(raw);
  }

  const text = cellToString(raw);
  if (!text) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${month}-${day}`;
  }

  // MM/DD/YYYY (ambiguous — try if day > 12 already handled above as dmy when day first)
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

function parseTimeValue(raw: unknown): string | null {
  if (raw == null || raw === "") return null;

  if (typeof raw === "number") {
    // Excel time fraction of day
    const totalMinutes = Math.round((raw % 1) * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  if (raw instanceof Date) {
    return `${String(raw.getHours()).padStart(2, "0")}:${String(raw.getMinutes()).padStart(2, "0")}`;
  }

  const text = cellToString(raw);
  if (!text) return null;

  try {
    return normalizeTime(text);
  } catch {
    // Try bare hour like "9" or "14"
    const hourOnly = text.match(/^(\d{1,2})$/);
    if (hourOnly) {
      const h = parseInt(hourOnly[1], 10);
      if (h >= 0 && h <= 23) return `${String(h).padStart(2, "0")}:00`;
    }
    return null;
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function pickSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  // Prefer a sheet that looks like a flat event list (has "date" header)
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    if (!rows.length) continue;
    const map = detectColumnMap(rows[0] ?? []);
    if (map.date !== undefined && map.name !== undefined) {
      return sheet;
    }
  }
  const first = workbook.Sheets[workbook.SheetNames[0]];
  if (!first) throw new Error("Workbook has no sheets.");
  return first;
}

/**
 * Parse an uploaded Excel/CSV ArrayBuffer into validated import rows.
 * Does not write to the database.
 */
export function parseImportExcel(buffer: ArrayBuffer): ImportPreviewResult {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: true,
  });

  if (!workbook.SheetNames.length) {
    return {
      valid: [],
      errors: [{ row: 0, message: "The workbook has no sheets." }],
      preview: [],
    };
  }

  const sheet = pickSheet(workbook);
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (matrix.length < 2) {
    return {
      valid: [],
      errors: [{ row: 0, message: "No data rows found. Expected a header row and at least one data row." }],
      preview: [],
    };
  }

  const headerRow = matrix[0] ?? [];
  const columnMap = detectColumnMap(headerRow);

  const required: FieldKey[] = [
    "date",
    "name",
    "registrationNumber",
    "eventName",
    "location",
    "startTime",
    "endTime",
  ];
  const missing = required.filter((k) => columnMap[k] === undefined);
  if (missing.length) {
    return {
      valid: [],
      errors: [
        {
          row: 1,
          message: `Could not detect required columns: ${missing.join(", ")}. Found headers: ${headerRow
            .map((h) => cellToString(h))
            .filter(Boolean)
            .join(", ")}`,
        },
      ],
      preview: [],
    };
  }

  const valid: ImportRow[] = [];
  const errors: ImportError[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const excelRow = i + 1; // 1-based spreadsheet row

    const get = (key: FieldKey): unknown => {
      const idx = columnMap[key];
      return idx === undefined ? null : row[idx];
    };

    // Skip completely empty rows
    const rawValues = required.map((k) => get(k));
    if (rawValues.every((v) => cellToString(v) === "")) continue;

    const date = parseDateValue(get("date"));
    const startTime = parseTimeValue(get("startTime"));
    const endTime = parseTimeValue(get("endTime"));
    const name = cellToString(get("name"));
    const registrationNumber = cellToString(get("registrationNumber"));
    const eventName = cellToString(get("eventName"));
    const location = cellToString(get("location"));
    const remarksRaw = cellToString(get("remarks"));
    const remarks = remarksRaw || null;

    const rowErrors: string[] = [];
    if (!date) rowErrors.push("Invalid or missing date");
    if (!name) rowErrors.push("Name is required");
    if (!registrationNumber) rowErrors.push("Registration number is required");
    if (!eventName) rowErrors.push("Event name is required");
    if (!location) rowErrors.push("Location is required");
    if (!startTime) rowErrors.push("Invalid or missing start time");
    if (!endTime) rowErrors.push("Invalid or missing end time");
    if (startTime && endTime && timeToMinutes(endTime) < timeToMinutes(startTime)) {
      rowErrors.push("End time must be later than or equal to start time");
    }

    if (rowErrors.length) {
      errors.push({ row: excelRow, message: rowErrors.join("; ") });
      continue;
    }

    valid.push({
      rowNumber: excelRow,
      date: date!,
      startTime: startTime!,
      endTime: endTime!,
      name,
      registrationNumber,
      eventName,
      location,
      remarks,
    });
  }

  return {
    valid,
    errors,
    preview: valid.slice(0, PREVIEW_LIMIT),
  };
}
