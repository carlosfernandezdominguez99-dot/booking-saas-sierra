import { requireBusinessContext } from "@/lib/services/authContext";
import { getBusinessStats } from "@/lib/services/statsService";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function formatDays(days: number): string {
  if (days === 0) return "—";
  return `${days} ${days === 1 ? "día" : "días"}`;
}

export default async function EstadisticasPage() {
  const { supabase, business } = await requireBusinessContext();
  const stats = await getBusinessStats(supabase, business.id, business.timezone);

  const kpis = [
    { label: "Clientes totales", value: stats.totalCustomers.toString() },
    { label: "Reservas totales", value: stats.totalBookings.toString() },
    { label: "Ingresos totales", value: formatPrice(stats.totalRevenueCents) },
    { label: "Ticket medio", value: formatPrice(stats.averageTicketCents) },
    { label: "Tasa de cancelación", value: `${stats.cancellationRatePct}%` },
  ];

  const maxWeekdayCount = Math.max(1, ...stats.bookingsByWeekday.map((w) => w.bookingsCount));
  const hasAnyBooking = stats.totalBookings > 0 || stats.cancelledBookings > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Estadísticas</h1>
        <p className="mt-1 text-sm text-ink-500">Cómo va tu negocio, de un vistazo.</p>
      </div>

      {!hasAnyBooking ? (
        <Card>
          <p className="py-8 text-center text-sm text-ink-400">
            Todavía no hay reservas suficientes para calcular estadísticas — aparecerán aquí en cuanto empieces a
            recibirlas.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardDescription>{k.label}</CardDescription>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">{k.value}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle>Servicios más populares</CardTitle>
              <p className="mb-4 mt-1 text-sm text-ink-500">Por número de reservas.</p>
              {stats.topServices.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">Sin datos todavía.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {stats.topServices.map((s) => (
                    <li key={s.serviceId} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-medium text-ink-900">{s.serviceName}</span>
                      <span className="text-ink-500">
                        {s.bookingsCount} {s.bookingsCount === 1 ? "reserva" : "reservas"} ·{" "}
                        {formatPrice(s.revenueCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle>Reservas por día de la semana</CardTitle>
              <p className="mb-4 mt-1 text-sm text-ink-500">Qué días tienes más movimiento.</p>
              <ul className="space-y-2">
                {stats.bookingsByWeekday.map((w) => (
                  <li key={w.weekday} className="flex items-center gap-3 text-sm">
                    <span className="w-20 shrink-0 text-ink-600">{w.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${(w.bookingsCount / maxWeekdayCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right font-medium text-ink-900">{w.bookingsCount}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle>Frecuencia de vuelta por servicio</CardTitle>
              <p className="mb-4 mt-1 text-sm text-ink-500">
                Cada cuántos días suele volver un cliente a por el mismo servicio.
              </p>
              {stats.serviceRecurrence.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">
                  Todavía no hay clientes con más de una visita al mismo servicio.
                </p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {stats.serviceRecurrence.map((s) => (
                    <li key={s.serviceId} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-medium text-ink-900">{s.serviceName}</span>
                      <span className="text-ink-500">
                        cada {formatDays(s.avgDaysBetweenVisits)} de media ({s.sampleSize}{" "}
                        {s.sampleSize === 1 ? "muestra" : "muestras"})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle>Ranking de clientes por visitas</CardTitle>
              <p className="mb-4 mt-1 text-sm text-ink-500">Los que más veces han venido.</p>
              {stats.topCustomersByVisits.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">Sin datos todavía.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {stats.topCustomersByVisits.map((c, i) => (
                    <li key={c.customerId} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="flex items-center gap-2 font-medium text-ink-900">
                        <span className="text-ink-400">#{i + 1}</span> {c.customerName}
                      </span>
                      <span className="text-ink-500">
                        {c.visitsCount} {c.visitsCount === 1 ? "visita" : "visitas"} · {formatPrice(c.revenueCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="lg:col-span-2">
              <CardTitle>Clientes más frecuentes</CardTitle>
              <p className="mb-4 mt-1 text-sm text-ink-500">
                Los que vuelven con menos tiempo de media entre visita y visita (fidelidad).
              </p>
              {stats.mostFrequentCustomers.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">
                  Todavía no hay clientes con más de una visita.
                </p>
              ) : (
                <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {stats.mostFrequentCustomers.map((c) => (
                    <li key={c.customerId} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink-900">{c.customerName}</span>
                      <span className="text-ink-500">
                        cada {formatDays(c.avgDaysBetweenVisits)} · {c.visitsCount} visitas
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
