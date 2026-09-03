import Link from "next/link";
import { requireBusinessContext } from "@/lib/services/authContext";
import { listBookingsWithDetails } from "@/lib/services/bookingService";
import { BookingsList } from "@/components/dashboard/BookingsList";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { zonedMidnightToUtcIso, addDaysToDateString, todayInTimezone } from "@/lib/utils/timezone";

export default async function DashboardInicioPage() {
  const { supabase, business } = await requireBusinessContext();

  const today = todayInTimezone(business.timezone);
  const startOfTodayIso = zonedMidnightToUtcIso(today, business.timezone);
  const endOfTodayIso = zonedMidnightToUtcIso(addDaysToDateString(today, 1), business.timezone);

  const [{ count: todayCount }, { count: customersCount }, { count: totalBookingsCount }, todayBookings] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .gte("start_time", startOfTodayIso)
        .lt("start_time", endOfTodayIso)
        .not("status", "in", "(cancelled,no_show)"),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id),
      // Todas las reservas de HOY (no solo las próximas 5): el negocio
      // necesita ver de un vistazo el día completo desde la pantalla de
      // inicio, incluidas las citas de hoy que ya han pasado.
      listBookingsWithDetails(supabase, {
        businessId: business.id,
        from: startOfTodayIso,
        to: endOfTodayIso,
        statuses: ["pending", "confirmed", "completed", "no_show"],
        order: "asc",
      }),
    ]);

  const stats = [
    { label: "Citas de hoy", value: todayCount ?? 0 },
    { label: "Clientes", value: customersCount ?? 0 },
    { label: "Reservas totales", value: totalBookingsCount ?? 0 },
  ];

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

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardDescription>{s.label}</CardDescription>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-950">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Reservas de hoy</CardTitle>
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
    </div>
  );
}
