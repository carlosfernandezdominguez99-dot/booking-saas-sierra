import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessContext } from "@/lib/services/authContext";
import { hoursRowsToWeekly, listBusinessHours } from "@/lib/services/hoursService";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { HoursEditor } from "@/components/dashboard/HoursEditor";

interface PageProps {
  params: { employeeId: string };
}

export default async function EmployeeHorarioPage({ params }: PageProps) {
  const { supabase, business, role } = await requireBusinessContext();

  if (role !== "owner") {
    notFound();
  }

  const { data: employee } = await (supabase.from("employees") as any)
    .select("id, name")
    .eq("id", params.employeeId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!employee) notFound();

  const rows = await listBusinessHours(supabase, business.id, employee.id);
  const weeklyHours = hoursRowsToWeekly(rows);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/empleados" className="text-sm text-ink-500 hover:text-ink-800">
          ← Empleados
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">Horario de {employee.name}</h1>
      </div>

      <Card>
        <CardTitle>Franjas de trabajo</CardTitle>
        <CardDescription className="mb-4">
          Los huecos que verán los clientes al reservar con {employee.name} se calculan a partir de este
          horario, no del horario general del negocio.
        </CardDescription>
        <HoursEditor initialHours={weeklyHours} employeeId={employee.id} />
      </Card>
    </div>
  );
}
