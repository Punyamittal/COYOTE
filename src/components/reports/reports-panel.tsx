"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getDailyReport,
  getDateRangeReport,
  getLocationUtilization,
  getPersonReport,
  getTimeSlotUtilization,
} from "@/actions/reports";
import { todayIST } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Tab = "daily" | "range" | "location" | "person" | "slots";

export function ReportsPanel() {
  const [tab, setTab] = useState<Tab>("daily");
  const [date, setDate] = useState(todayIST());
  const [dateFrom, setDateFrom] = useState(todayIST());
  const [dateTo, setDateTo] = useState(todayIST());
  const [reg, setReg] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(() => {
      void (async () => {
        if (tab === "daily") {
          const r = await getDailyReport(date);
          if (!r.success) {
            toast.error(r.error);
            return;
          }
          setRows(
            r.data.events.map((e) => ({
              date: e.date,
              time: `${e.startTime}-${e.endTime}`,
              event: e.eventName,
              name: e.name,
              reg: e.registrationNumber,
              location: e.location,
              category: e.dayCategory,
            }))
          );
        } else if (tab === "range") {
          const r = await getDateRangeReport(dateFrom, dateTo);
          if (!r.success) {
            toast.error(r.error);
            return;
          }
          setRows(r.data.byDate.map((d) => ({ date: d.date, count: d.count })));
        } else if (tab === "location") {
          const r = await getLocationUtilization(dateFrom, dateTo);
          if (!r.success) {
            toast.error(r.error);
            return;
          }
          setRows(r.data.rows as unknown as Record<string, unknown>[]);
        } else if (tab === "person") {
          const r = await getPersonReport({
            registrationNumber: reg || undefined,
            dateFrom,
            dateTo,
          });
          if (!r.success) {
            toast.error(r.error);
            return;
          }
          setRows(
            r.data.rows.map((p) => ({
              name: p.name,
              registrationNumber: p.registrationNumber,
              eventCount: p.eventCount,
              locations: p.locations.join(", "),
            }))
          );
        } else {
          const r = await getTimeSlotUtilization(dateFrom, dateTo);
          if (!r.success) {
            toast.error(r.error);
            return;
          }
          setRows(r.data.rows as unknown as Record<string, unknown>[]);
        }
      })();
    });
  }

  function exportCsv() {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const lines = [
      keys.join(","),
      ...rows.map((row) =>
        keys
          .map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `report-${tab}.csv`;
    a.click();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "daily", label: "Daily" },
    { id: "range", label: "Date Range" },
    { id: "location", label: "Location Utilization" },
    { id: "person", label: "Person / Registration" },
    { id: "slots", label: "Time Slot Utilization" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "default" : "outline"}
            onClick={() => {
              setTab(t.id);
              setRows([]);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          {tab === "daily" ? (
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </>
          )}
          {tab === "person" && (
            <div className="space-y-1">
              <Label>Registration Number</Label>
              <Input value={reg} onChange={(e) => setReg(e.target.value)} placeholder="Optional" />
            </div>
          )}
          <Button onClick={run} disabled={pending}>
            {pending ? "Loading…" : "Run Report"}
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-auto p-0">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--muted-foreground)]">
              Run a report to see results.
            </p>
          ) : (
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-[var(--muted)] text-left">
                <tr>
                  {Object.keys(rows[0]).map((k) => (
                    <th key={k} className="p-3 capitalize">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    {Object.keys(rows[0]).map((k) => (
                      <td key={k} className="p-3 align-top">
                        {String(row[k] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
