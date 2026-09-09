"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import { replaceBusinessHours } from "@/lib/services/hoursService";
import { weeklyHoursSchema, type WeeklyHoursInput } from "@/lib/validations/business";

export type SimpleActionResult = { error?: string };

// Se usa desde `/dashboard/horarios` (horario propio, general o de
// empleado según quién esté dentro), desde el paso 3 del asistente de
// onboarding, y desde `/dashboard/empleados/[employeeId]/horario` (el
// propietario editando el horario de un empleado concreto).
export async function saveWeeklyHoursAction(
  hours: WeeklyHoursInput,
  employeeId?: string,
): Promise<SimpleActionResult> {
  const parsed = weeklyHoursSchema.safeParse(hours);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los horarios introducidos." };
  }

  const { supabase, business, role, employeeId: myEmployeeId } = await requireBusinessContext();

  let targetEmployeeId: string | null = null;
  if (employeeId) {
    if (role === "owner") {
      // El propietario puede editar el horario de cualquier empleado —
      // pero SOLO de los suyos: se comprueba que ese id de verdad
      // pertenece a este negocio antes de escribir nada (si no, alguien
      // podría colar el id de un empleado de otro negocio y dejar filas
      // de `business_hours` con `business_id`/`employee_id` cruzados).
      const { data } = await (supabase.from("employees") as any)
        .select("id")
        .eq("id", employeeId)
        .eq("business_id", business.id)
        .maybeSingle();
      if (!data) return { error: "No se encontró ese empleado." };
    } else if (employeeId !== myEmployeeId) {
      return { error: "No tienes permiso para editar ese horario." };
    }
    targetEmployeeId = employeeId;
  }

  try {
    await replaceBusinessHours(supabase, business.id, parsed.data, targetEmployeeId);
    revalidatePath("/dashboard/horarios");
    revalidatePath("/dashboard/empleados");
    return {};
  } catch {
    return { error: "No se pudieron guardar los horarios. Inténtalo de nuevo." };
  }
}
