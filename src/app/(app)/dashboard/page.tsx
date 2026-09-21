import Link from "next/link";
import { getDashboardStats, getUpcomingEvents } from "@/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTime12h } from "@/lib/time-slots";
import { AlertTriangle, Calendar, MapPin, Sunrise, Sunset, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const [statsRes, upcomingRes] = await Promise.all([getDashboardStats(), getUpcomingEvents()]);
  const stats = statsRes.success ? statsRes.data : null;
  const upcoming = upcomingRes.success ? upcomingRes.data : [];

  return (
    <div className="space-y-6">
      <div className="glass-strong flex flex-wrap items-center gap-5 rounded-[28px] p-5 md:p-6">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--primary)] md:text-3xl">
            Today at a glance
          </h1>
          <p className="mt-1 text-sm font-medium text-[var(--muted-foreground)]">
            Your campus schedule, morning through evening — pressable, clear, and human.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href="/events/new">Add Event</Link>
        </Button>
      </div>

      {!stats ? (
        <Card>
          <CardContent className="py-8 text-center text-[var(--muted-foreground)]">
            Unable to load dashboard. Connect Supabase and sign in.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Today's Events" value={stats.todayTotal} icon={<Calendar className="h-4 w-4" />} />
            <StatCard title="Morning" value={stats.todayMorning} icon={<Sunrise className="h-4 w-4" />} tone="morning" />
            <StatCard title="Evening" value={stats.todayEvening} icon={<Sunset className="h-4 w-4" />} tone="evening" />
            <StatCard title="Full Day" value={stats.todayFullDay} icon={<Sun className="h-4 w-4" />} tone="fullday" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Upcoming" value={stats.upcoming} />
            <StatCard title="Total Events" value={stats.totalEvents} />
            <StatCard title="Locations in Use" value={stats.locationsInUse} icon={<MapPin className="h-4 w-4" />} />
            <StatCard
              title="Conflicts"
              value={stats.conflicts}
              icon={<AlertTriangle className="h-4 w-4" />}
              tone={stats.conflicts > 0 ? "conflict" : undefined}
            />
          </div>
        </>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Upcoming Events</CardTitle>
          <Button asChild variant="secondary" size="sm">
            <Link href="/calendar">Open Calendar</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="rounded-2xl neu-inset py-10 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">No upcoming events scheduled.</p>
              <Button asChild className="mt-3" size="sm" variant="accent">
                <Link href="/events/new">Add Event</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl neu-inset px-4 py-3"
                >
                  <div>
                    <Link href={`/events/${e.id}`} className="font-semibold hover:underline">
                      {e.eventName}
                    </Link>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {e.name} · {e.registrationNumber} · {e.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Badge variant="outline">{e.date}</Badge>
                    <span>
                      {formatTime12h(e.startTime)} – {formatTime12h(e.endTime)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "morning" | "evening" | "fullday" | "conflict";
}) {
  const tint =
    tone === "morning"
      ? "bg-[var(--morning)]/50"
      : tone === "evening"
        ? "bg-[var(--evening)]/50"
        : tone === "fullday"
          ? "bg-[var(--fullday)]/50"
          : tone === "conflict"
            ? "bg-[var(--conflict)]/70"
            : "";

  return (
    <Card className={cn(tint)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--muted-foreground)]">{title}</CardTitle>
        {icon && (
          <span className="glass-inset flex h-8 w-8 items-center justify-center rounded-xl">{icon}</span>
        )}
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl font-extrabold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
