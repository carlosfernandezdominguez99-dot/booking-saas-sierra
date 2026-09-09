import { requireBusinessContext } from "@/lib/services/authContext";
import { getDashboardScope } from "@/lib/services/employeeScope";
import { listCustomers } from "@/lib/services/customersService";
import { listBookings } from "@/lib/services/bookingService";
import { CustomersTable } from "@/components/dashboard/CustomersTable";
import { Card, CardDescription } from "@/components/ui/Card";

export default async function ClientesPage() {
  const { supabase, business, role, employeeId } = await requireBusinessContext();

  // Fase 10: puesto en un empleado (o en "Tú"), la lista se acerca a
  // "clientes que han tenido al menos una cita con él" — se deriva de sus
  // reservas, porque un cliente no tiene un empleado "propio" asignado.
  const { scope, employeeFilter } = await getDashboardScope(supabase, business, role, employeeId);

  const [customers, bookings] = await Promise.all([
    listCustomers(supabase, business.id),
    listBookings(supabase, {
      businessId: business.id,
      statuses: ["pending", "confirmed", "completed", "no_show"],
      employeeId: employeeFilter,
    }),
  ]);

  const statsByCustomer = new Map<string, { count: number; lastVisit: string }>();
  for (const booking of bookings) {
    const existing = statsByCustomer.get(booking.customer_id);
    if (existing) {
      existing.count += 1;
      if (booking.start_time > existing.lastVisit) existing.lastVisit = booking.start_time;
    } else {
      statsByCustomer.set(booking.customer_id, { count: 1, lastVisit: booking.start_time });
    }
  }

  const scopedCustomers = employeeFilter !== undefined ? customers.filter((c) => statsByCustomer.has(c.id)) : customers;

  const rows = scopedCustomers.map((c) => {
    const stats = statsByCustomer.get(c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      bookingsCount: stats?.count ?? 0,
      lastVisit: stats?.lastVisit ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Clientes</h1>

      <Card>
        {scope.kind === "employee" && (
          <CardDescription className="mb-4">Clientes que han tenido al menos una cita con {scope.employeeName}.</CardDescription>
        )}
        <CustomersTable customers={rows} timezone={business.timezone} />
      </Card>
    </div>
  );
}
