import Link from "next/link";
import { requireBusinessContext } from "@/lib/services/authContext";
import { getDashboardScope } from "@/lib/services/employeeScope";
import { listBookingsWithDetails, type ListBookingsParams } from "@/lib/services/bookingService";
import { BookingsList } from "@/components/dashboard/BookingsList";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

const VIEWS = [
  { key: "upcoming", label: "Próximas" },
  { key: "past", label: "Pasadas" },
  { key: "cancelled", label: "Canceladas" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export default async function ReservasPage({ searchParams }: { searchParams: { view?: string } }) {
  const { supabase, business, role, employeeId } = await requireBusinessContext();
  const view: ViewKey = (VIEWS.some((v) => v.key === searchParams.view) ? searchParams.view : "upcoming") as ViewKey;

  // Fase 10: de quién son estas reservas lo decide el selector de arriba
  // del panel (cookie) — ver `employeeScope.ts`.
  const { employeeFilter } = await getDashboardScope(supabase, business, role, employeeId);

  const nowIso = new Date().toISOString();

  // Se construye el objeto de filtros explícitamente por rama (en vez de
  // combinar spreads condicionales `...(cond && {...})`) porque en ese
  // patrón TypeScript infiere los arrays de `statuses` como `string[]` en
  // vez de `BookingStatus[]` y `order` como `string` en vez del literal
  // `"asc" | "desc"` — el spread no hereda el tipo del parámetro de
  // `listBookingsWithDetails`, así que el build fallaría por tipos.
  let filters: ListBookingsParams;
  if (view === "past") {
    filters = {
      businessId: business.id,
      to: nowIso,
      statuses: ["pending", "confirmed", "completed", "no_show"],
      order: "desc",
      employeeId: employeeFilter,
    };
  } else if (view === "cancelled") {
    filters = { businessId: business.id, statuses: ["cancelled"], order: "desc", employeeId: employeeFilter };
  } else {
    filters = {
      businessId: business.id,
      from: nowIso,
      statuses: ["pending", "confirmed"],
      order: "asc",
      employeeId: employeeFilter,
    };
  }

  const bookings = await listBookingsWithDetails(supabase, filters);

  const emptyMessage =
    view === "upcoming"
      ? "No tienes próximas reservas."
      : view === "past"
        ? "Todavía no hay reservas pasadas."
        : "No hay reservas canceladas.";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Reservas</h1>

      <div className="flex gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/dashboard/reservas?view=${v.key}`}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              view === v.key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200",
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <Card>
        <BookingsList
          bookings={bookings}
          timezone={business.timezone}
          emptyMessage={emptyMessage}
          showCancel={view === "upcoming"}
        />
      </Card>
    </div>
  );
}
