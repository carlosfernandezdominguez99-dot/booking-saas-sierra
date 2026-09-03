import Link from "next/link";
import { requireBusinessContext } from "@/lib/services/authContext";
import { listBookingsWithDetails, type BookingWithDetails } from "@/lib/services/bookingService";
import { BookingsList } from "@/components/dashboard/BookingsList";
import { CalendarPicker } from "@/components/dashboard/CalendarPicker";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import {
  addDaysToDateString,
  addMonthsToDateString,
  dateStringInTimezone,
  getMonthGridWeeks,
  startOfMonth,
  startOfWeek,
  todayInTimezone,
  zonedMidnightToUtcIso,
} from "@/lib/utils/timezone";

const VIEWS = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: { date?: string; view?: string };
}) {
  const { supabase, business } = await requireBusinessContext();
  const timezone = business.timezone;

  const today = todayInTimezone(timezone);
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : today;
  const view: ViewKey = VIEWS.some((v) => v.key === searchParams.view) ? (searchParams.view as ViewKey) : "day";

  // Rango a consultar y datos para la cabecera, según la vista activa.
  let rangeFrom: string;
  let rangeTo: string;
  let prevHref: string;
  let nextHref: string;
  let headerLabel: string;
  let monthWeeks: string[][] | null = null;
  let weekDays: string[] | null = null;

  if (view === "week") {
    const weekStart = startOfWeek(date);
    const weekEnd = addDaysToDateString(weekStart, 6);
    weekDays = Array.from({ length: 7 }, (_, i) => addDaysToDateString(weekStart, i));
    rangeFrom = zonedMidnightToUtcIso(weekStart, timezone);
    rangeTo = zonedMidnightToUtcIso(addDaysToDateString(weekStart, 7), timezone);
    prevHref = `/dashboard/calendario?view=week&date=${addDaysToDateString(date, -7)}`;
    nextHref = `/dashboard/calendario?view=week&date=${addDaysToDateString(date, 7)}`;
    const startLabel = new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("es-ES", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
    });
    const endLabel = new Date(`${weekEnd}T00:00:00Z`).toLocaleDateString("es-ES", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
    });
    headerLabel = `${startLabel} – ${endLabel}`;
  } else if (view === "month") {
    const monthStart = startOfMonth(date);
    monthWeeks = getMonthGridWeeks(monthStart);
    const gridStart = monthWeeks[0][0];
    const gridEnd = monthWeeks[monthWeeks.length - 1][6];
    rangeFrom = zonedMidnightToUtcIso(gridStart, timezone);
    rangeTo = zonedMidnightToUtcIso(addDaysToDateString(gridEnd, 1), timezone);
    prevHref = `/dashboard/calendario?view=month&date=${addMonthsToDateString(date, -1)}`;
    nextHref = `/dashboard/calendario?view=month&date=${addMonthsToDateString(date, 1)}`;
    headerLabel = new Date(`${monthStart}T00:00:00Z`).toLocaleDateString("es-ES", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    });
  } else {
    rangeFrom = zonedMidnightToUtcIso(date, timezone);
    rangeTo = zonedMidnightToUtcIso(addDaysToDateString(date, 1), timezone);
    prevHref = `/dashboard/calendario?view=day&date=${addDaysToDateString(date, -1)}`;
    nextHref = `/dashboard/calendario?view=day&date=${addDaysToDateString(date, 1)}`;
    headerLabel = new Date(rangeFrom).toLocaleDateString("es-ES", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  const bookings = await listBookingsWithDetails(supabase, {
    businessId: business.id,
    from: rangeFrom,
    to: rangeTo,
    statuses: ["pending", "confirmed", "completed", "no_show"],
    order: "asc",
  });

  const bookingsByDate = new Map<string, BookingWithDetails[]>();
  for (const booking of bookings) {
    const d = dateStringInTimezone(booking.startTime, timezone);
    const existing = bookingsByDate.get(d);
    if (existing) existing.push(booking);
    else bookingsByDate.set(d, [booking]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Calendario</h1>
        <CalendarPicker selectedDate={date} todayStr={today} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`/dashboard/calendario?view=${v.key}&date=${date}`}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                view === v.key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200",
              )}
            >
              {v.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link href={prevHref}>
            <Button type="button" variant="ghost" size="sm">
              ← Anterior
            </Button>
          </Link>
          <div className="min-w-[9rem] text-center">
            <p className="text-sm font-medium capitalize text-ink-900">{headerLabel}</p>
            {date !== today && (
              <Link
                href={`/dashboard/calendario?view=${view}&date=${today}`}
                className="text-xs text-brand-600 hover:underline"
              >
                Volver a hoy
              </Link>
            )}
          </div>
          <Link href={nextHref}>
            <Button type="button" variant="ghost" size="sm">
              Siguiente →
            </Button>
          </Link>
        </div>
      </div>

      {view === "day" && (
        <Card>
          <BookingsList
            bookings={bookingsByDate.get(date) ?? []}
            timezone={timezone}
            emptyMessage="No hay reservas ese día."
            showCancel
          />
        </Card>
      )}

      {view === "week" && weekDays && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {weekDays.map((d) => {
            const dayBookings = bookingsByDate.get(d) ?? [];
            const isToday = d === today;
            const weekdayLabel = new Date(`${d}T00:00:00Z`).toLocaleDateString("es-ES", {
              timeZone: "UTC",
              weekday: "short",
            });
            return (
              <Link key={d} href={`/dashboard/calendario?view=day&date=${d}`} className="block">
                <Card
                  className={cn(
                    "h-full transition-colors hover:border-ink-300",
                    isToday && "border-brand-300 bg-brand-50/40",
                  )}
                >
                  <p className={cn("text-xs font-medium capitalize", isToday ? "text-brand-700" : "text-ink-400")}>
                    {weekdayLabel} {Number(d.slice(8, 10))}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {dayBookings.length === 0 ? (
                      <p className="text-xs text-ink-300">Sin reservas</p>
                    ) : (
                      dayBookings.slice(0, 4).map((b) => (
                        <p key={b.id} className="truncate text-xs text-ink-700">
                          <span className="font-medium">{formatTime(b.startTime, timezone)}</span> {b.customerName}
                        </p>
                      ))
                    )}
                    {dayBookings.length > 4 && (
                      <p className="text-xs font-medium text-brand-600">+{dayBookings.length - 4} más</p>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {view === "month" && monthWeeks && (
        <Card className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs font-medium uppercase tracking-wide text-ink-400">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthWeeks.flat().map((d) => {
                const inMonth = d.slice(0, 7) === date.slice(0, 7);
                const isToday = d === today;
                const dayBookings = bookingsByDate.get(d) ?? [];
                return (
                  <Link
                    key={d}
                    href={`/dashboard/calendario?view=day&date=${d}`}
                    className={cn(
                      "flex min-h-[5.5rem] flex-col gap-1 rounded-lg border p-1.5 transition-colors hover:border-ink-300",
                      inMonth ? "border-ink-100 bg-white" : "border-ink-50 bg-ink-50/50",
                      isToday && "border-brand-300 bg-brand-50/40",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium",
                        inMonth ? (isToday ? "text-brand-700" : "text-ink-700") : "text-ink-300",
                      )}
                    >
                      {Number(d.slice(8, 10))}
                    </span>
                    {dayBookings.length > 0 && (
                      <span className="inline-flex w-fit items-center rounded-full bg-ink-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {dayBookings.length} {dayBookings.length === 1 ? "reserva" : "reservas"}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
