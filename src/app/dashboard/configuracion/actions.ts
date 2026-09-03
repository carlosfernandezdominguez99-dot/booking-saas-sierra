"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import { updateBusinessProfile } from "@/lib/services/businessService";
import { uploadBusinessLogo } from "@/lib/services/logoService";
import { updateBookingSettings } from "@/lib/services/bookingSettingsService";
import {
  businessProfileSchema,
  bookingSettingsSchema,
  type BusinessProfileInput,
  type BookingSettingsInput,
} from "@/lib/validations/business";

export type SimpleActionResult = { error?: string };
export type LogoActionResult = { url?: string; error?: string };

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

export async function saveBookingSettingsAction(input: BookingSettingsInput): Promise<SimpleActionResult> {
  const parsed = bookingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa la configuración." };
  }

  const { supabase, business } = await requireBusinessContext();

  try {
    await updateBookingSettings(supabase, business.id, parsed.data);
    revalidatePath("/dashboard/configuracion");
    return {};
  } catch {
    return { error: "No se pudo guardar la configuración." };
  }
}

export async function uploadLogoAction(formData: FormData): Promise<LogoActionResult> {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona una imagen." };
  }

  const { supabase, business } = await requireBusinessContext();

  try {
    const url = await uploadBusinessLogo(supabase, business.id, file);
    revalidatePath("/dashboard/configuracion");
    revalidatePath(`/negocio/${business.slug}`);
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo subir el logo." };
  }
}
