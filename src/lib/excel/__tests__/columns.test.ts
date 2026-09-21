import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { TIMETABLE_COLUMNS } from "@/lib/time-slots/config";

describe("excel timetable columns", () => {
  it("includes corrected 12:30 PM header and all institutional columns", () => {
    const headers = TIMETABLE_COLUMNS.map((c) => c.header);
    expect(headers.some((h) => h.includes("12:30 PM TO 1:20 PM"))).toBe(true);
    expect(headers.some((h) => /12:30\s*AM/i.test(h))).toBe(false);
    expect(TIMETABLE_COLUMNS[0].key).toBe("sl_no");
    expect(TIMETABLE_COLUMNS[TIMETABLE_COLUMNS.length - 1].key).toBe("remarks");
  });

  it("can create a workbook with timetable headers", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Timetable");
    ws.addRow(TIMETABLE_COLUMNS.map((c) => c.header.replace(/\n/g, " ")));
    expect(ws.rowCount).toBe(1);
    expect(ws.getRow(1).getCell(1).value).toBe("SL No");
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(100);
  });
});
