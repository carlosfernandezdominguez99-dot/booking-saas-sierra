"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import { cancelBooking } from "@/lib/services/bookingService";

export type SimpleActionResult = { error?: string };

export async function cancelBookingAction(bookingId: string): Promise<SimpleActionResult> {
  const { supabase } = await requireBusinessContext();

  try {
    await cancelBooking(supabase, bookingId);
    revalidatePath("/dashboard/reservas");
    revalidatePath("/dashboard/calendario");
    revalidatePath("/dashboard/inicio");
    return {};
  } catch {
    return { error: "No se pudo cancelar la reserva." };
  }
}
