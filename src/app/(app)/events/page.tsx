"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { flexRender } from "@tanstack/react-table";
import {
  getCoreRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import type { RowSelectionState } from "@tanstack/table-core";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bulkDeleteEvents, listEvents } from "@/actions/events";
import { formatTime12h } from "@/lib/time-slots";
import { formatDateIST } from "@/lib/utils";
import { useFilterStore } from "@/lib/stores/filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExcelExportButton } from "@/components/excel/export-menu";
import { ExcelImportDialog } from "@/components/excel/import-dialog";
import { BulkEditDialog } from "@/components/events/bulk-edit-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScheduleEvent } from "@/types";

export default function EventsPage() {
  const { filters, setFilters } = useFilterStore();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(filters.search ?? "");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      const result = await listEvents({
        ...filters,
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 50,
        sortBy: filters.sortBy ?? "date",
        sortDir: filters.sortDir ?? "desc",
      });
      if (cancelled) return;
      setLoading(false);
      if (!result.success) {
        toast.error(result.error);
        setEvents([]);
        setTotal(0);
        return;
      }
      setEvents(result.data.data);
      setTotal(result.data.total);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listEvents({
      ...filters,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 50,
      sortBy: filters.sortBy ?? "date",
      sortDir: filters.sortDir ?? "desc",
    });
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
      setEvents([]);
      setTotal(0);
      return;
    }
    setEvents(result.data.data);
    setTotal(result.data.total);
  }, [filters]);

  const columns = useMemo<LegacyColumnDef<ScheduleEvent>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="h-4 w-4 accent-[var(--primary)]"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label="Select row"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 accent-[var(--primary)]"
          />
        ),
        size: 40,
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => formatDateIST(row.original.date),
      },
      {
        id: "time",
        header: "Time",
        cell: ({ row }) =>
          `${formatTime12h(row.original.startTime)} – ${formatTime12h(row.original.endTime)}`,
      },
      {
        accessorKey: "eventName",
        header: "Event",
        cell: ({ row }) => (
          <Link href={`/events/${row.original.id}`} className="font-medium hover:underline">
            {row.original.eventName}
          </Link>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "registrationNumber",
        header: "Reg. No.",
      },
      {
        accessorKey: "location",
        header: "Location",
      },
      {
        accessorKey: "dayCategory",
        header: "Category",
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.dayCategory.replace("_", " ")}</Badge>
        ),
      },
    ],
    []
  );

  const table = useLegacyTable({
    data: events,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  function applySearch() {
    setFilters({ search: search || undefined, page: 1 });
  }

  function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const result = await bulkDeleteEvents(selectedIds);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted ${result.data.count} event(s)`);
      setRowSelection({});
      void load();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">Events</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Browse, search, and manage schedule entries ({total} total)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelExportButton />
          <ExcelImportDialog onImported={() => void load()} />
          <Button asChild>
            <Link href="/events/new">
              <Plus className="h-4 w-4" />
              New Event
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">All events</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                className="w-56 pl-8"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
              />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={applySearch}>
              Search
            </Button>
            {selectedIds.length > 0 && (
              <>
              <BulkEditDialog ids={selectedIds} onDone={() => { setRowSelection({}); void load(); }} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm" disabled={pending}>
                    <Trash2 className="h-4 w-4" />
                    Delete ({selectedIds.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete selected events?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Permanently delete {selectedIds.length} event(s). This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto rounded-md border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--muted)]">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th key={h.id} className="px-3 py-2 text-left font-medium">
                          {h.isPlaceholder
                            ? null
                            : flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-3 py-10 text-center text-[var(--muted-foreground)]"
                      >
                        No events found.{" "}
                        <Link href="/events/new" className="text-[var(--primary)] underline">
                          Create one
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-[var(--border)] hover:bg-[var(--muted)]/50"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 py-2 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(() => {
        const page = filters.page ?? 1;
        const pageSize = filters.pageSize ?? 50;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        return (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setFilters({ page: page - 1 })}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setFilters({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
