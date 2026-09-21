"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { exportEventsExcel } from "@/actions/excel";
import { downloadBase64Xlsx } from "@/lib/excel/download";
import { useFilterStore } from "@/lib/stores/filters";
import type { EventFilters } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ExportScope = "current" | "dates" | "range" | "all";

export function ExcelExportButton({
  extraFilters,
  label = "Export Excel",
}: {
  extraFilters?: Partial<EventFilters>;
  label?: string;
}) {
  const { filters } = useFilterStore();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ExportScope>("current");
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");
  const [singleDate, setSingleDate] = useState(filters.date ?? "");
  const [pending, startTransition] = useTransition();

  function buildFilters(): EventFilters {
    const base: EventFilters = {
      ...filters,
      ...extraFilters,
      page: undefined,
      pageSize: undefined,
    };

    if (scope === "all") {
      return {
        search: base.search,
        sortBy: base.sortBy,
        sortDir: base.sortDir,
      };
    }
    if (scope === "dates" && singleDate) {
      return { ...base, date: singleDate, dateFrom: undefined, dateTo: undefined };
    }
    if (scope === "range") {
      return {
        ...base,
        date: undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
    }
    // current view — keep active filters
    return base;
  }

  function onExport() {
    startTransition(async () => {
      const result = await exportEventsExcel(buildFilters());
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      downloadBase64Xlsx(result.data.base64, result.data.filename);
      toast.success(`Excel export generated (${result.data.count} events).`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Download className="h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Excel</DialogTitle>
          <DialogDescription>
            Download a timetable-formatted workbook with Timetable, All Events, Morning, Evening,
            Conflicts, and Summary sheets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {(
            [
              ["current", "Export Current View"],
              ["dates", "Export Selected Date"],
              ["range", "Export Date Range"],
              ["all", "Export All"],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] p-3 text-sm hover:bg-[var(--muted)]"
            >
              <input
                type="radio"
                name="export-scope"
                checked={scope === value}
                onChange={() => setScope(value)}
                className="accent-[var(--primary)]"
              />
              {text}
            </label>
          ))}

          {scope === "dates" && (
            <div className="space-y-1">
              <Label htmlFor="export-date">Date</Label>
              <Input
                id="export-date"
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
              />
            </div>
          )}
          {scope === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="export-from">From</Label>
                <Input
                  id="export-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="export-to">To</Label>
                <Input
                  id="export-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <Button type="button" onClick={onExport} disabled={pending} className="w-full">
          {pending ? "Generating…" : "Download .xlsx"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
