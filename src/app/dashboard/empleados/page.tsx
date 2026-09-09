import { requireBusinessContext } from "@/lib/services/authContext";
import { listEmployees, listEmployeeServiceMap } from "@/lib/services/employeesService";
import { listEmployeeInvites } from "@/lib/services/employeeInviteService";
import { listServices } from "@/lib/services/servicesService";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { EmployeesManager } from "@/components/dashboard/EmployeesManager";

export default async function EmpleadosPage() {
  const { supabase, business, role } = await requireBusinessContext();

  // Gestionar el equipo (dar de alta, invitar, asignar servicios) es cosa
  // solo del propietario — un empleado con acceso propio no ve esta
  // sección en su menú, pero si llegara a la URL directamente se le
  // enseña esto en vez de la gestión completa.
  if (role !== "owner") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Empleados</h1>
        <Card className="border-dashed py-12 text-center text-sm text-ink-500">
          Solo el propietario del negocio gestiona el equipo.
        </Card>
      </div>
    );
  }

  const [employees, services, employeeServiceMap, invites] = await Promise.all([
    listEmployees(supabase, business.id),
    listServices(supabase, business.id),
    listEmployeeServiceMap(supabase, business.id),
    listEmployeeInvites(supabase, business.id),
  ]);

  const employeeServiceIds: Record<string, string[]> = {};
  for (const employee of employees) {
    employeeServiceIds[employee.id] = [...(employeeServiceMap.get(employee.id) ?? [])];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Empleados</h1>

      <Card>
        <CardTitle>Tu equipo</CardTitle>
        <CardDescription className="mb-4">
          Da de alta a tus empleados, marca qué servicios hace cada uno, y — si quieres que tengan su
          propio acceso para ver solo su agenda — invítalos por email. Cada empleado con acceso propio
          gestiona su propio horario desde “Horario”.
        </CardDescription>
        <EmployeesManager
          initialEmployees={employees}
          services={services.map((s) => ({ id: s.id, name: s.name }))}
          employeeServiceIds={employeeServiceIds}
          invites={invites.map((i) => ({ id: i.id, employeeId: i.employeeId, email: i.email, status: i.status }))}
        />
      </Card>
    </div>
  );
}
