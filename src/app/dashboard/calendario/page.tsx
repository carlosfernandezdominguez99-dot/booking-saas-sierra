import Link from "next/link";
import { requireBusinessContext } from "@/lib/services/authContext";
import { listBookingsWithDetails } from "@/lib/services/bookingService";
import { BookingsList } from "@/components/dashboard/BookingsList";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { addDaysToDateString, todayInTimezone, zonedMidnightToUtcIso } from "@/lib/utils/timezone";

export default async function CalendarioPage({ searchParams }: { searchParams: { date?: string } }) {
  const { supabase, business } = await requireBusinessContext();

  const today = todayInTimezone(business.timezone);
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : today;

  const from = zonedMidnightToUtcIso(date, business.timezone);
  const to = zonedMidnightToUtcIso(addDaysToDateString(date, 1), business.timezone);

  const bookings = await listBookingsWithDetails(supabase, {
    businessId: business.id,
    from,
    to,
    statuses: ["pending", "confirmed", "completed", "no_show"],
    order: "asc",
  });

  const label = new Date(from).toLocaleDateString("es-ES", {
    timeZone: business.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Calendario</h1>

      <div className="flex items-center justify-between">
        <Link href={`/dashboard/calendario?date=${addDaysToDateString(date, -1)}`}>
          <Button type="button" variant="ghost" size="sm">
            ← Anterior
          </Button>
        </Link>

        <div className="text-center">
          <p className="text-sm font-medium capitalize text-ink-900">{label}</p>
          {date !== today && (
            <Link href="/dashboard/calendario" className="text-xs text-brand-600 hover:underline">
              Volver a hoy
            </Link>
          )}
        </div>

        <Link href={`/dashboard/calendario?date=${addDaysToDateString(date, 1)}`}>
          <Button type="button" variant="ghost" size="sm">
            Siguiente →
          </Button>
        </Link>
      </div>

      <Card>
        <BookingsList
          bookings={bookings}
          timezone={business.timezone}
          emptyMessage="No hay reservas ese día."
          showCancel
        />
      </Card>
    </div>
  );
}
