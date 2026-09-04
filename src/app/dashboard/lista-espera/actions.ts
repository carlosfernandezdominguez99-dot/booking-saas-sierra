"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import { addToWaitlist, deleteWaitlistEntry, type WaitlistEntryWithDetails } from "@/lib/services/waitlistService";

export type SimpleActionResult = { error?: string };
export type AddToWaitlistActionResult = { data?: WaitlistEntryWithDetails; error?: string };

export interface AddToWaitlistInput {
  serviceId: string;
  preferredDate: string;
  customerName: string;
  customerPhone: string;
}

/**
 * Alta manual en la lista de espera desde el panel (por ejemplo, tras una
 * llamada de teléfono: "¿tienes hueco el viernes?"). Todavía no hay alta
 * manual de clientes en general (`customersService.ts`), así que
 * `addToWaitlist` hace su propio upsert por teléfono.
 */
export async function addToWaitlistAction(input: AddToWaitlistInput): Promise<AddToWaitlistActionResult> {
  const { supabase, business } = await requireBusinessContext();

  const name = input.customerName.trim();
  const phone = input.customerPhone.trim();
  if (name.length < 2) return { error: "Escribe el nombre del cliente." };
  if (phone.length < 6) return { error: "Escribe un teléfono válido." };
  if (!input.serviceId) return { error: "Elige un servicio." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.preferredDate)) return { error: "Elige una fecha." };

  try {
    const data = await addToWaitlist(supabase, {
      businessId: business.id,
      serviceId: input.serviceId,
      preferredDate: input.preferredDate,
      customerName: name,
      customerPhone: phone,
    });
    revalidatePath("/dashboard/lista-espera");
    return { data };
  } catch {
    return { error: "No se pudo añadir a la lista de espera." };
  }
}

export async function deleteWaitlistEntryAction(entryId: string): Promise<SimpleActionResult> {
  const { supabase } = await requireBusinessContext();
  try {
    await deleteWaitlistEntry(supabase, entryId);
    revalidatePath("/dashboard/lista-espera");
    return {};
  } catch {
    return { error: "No se pudo quitar de la lista de espera." };
  }
}
