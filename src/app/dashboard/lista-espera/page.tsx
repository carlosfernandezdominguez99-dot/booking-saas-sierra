import { requireBusinessContext } from "@/lib/services/authContext";
import { getDashboardScope } from "@/lib/services/employeeScope";
import { listWaitlist } from "@/lib/services/waitlistService";
import { listServices } from "@/lib/services/servicesService";
import { listEmployeeServiceIds } from "@/lib/services/employeesService";
import { todayInTimezone } from "@/lib/utils/timezone";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { WaitlistManager } from "@/components/dashboard/WaitlistManager";

export default async function ListaEsperaPage() {
  const { supabase, business, role, employeeId } = await requireBusinessContext();

  // Fase 10: puesto en un empleado, se acerca a "quién espera un servicio
  // que él hace" (una entrada de lista de espera no lleva empleado
  // asignado hasta que se le ofrece un hueco, así que no hay un filtro
  // exacto — ver la nota en `waitlistService.ts`).
  const { scope } = await getDashboardScope(supabase, business, role, employeeId);
  const scopedServiceIds = scope.kind === "employee" ? await listEmployeeServiceIds(supabase, scope.employeeId) : undefined;

  const [entries, services] = await Promise.all([
    listWaitlist(supabase, { businessId: business.id, serviceIds: scopedServiceIds }),
    listServices(supabase, business.id),
  ]);

  const activeServices = services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Lista de espera</h1>
        <p className="mt-1 text-sm text-ink-500">
          {scope.kind === "employee"
            ? `Clientes esperando un hueco para un servicio que hace ${scope.employeeName}.`
            : "Cuando se cancela una cita, se avisa en orden a quien esté esperando ese día un servicio que quepa en el hueco liberado."}
        </p>
      </div>

      <Card>
        <CardTitle>Quién está esperando</CardTitle>
        <CardDescription className="mb-4">
          Añade a alguien a mano (por ejemplo, tras una llamada) o espera a que se apunte solo
          cuando esa función esté conectada a WhatsApp.
        </CardDescription>
        <WaitlistManager
          initialEntries={entries}
          services={activeServices}
          timezone={business.timezone}
          today={todayInTimezone(business.timezone)}
        />
      </Card>
    </div>
  );
}
