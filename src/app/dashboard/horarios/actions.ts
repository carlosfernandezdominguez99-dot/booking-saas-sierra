"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import { replaceBusinessHours } from "@/lib/services/hoursService";
import { weeklyHoursSchema, type WeeklyHoursInput } from "@/lib/validations/business";

export type SimpleActionResult = { error?: string };

// Se usa tanto desde `/dashboard/horarios` como desde el paso 3 del
// asistente de onboarding.
export async function saveWeeklyHoursAction(hours: WeeklyHoursInput): Promise<SimpleActionResult> {
  const parsed = weeklyHoursSchema.safeParse(hours);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los horarios introducidos." };
  }

  const { supabase, business } = await requireBusinessContext();

  try {
    await replaceBusinessHours(supabase, business.id, parsed.data);
    revalidatePath("/dashboard/horarios");
    return {};
  } catch {
    return { error: "No se pudieron guardar los horarios. Inténtalo de nuevo." };
  }
}
