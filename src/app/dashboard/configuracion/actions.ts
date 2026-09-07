"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import { updateBusinessProfile } from "@/lib/services/businessService";
import { uploadBusinessLogo } from "@/lib/services/logoService";
import { updateBookingSettings } from "@/lib/services/bookingSettingsService";
import { createCheckoutSession, createBillingPortalSession } from "@/lib/stripe/stripeService";
import {
  businessProfileSchema,
  bookingSettingsSchema,
  type BusinessProfileInput,
  type BookingSettingsInput,
} from "@/lib/validations/business";

export type SimpleActionResult = { error?: string };
export type LogoActionResult = { url?: string; error?: string };
export type StripeRedirectResult = { url?: string; error?: string };

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

/**
 * Inicia el pago de la suscripción (Checkout Session de Stripe). Reutiliza
 * el cliente de Stripe del negocio si ya tuviera uno de una suscripción
 * anterior (p. ej. tras cancelar y querer reactivar), para no duplicar
 * clientes en el dashboard de Stripe.
 */
export async function startCheckoutAction(): Promise<StripeRedirectResult> {
  const { business, user } = await requireBusinessContext();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const result = await createCheckoutSession({
    businessId: business.id,
    customerEmail: user.email,
    existingCustomerId: business.stripe_customer_id,
    successUrl: `${siteUrl}/dashboard/configuracion?checkout=success`,
    cancelUrl: `${siteUrl}/dashboard/configuracion?checkout=cancelled`,
  });

  if (result.error || !result.url) {
    return { error: result.error ?? "No se pudo iniciar el pago." };
  }
  return { url: result.url };
}

/** Abre el portal de facturación de Stripe (cambiar tarjeta, ver facturas, cancelar). */
export async function openBillingPortalAction(): Promise<StripeRedirectResult> {
  const { business } = await requireBusinessContext();

  if (!business.stripe_customer_id) {
    return { error: "Todavía no tienes ninguna suscripción de pago activa." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const result = await createBillingPortalSession({
    customerId: business.stripe_customer_id,
    returnUrl: `${siteUrl}/dashboard/configuracion`,
  });

  if (result.error || !result.url) {
    return { error: result.error ?? "No se pudo abrir el portal de facturación." };
  }
  return { url: result.url };
}
