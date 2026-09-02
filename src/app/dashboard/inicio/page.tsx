import { requireBusinessContext } from "@/lib/services/authContext";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";

export default async function DashboardInicioPage() {
  const { supabase, business } = await requireBusinessContext();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [{ count: todayCount }, { count: customersCount }, { count: totalBookingsCount }] =
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
        <CardTitle>Próximas citas</CardTitle>
        <CardDescription className="mb-4">
          El calendario y el listado completo de reservas llegan en la siguiente fase.
        </CardDescription>
        <div className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-400">
          Todavía no hay nada que mostrar aquí — se implementa en la Fase 4 (Dashboard + calendario + clientes).
        </div>
      </Card>
    </div>
  );
}
