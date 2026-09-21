"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { listEvents } from "@/actions/events";
import { useFilterStore } from "@/lib/stores/filters";
import { ExcelExportButton } from "@/components/excel/export-menu";
import { ExcelImportDialog } from "@/components/excel/import-dialog";
import {
  DEFAULT_TIME_SLOTS,
  classifyEvent,
  detectConflicts,
  formatTime12h,
} from "@/lib/time-slots";
import { cn, formatDateIST, todayIST } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventDetailDialog } from "@/components/events/event-detail-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScheduleEvent } from "@/types";

type ColumnKey =
  | "half_day_morning"
  | "half_day_evening"
  | "full_day"
  | (typeof DEFAULT_TIME_SLOTS)[number]["id"]
  | "remarks";

function eventColumnKeys(event: ScheduleEvent): ColumnKey[] {
  try {
    const c = classifyEvent(event.startTime, event.endTime);
    if (c.halfDay === "FULL_DAY") return ["full_day"];
    if (c.halfDay === "MORNING") return ["half_day_morning"];
    if (c.halfDay === "EVENING") return ["half_day_evening"];
    return (event.affectedSlots.length
      ? event.affectedSlots
      : c.affectedSlots.map((s) => s.id)) as ColumnKey[];
  } catch {
    return event.affectedSlots as ColumnKey[];
  }
}

function dayCategoryBg(event: ScheduleEvent): string {
  switch (event.dayCategory) {
    case "MORNING":
      return "bg-[var(--morning)]";
    case "EVENING":
      return "bg-[var(--evening)]";
    case "FULL_DAY":
      return "bg-[var(--fullday)]";
    case "MULTI_SLOT":
      return "bg-[var(--multislot)]";
    default:
      return "bg-[var(--muted)]";
  }
}

const SLOT_HEADERS = DEFAULT_TIME_SLOTS.map((s) => ({
  key: s.id as ColumnKey,
  label: s.label.replace(" – ", "\n"),
  short: s.label.split(" – ")[0] ?? s.label,
}));

export function TimetableView() {
  const { filters, setFilters, resetFilters } = useFilterStore();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLocal, setSearchLocal] = useState(filters.search ?? "");
  const [selected, setSelected] = useState<ScheduleEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      const result = await listEvents({
        ...filters,
        page: 1,
        pageSize: 200,
        sortBy: "date",
        sortDir: "asc",
      });
      if (cancelled) return;
      setLoading(false);
      if (!result.success) {
        toast.error(result.error);
        setEvents([]);
        return;
      }
      setEvents(result.data.data);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [filters, reloadKey]);

  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    const byDate = new Map<string, ScheduleEvent[]>();
    for (const e of events) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    for (const dayEvents of byDate.values()) {
      for (const e of dayEvents) {
        if (detectConflicts(e, dayEvents).hasConflicts) ids.add(e.id);
      }
    }
    return ids;
  }, [events]);

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  const today = todayIST();

  function openEvent(e: ScheduleEvent) {
    setSelected(e);
    setDetailOpen(true);
  }

  function eventsForColumn(dayEvents: ScheduleEvent[], key: ColumnKey): ScheduleEvent[] {
    if (key === "remarks") return dayEvents.filter((e) => e.remarks);
    return dayEvents.filter((e) => eventColumnKeys(e).includes(key));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--primary)]">Timetable</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Institutional slot grid with half-day and full-day columns
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelExportButton />
          <ExcelImportDialog onImported={reload} />
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <Label htmlFor="tt-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                id="tt-search"
                className="pl-8"
                placeholder="Name, reg no, event, location…"
                value={searchLocal}
                onChange={(e) => setSearchLocal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setFilters({ search: searchLocal || undefined, page: 1 });
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => setFilters({ dateFrom: e.target.value || undefined, page: 1 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) => setFilters({ dateTo: e.target.value || undefined, page: 1 })}
            />
          </div>
          <div className="space-y-1.5 min-w-[160px]">
            <Label>Category</Label>
            <Select
              value={filters.dayCategory ?? "all"}
              onValueChange={(v) =>
                setFilters({
                  dayCategory: v === "all" ? undefined : (v as typeof filters.dayCategory),
                  page: 1,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="MORNING">Morning</SelectItem>
                <SelectItem value="EVENING">Evening</SelectItem>
                <SelectItem value="FULL_DAY">Full day</SelectItem>
                <SelectItem value="MULTI_SLOT">Multi-slot</SelectItem>
                <SelectItem value="HALF_DAY_MORNING">Half day morning</SelectItem>
                <SelectItem value="HALF_DAY_EVENING">Half day evening</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={() => setFilters({ search: searchLocal || undefined, page: 1 })}
          >
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchLocal("");
              resetFilters();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] md:block print:block print-timetable">
            <table className="w-max min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[var(--primary)] text-[var(--primary-foreground)]">
                <tr>
                  <th className="sticky left-0 z-30 border border-white/20 bg-[var(--primary)] px-2 py-2 whitespace-nowrap">
                    SL No
                  </th>
                  <th className="sticky left-12 z-30 border border-white/20 bg-[var(--primary)] px-2 py-2 whitespace-nowrap">
                    DATE
                  </th>
                  <th className="min-w-[120px] border border-white/20 px-2 py-2 whitespace-pre-line">
                    HALF DAY{"\n"}MORNING
                  </th>
                  <th className="min-w-[120px] border border-white/20 px-2 py-2 whitespace-pre-line">
                    HALF DAY{"\n"}EVENING
                  </th>
                  <th className="min-w-[120px] border border-white/20 px-2 py-2 whitespace-pre-line">
                    FULL DAY
                  </th>
                  {SLOT_HEADERS.map((h) => (
                    <th
                      key={h.key}
                      className="min-w-[100px] border border-white/20 px-2 py-2 whitespace-pre-line"
                    >
                      {h.label}
                    </th>
                  ))}
                  <th className="min-w-[120px] border border-white/20 px-2 py-2">REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {byDate.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5 + SLOT_HEADERS.length + 1}
                      className="px-4 py-10 text-center text-[var(--muted-foreground)]"
                    >
                      No events for the selected filters.
                    </td>
                  </tr>
                ) : (
                  byDate.map(([date, dayEvents], idx) => {
                    const isToday = date === today;
                    const cols: ColumnKey[] = [
                      "half_day_morning",
                      "half_day_evening",
                      "full_day",
                      ...SLOT_HEADERS.map((h) => h.key),
                    ];
                    return (
                      <tr
                        key={date}
                        className={cn(isToday && "bg-[var(--morning)]/40", "align-top")}
                      >
                        <td
                          className={cn(
                            "sticky left-0 z-10 border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 font-medium",
                            isToday && "bg-[var(--morning)]"
                          )}
                        >
                          {idx + 1}
                        </td>
                        <td
                          className={cn(
                            "sticky left-12 z-10 border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 font-medium whitespace-nowrap",
                            isToday && "bg-[var(--morning)]"
                          )}
                        >
                          {formatDateIST(date)}
                          {isToday && (
                            <Badge className="ml-1" variant="secondary">
                              Today
                            </Badge>
                          )}
                        </td>
                        {cols.map((key) => {
                          const cellEvents = eventsForColumn(dayEvents, key);
                          const occupied = cellEvents.length > 0;
                          const hasConflict = cellEvents.some((e) => conflictIds.has(e.id));
                          return (
                            <td
                              key={key}
                              className={cn(
                                "border border-[var(--border)] px-1.5 py-1",
                                occupied && "bg-[var(--secondary)]",
                                hasConflict && "bg-[var(--conflict)]"
                              )}
                            >
                              <CellEvents events={cellEvents} conflictIds={conflictIds} onOpen={openEvent} />
                            </td>
                          );
                        })}
                        <td className="border border-[var(--border)] px-1.5 py-1 max-w-[160px]">
                          {dayEvents
                            .filter((e) => e.remarks)
                            .map((e) => (
                              <div key={e.id} className="truncate text-[10px]" title={e.remarks ?? ""}>
                                {e.remarks}
                              </div>
                            ))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden print:hidden">
            {byDate.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                  No events for the selected filters.
                </CardContent>
              </Card>
            ) : (
              byDate.map(([date, dayEvents]) => {
                const morning = dayEvents.filter((e) => {
                  const keys = eventColumnKeys(e);
                  return (
                    keys.includes("half_day_morning") ||
                    keys.some((k) => String(k).startsWith("morning-"))
                  );
                });
                const evening = dayEvents.filter((e) => {
                  const keys = eventColumnKeys(e);
                  return (
                    keys.includes("half_day_evening") ||
                    keys.includes("full_day") ||
                    keys.some((k) => String(k).startsWith("evening-"))
                  );
                });
                return (
                  <Card key={date} className={cn(date === today && "ring-2 ring-[var(--primary)]")}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>{formatDateIST(date)}</span>
                        {date === today && <Badge>Today</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <MobileSection title="Morning" events={morning} conflictIds={conflictIds} onOpen={openEvent} />
                      <MobileSection title="Evening / Full day" events={evening} conflictIds={conflictIds} onOpen={openEvent} />
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      <EventDetailDialog event={selected} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}

function CellEvents({
  events,
  conflictIds,
  onOpen,
}: {
  events: ScheduleEvent[];
  conflictIds: Set<string>;
  onOpen: (e: ScheduleEvent) => void;
}) {
  if (events.length === 0) return null;
  if (events.length > 2) {
    return (
      <button
        type="button"
        className="w-full rounded px-1 py-0.5 text-left text-[10px] font-medium hover:underline"
        onClick={() => onOpen(events[0])}
      >
        {events.length} Events
      </button>
    );
  }
  return (
    <div className="space-y-1">
      {events.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onOpen(e)}
          className={cn(
            "block w-full rounded px-1 py-0.5 text-left hover:opacity-90",
            dayCategoryBg(e),
            conflictIds.has(e.id) && "ring-1 ring-red-500"
          )}
        >
          <div className="truncate font-medium text-[10px]">{e.eventName}</div>
          <div className="truncate text-[9px] opacity-80">
            {e.name} · {formatTime12h(e.startTime)}
          </div>
        </button>
      ))}
    </div>
  );
}

function MobileSection({
  title,
  events,
  conflictIds,
  onOpen,
}: {
  title: string;
  events: ScheduleEvent[];
  conflictIds: Set<string>;
  onOpen: (e: ScheduleEvent) => void;
}) {
  const unique = [...new Map(events.map((e) => [e.id, e])).values()];
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {title}
      </p>
      {unique.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">No events</p>
      ) : (
        <ul className="space-y-2">
          {unique.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onOpen(e)}
                className={cn(
                  "w-full rounded-md p-2 text-left",
                  dayCategoryBg(e),
                  conflictIds.has(e.id) && "ring-2 ring-red-500"
                )}
              >
                <div className="font-medium text-sm">{e.eventName}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {formatTime12h(e.startTime)} – {formatTime12h(e.endTime)} · {e.location}
                </div>
                <Link
                  href={`/events/${e.id}`}
                  className="mt-1 inline-block text-xs text-[var(--primary)] underline"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  Open
                </Link>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
