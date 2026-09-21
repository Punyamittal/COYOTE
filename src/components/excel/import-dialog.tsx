"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { previewImportExcel, commitImportExcel } from "@/actions/excel";
import { fileToBase64 } from "@/lib/excel/download";
import type { ImportPreviewResult, ImportRow } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ExcelImportDialog({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onFileChange(file: File | null) {
    if (!file) return;
    startTransition(async () => {
      try {
        const base64 = await fileToBase64(file);
        const result = await previewImportExcel(base64);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setPreview(result.data);
        if (result.data.valid.length === 0 && result.data.errors.length > 0) {
          toast.error("No valid rows found. Review errors below.");
        } else {
          toast.success(
            `Preview ready: ${result.data.valid.length} valid, ${result.data.errors.length} errors`
          );
        }
      } catch {
        toast.error("Unable to read the uploaded file.");
      }
    });
  }

  function onCommit(rows: ImportRow[]) {
    if (!rows.length) return;
    startTransition(async () => {
      const result = await commitImportExcel(rows);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Imported ${result.data.inserted} event(s).`);
      setOpen(false);
      reset();
      onImported?.();
    });
  }

  const previewRows = preview?.preview?.length ? preview.preview : preview?.valid.slice(0, 25) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Upload className="h-4 w-4" />
          Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Excel</DialogTitle>
          <DialogDescription>
            Upload a timetable or event spreadsheet. Rows are validated and previewed before anything
            is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            disabled={pending}
          />

          {preview && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{preview.valid.length} valid</Badge>
                <Badge variant={preview.errors.length ? "destructive" : "outline"}>
                  {preview.errors.length} errors
                </Badge>
              </div>

              {preview.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border border-[var(--border)] bg-[var(--conflict)]/40 p-3 text-sm">
                  <p className="mb-2 font-medium">Validation errors</p>
                  <ul className="space-y-1 text-[var(--muted-foreground)]">
                    {preview.errors.slice(0, 50).map((err, i) => (
                      <li key={`${err.row}-${i}`}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {previewRows.length > 0 && (
                <div className="max-h-56 overflow-auto rounded-md border border-[var(--border)]">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead className="sticky top-0 bg-[var(--muted)] text-left">
                      <tr>
                        <th className="p-2">Row</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Time</th>
                        <th className="p-2">Event</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Reg</th>
                        <th className="p-2">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.registrationNumber}`} className="border-t border-[var(--border)]">
                          <td className="p-2">{row.rowNumber}</td>
                          <td className="p-2 whitespace-nowrap">{row.date}</td>
                          <td className="p-2 whitespace-nowrap">
                            {row.startTime}–{row.endTime}
                          </td>
                          <td className="p-2">{row.eventName}</td>
                          <td className="p-2">{row.name}</td>
                          <td className="p-2">{row.registrationNumber}</td>
                          <td className="p-2">{row.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pending || preview.valid.length === 0}
                  onClick={() => onCommit(preview.valid)}
                >
                  {pending ? "Importing…" : `Import ${preview.valid.length} valid records`}
                </Button>
                <Button type="button" variant="outline" onClick={reset} disabled={pending}>
                  Clear
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
