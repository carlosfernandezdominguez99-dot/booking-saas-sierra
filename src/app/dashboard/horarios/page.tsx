import { requireBusinessContext } from "@/lib/services/authContext";
import { getDashboardScope } from "@/lib/services/employeeScope";
import { hoursRowsToWeekly, listBusinessHours } from "@/lib/services/hoursService";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { HoursEditor } from "@/components/dashboard/HoursEditor";

export default async function HorariosPage() {
  const { supabase, business, role, employeeId, employeeName } = await requireBusinessContext();

  // Un empleado con acceso propio solo ve/edita SU horario (no el general
  // del negocio). El propietario ve el horario de quien tenga
  // seleccionado en el selector de arriba del panel (Fase 10) — "Todos" y
  // "Tú" enseñan el horario general del gerente (no tiene sentido un
  // horario "de todos" a la vez, así que se trata igual que "Tú").
  const isStaffOwnSchedule = role === "staff" && Boolean(employeeId);
  const { scope } = await getDashboardScope(supabase, business, role, employeeId);
  const targetEmployeeId = isStaffOwnSchedule ? employeeId : scope.kind === "employee" ? scope.employeeId : null;
  const targetName = isStaffOwnSchedule ? employeeName : scope.kind === "employee" ? scope.employeeName : null;

  const rows = await listBusinessHours(supabase, business.id, targetEmployeeId);
  const weeklyHours = hoursRowsToWeekly(rows);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
        {isStaffOwnSchedule ? "Mi horario" : "Horarios"}
      </h1>

      <Card>
        <CardTitle>{targetName ? `Horario de ${targetName}` : "Horario de apertura"}</CardTitle>
        <CardDescription className="mb-4">
          {targetName
            ? `Los huecos que verán los clientes al reservar con ${targetName} se calculan a partir de este horario.`
            : "Define en qué franjas puede reservar tu negocio. Los huecos disponibles para reservar se calculan a partir de este horario y de la duración de cada servicio."}
        </CardDescription>
        <HoursEditor key={targetEmployeeId ?? "manager"} initialHours={weeklyHours} employeeId={targetEmployeeId ?? undefined} />
      </Card>
    </div>
  );
}
