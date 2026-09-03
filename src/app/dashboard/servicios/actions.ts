"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import { createService, deleteService, updateService } from "@/lib/services/servicesService";
import { serviceSchema, type ServiceInput } from "@/lib/validations/business";
import type { Database } from "@/types/database.types";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
export type ServiceActionResult = { data?: ServiceRow; error?: string };
export type SimpleActionResult = { error?: string };

// Se usan tanto desde `/dashboard/servicios` como desde el paso 2 del
// asistente de onboarding: en ambos sitios el negocio ya existe, así que
// cada alta/baja se guarda directamente (no hay un "borrador" intermedio).

export async function createServiceAction(input: ServiceInput): Promise<ServiceActionResult> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos del servicio." };
  }

  const { supabase, business } = await requireBusinessContext();

  try {
    const data = await createService(supabase, business.id, parsed.data);
    revalidatePath("/dashboard/servicios");
    return { data };
  } catch {
    return { error: "No se pudo crear el servicio. Inténtalo de nuevo." };
  }
}

export async function updateServiceAction(
  serviceId: string,
  input: Partial<Pick<ServiceInput, "name" | "description" | "priceEuros" | "durationMinutes">>,
): Promise<SimpleActionResult> {
  const parsed = serviceSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos del servicio." };
  }

  const { supabase } = await requireBusinessContext();

  try {
    await updateService(supabase, serviceId, parsed.data);
    revalidatePath("/dashboard/servicios");
    return {};
  } catch {
    return { error: "No se pudo actualizar el servicio." };
  }
}

export async function toggleServiceActiveAction(serviceId: string, active: boolean): Promise<SimpleActionResult> {
  const { supabase } = await requireBusinessContext();

  try {
    await updateService(supabase, serviceId, { active });
    revalidatePath("/dashboard/servicios");
    return {};
  } catch {
    return { error: "No se pudo actualizar el servicio." };
  }
}

export async function deleteServiceAction(serviceId: string): Promise<SimpleActionResult> {
  const { supabase } = await requireBusinessContext();

  try {
    await deleteService(supabase, serviceId);
    revalidatePath("/dashboard/servicios");
    return {};
  } catch {
    return { error: "No se pudo eliminar el servicio." };
  }
}
