"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import { completeOnboarding, updateBusinessProfile } from "@/lib/services/businessService";
import { updateBookingSettings } from "@/lib/services/bookingSettingsService";
import {
  businessProfileSchema,
  bookingSettingsSchema,
  type BusinessProfileInput,
  type BookingSettingsInput,
} from "@/lib/validations/business";

export type SimpleActionResult = { error?: string };

export async function saveBusinessProfileAction(input: BusinessProfileInput): Promise<SimpleActionResult> {
  const parsed = businessProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos introducidos." };
  }

  const { supabase, business } = await requireBusinessContext();

  try {
    await updateBusinessProfile(supabase, business.id, parsed.data);
    revalidatePath("/dashboard/configuracion");
    return {};
  } catch {
    return { error: "No se pudo guardar. Inténtalo de nuevo." };
  }
}

export async function saveOnboardingBookingSettingsAction(
  input: BookingSettingsInput,
): Promise<SimpleActionResult> {
  const parsed = bookingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa la configuración." };
  }

  const { supabase, business } = await requireBusinessContext();

  try {
    await updateBookingSettings(supabase, business.id, parsed.data);
    return {};
  } catch {
    return { error: "No se pudo guardar la configuración." };
  }
}

export async function finishOnboardingAction(): Promise<SimpleActionResult> {
  const { supabase, business } = await requireBusinessContext();

  try {
    await completeOnboarding(supabase, business.id);
  } catch {
    return { error: "No se pudo finalizar. Inténtalo de nuevo." };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/inicio");
}
