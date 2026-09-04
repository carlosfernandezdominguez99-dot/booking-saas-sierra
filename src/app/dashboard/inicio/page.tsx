import Link from "next/link";
import { requireBusinessContext } from "@/lib/services/authContext";
import { listBookingsWithDetails } from "@/lib/services/bookingService";
import { BookingsList } from "@/components/dashboard/BookingsList";
import { Card, CardTitle } from "@/components/ui/Card";
import { zonedMidnightToUtcIso, addDaysToDateString, todayInTimezone } from "@/lib/utils/timezone";

// Los totales de clientes y reservas ya viven en /dashboard/estadisticas —
// aquí en Inicio solo interesa "qué tengo que hacer/mirar hoy", para no
// repetir información y dejar sitio de sobra al botón de crear cita.
export default async function DashboardInicioPage() {
  const { supabase, business } = await requireBusinessContext();

  const today = todayInTimezone(business.timezone);
  const startOfTodayIso = zonedMidnightToUtcIso(today, business.timezone);
  const endOfTodayIso = zonedMidnightToUtcIso(addDaysToDateString(today, 1), business.timezone);

  const todayBookings = await listBookingsWithDetails(supabase, {
    businessId: business.id,
    from: startOfTodayIso,
    to: endOfTodayIso,
    statuses: ["pending", "confirmed", "completed", "no_show"],
    order: "asc",
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
          Hola de nuevo 👋
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Esto es lo que está pasando hoy en {business.name}.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CardTitle>Citas de hoy</CardTitle>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink-900 px-2 text-xs font-semibold text-white">
                {todayBookings.length}
              </span>
            </div>
            <Link href="/dashboard/calendario" className="text-sm font-medium text-brand-600 hover:underline">
              Ver calendario
            </Link>
          </div>
          <BookingsList
            bookings={todayBookings}
            timezone={business.timezone}
            emptyMessage="No tienes reservas hoy."
            showCancel
          />
        </Card>

        {/* Acceso directo a crear una cita manualmente (mismo asistente que */}
        {/* usan los clientes desde la página pública), bien visible al lado */}
        {/* de las citas de hoy en vez de escondido en un menú. */}
        <Link
          href={`/negocio/${business.slug}/reservar`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-h-[10rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40 lg:min-h-full"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-white transition-colors group-hover:bg-brand-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="text-base font-semibold text-ink-900">Crear cita</span>
          <span className="text-sm text-ink-500">Reserva manual para un cliente</span>
        </Link>
      </div>
    </div>
  );
}
