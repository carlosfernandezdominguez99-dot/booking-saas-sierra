"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPublicBusinessBySlug } from "@/lib/services/publicBusinessService";
import { getCustomerToken, clearCustomerToken } from "@/lib/services/customerSession";
import {
  requestCustomerAccess,
  joinWaitlistSelf,
  leaveWaitlistSelf,
} from "@/lib/services/customerPortalService";
import { sendCustomerAccessEmail } from "@/lib/email/emailService";

/**
 * Pide un enlace de acceso para alguien que ya es cliente. Responde
 * SIEMPRE el mismo resultado exista o no ese contacto en el negocio — ver
 * el comentario de `request_customer_access` en `0010_customer_portal.sql`
 * (evitar filtrar qué teléfonos/emails están registrados).
 */
export async function requestAccessAction(slug: string, contact: string): Promise<{ error?: string }> {
  const trimmed = contact.trim();
  if (!trimmed) return { error: "Introduce tu teléfono o email." };

  const result = await getPublicBusinessBySlug(slug);
  if (!result) return { error: "Negocio no encontrado." };

  try {
    const supabase = await createClient();
    const access = await requestCustomerAccess(supabase, result.business.id, trimmed);
    if (access) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const magicLink = `${siteUrl}/negocio/${slug}/mis-citas/verificar?token=${access.token}`;
      try {
        await sendCustomerAccessEmail({
          toEmail: access.customerEmail,
          customerName: access.customerName,
          businessName: result.business.name,
          magicLink,
        });
      } catch {
        // No-op: best-effort — el mensaje que se devuelve es igual pase lo que pase.
      }
    }
  } catch {
    // No-op a propósito: nunca se distingue "no encontrado" de un error real,
    // por la misma razón anti-enumeración.
  }

  return {};
}

export async function joinWaitlistSelfAction(
  slug: string,
  serviceId: string,
  preferredDate: string,
): Promise<{ entryId?: string; error?: string }> {
  const result = await getPublicBusinessBySlug(slug);
  if (!result) return { error: "Negocio no encontrado." };

  const token = await getCustomerToken(result.business.id);
  if (!token) return { error: "Tu sesión ha caducado. Vuelve a pedir el enlace de acceso." };

  const supabase = await createClient();
  const res = await joinWaitlistSelf(supabase, token, serviceId, preferredDate);
  if (!res.error) revalidatePath(`/negocio/${slug}/mis-citas`);
  return res;
}

export async function leaveWaitlistSelfAction(slug: string, entryId: string): Promise<{ error?: string }> {
  const result = await getPublicBusinessBySlug(slug);
  if (!result) return { error: "Negocio no encontrado." };

  const token = await getCustomerToken(result.business.id);
  if (!token) return { error: "Tu sesión ha caducado. Vuelve a pedir el enlace de acceso." };

  const supabase = await createClient();
  const ok = await leaveWaitlistSelf(supabase, token, entryId);
  if (!ok) return { error: "No se pudo quitar de la lista de espera." };

  revalidatePath(`/negocio/${slug}/mis-citas`);
  return {};
}

export async function logoutAction(slug: string): Promise<void> {
  const result = await getPublicBusinessBySlug(slug);
  if (result) await clearCustomerToken(result.business.id);
  revalidatePath(`/negocio/${slug}/mis-citas`);
}
