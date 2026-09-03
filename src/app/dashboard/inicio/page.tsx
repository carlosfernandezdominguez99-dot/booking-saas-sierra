import Link from "next/link";
import { requireBusinessContext } from "@/lib/services/authContext";
import { listBookingsWithDetails } from "@/lib/services/bookingService";
import { BookingsList } from "@/components/dashboard/BookingsList";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";

const UPCOMING_LIMIT = 5;

export default async function DashboardInicioPage() {
  const { supabase, business } = await requireBusinessContext();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [{ count: todayCount }, { count: customersCount }, { count: totalBookingsCount }, upcomingBookings] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .gte("start_time", startOfToday.toISOString())
        .lt("start_time", endOfToday.toISOString())
        .not("status", "in", "(cancelled,no_show)"),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id),
      listBookingsWithDetails(supabase, {
        businessId: business.id,
        from: new Date().toISOString(),
        statuses: ["pending", "confirmed"],
        order: "asc",
      }),
    ]);

  const nextBookings = upcomingBookings.slice(0, UPCOMING_LIMIT);

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
          <CardTitle>Próximas citas</CardTitle>
          <Link href="/dashboard/reservas" className="text-sm font-medium text-brand-600 hover:underline">
            Ver todas
          </Link>
        </div>
        <BookingsList
          bookings={nextBookings}
          timezone={business.timezone}
          emptyMessage="No tienes próximas citas."
        />
      </Card>
    </div>
  );
}
