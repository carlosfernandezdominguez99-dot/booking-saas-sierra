import { requireBusinessContext } from "@/lib/services/authContext";
import { hoursRowsToWeekly, listBusinessHours } from "@/lib/services/hoursService";
import { listEmployees } from "@/lib/services/employeesService";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { HoursEditor } from "@/components/dashboard/HoursEditor";
import { EmployeeAgendaTabs } from "@/components/dashboard/EmployeeAgendaTabs";

export default async function HorariosPage() {
  const { supabase, business, role, employeeId, employeeName } = await requireBusinessContext();

  // Un empleado con acceso propio solo ve/edita SU horario (no el general
  // del negocio); el propietario sigue viendo el horario general de
  // siempre (que ahora es, con nombre propio, la agenda del gerente —
  // Fase 9.2). El horario de cada empleado en concreto lo gestiona el
  // propietario desde `/dashboard/empleados/[employeeId]/horario` — el
  // selector de pestañas de abajo enlaza directamente ahí.
  const isOwnSchedule = role === "staff" && Boolean(employeeId);
  const rows = await listBusinessHours(supabase, business.id, isOwnSchedule ? employeeId : null);
  const weeklyHours = hoursRowsToWeekly(rows);
  const employees = role === "owner" ? await listEmployees(supabase, business.id) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
        {isOwnSchedule ? "Mi horario" : "Horarios"}
      </h1>

      {role === "owner" && employees.length > 0 && (
        <EmployeeAgendaTabs
          employees={employees}
          activeEmployeeId={null}
          managerHref="/dashboard/horarios"
          basePathForEmployee={(id) => `/dashboard/empleados/${id}/horario`}
        />
      )}

      <Card>
        <CardTitle>{isOwnSchedule ? `Horario de ${employeeName ?? "trabajo"}` : "Horario de apertura"}</CardTitle>
        <CardDescription className="mb-4">
          {isOwnSchedule
            ? "Define en qué franjas puedes atender citas. Los huecos que verán los clientes al reservar contigo se calculan a partir de este horario."
            : "Define en qué franjas puede reservar tu negocio. Los huecos disponibles para reservar se calculan a partir de este horario y de la duración de cada servicio."}
        </CardDescription>
        <HoursEditor initialHours={weeklyHours} employeeId={isOwnSchedule ? (employeeId ?? undefined) : undefined} />
      </Card>
    </div>
  );
}
