"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCustomerSessionToken, setCustomerSessionToken, clearCustomerSessionToken } from "@/lib/services/customerAuthSession";
import {
  customerSignup,
  customerLogin,
  customerLogout,
  leaveWaitlistByAccount,
  cancelBookingByAccount,
} from "@/lib/services/customerAccountService";
import { sendCancellationEmail, sendWaitlistOfferEmail } from "@/lib/email/emailService";
import { sendWaitlistOffer } from "@/lib/whatsapp/whatsappService";

export interface AuthActionInput {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

export interface AuthActionResult {
  error?: string;
  /** Solo en login: true cuando ese email no tiene ninguna cuenta todavía. */
  accountNotFound?: boolean;
}

/**
 * Todas las acciones de aquí capturan cualquier error inesperado (RPC
 * caída, columna que no cuadra, lo que sea) y lo devuelven como
 * `{ error }` en vez de dejarlo escapar: un `throw` sin capturar dentro de
 * una Server Action se convierte, del lado del cliente, en la pantalla
 * genérica de Next.js ("Application error: a server-side exception..."),
 * que no dice nada útil al cliente ni deja seguir usando el formulario.
 */
export async function signupAction(input: AuthActionInput): Promise<AuthActionResult> {
  if (!input.name || !input.phone) {
    return { error: "Introduce tu nombre y tu teléfono." };
  }

  try {
    const supabase = await createClient();
    const result = await customerSignup(supabase, {
      email: input.email,
      password: input.password,
      name: input.name,
      phone: input.phone,
    });

    if (result.error || !result.sessionToken) {
      return { error: result.error ?? "No se pudo crear la cuenta." };
    }

    await setCustomerSessionToken(result.sessionToken);
    revalidatePath("/mis-citas");
    return {};
  } catch {
    return { error: "No se pudo crear la cuenta. Inténtalo de nuevo en unos segundos." };
  }
}

export async function loginAction(input: AuthActionInput): Promise<AuthActionResult> {
  try {
    const supabase = await createClient();
    const result = await customerLogin(supabase, input.email, input.password);

    if (result.error || !result.sessionToken) {
      return { error: result.error ?? "No se pudo iniciar sesión.", accountNotFound: result.accountNotFound };
    }

    await setCustomerSessionToken(result.sessionToken);
    revalidatePath("/mis-citas");
    return {};
  } catch {
    return { error: "No se pudo iniciar sesión. Inténtalo de nuevo en unos segundos." };
  }
}

export async function logoutAction(): Promise<void> {
  const token = await getCustomerSessionToken();
  if (token) {
    try {
      const supabase = await createClient();
      await customerLogout(supabase, token);
    } catch {
      // No-op: aunque falle borrar la fila en la base de datos, se borra
      // igualmente la cookie — el token caduca solo a los 30 días.
    }
  }
  await clearCustomerSessionToken();
  revalidatePath("/mis-citas");
}

export async function leaveWaitlistAction(entryId: string): Promise<{ error?: string }> {
  const token = await getCustomerSessionToken();
  if (!token) return { error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };

  try {
    const supabase = await createClient();
    const ok = await leaveWaitlistByAccount(supabase, token, entryId);
    if (!ok) return { error: "No se pudo quitar de la lista de espera." };

    revalidatePath("/mis-citas");
    return {};
  } catch {
    return { error: "No se pudo quitar de la lista de espera. Inténtalo de nuevo." };
  }
}

/**
 * Cancela una cita desde "Mis citas". La base de datos (`cancel_booking_by_account`)
 * es quien de verdad decide si se puede (política de cancelación de ESE
 * negocio) — aquí solo se envían los avisos según lo que ella devuelva.
 */
export async function cancelBookingAction(bookingId: string): Promise<{ error?: string }> {
  const token = await getCustomerSessionToken();
  if (!token) return { error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };

  try {
    const supabase = await createClient();
    const result = await cancelBookingByAccount(supabase, token, bookingId);
    if (!result.ok) return { error: result.error ?? "No se pudo cancelar la reserva." };

    // Aviso de cancelación al propio cliente — best-effort a propósito
    // (mismo motivo que en el resto de acciones: la cancelación ya se
    // hizo, un fallo aquí no debe deshacerla ni mostrarse como error).
    if (result.customerEmail && result.businessName && result.serviceName && result.startTime && result.businessTimezone) {
      try {
        await sendCancellationEmail({
          toEmail: result.customerEmail,
          customerName: result.customerName ?? "",
          businessName: result.businessName,
          serviceName: result.serviceName,
          startTimeIso: result.startTime,
          timezone: result.businessTimezone,
        });
      } catch {
        // No-op: best-effort.
      }
    }

    // Igual que cuando cancela el propio negocio: si se liberó un hueco
    // que encajaba con alguien en lista de espera, se le avisa.
    if (result.nextOffer && result.businessName && result.businessTimezone) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const respondUrl = `${siteUrl}/lista-espera/${result.nextOffer.respondToken}`;
      try {
        await sendWaitlistOffer({
          toPhone: result.nextOffer.customerPhone,
          customerName: result.nextOffer.customerName,
          businessName: result.businessName,
          serviceName: result.nextOffer.serviceName,
          startTimeIso: result.nextOffer.offeredStartTime,
          respondUrl,
        });
      } catch {
        // No-op: best-effort.
      }
      if (result.nextOffer.customerEmail) {
        try {
          await sendWaitlistOfferEmail({
            toEmail: result.nextOffer.customerEmail,
            customerName: result.nextOffer.customerName,
            businessName: result.businessName,
            serviceName: result.nextOffer.serviceName,
            startTimeIso: result.nextOffer.offeredStartTime,
            timezone: result.businessTimezone,
            respondUrl,
          });
        } catch {
          // No-op: best-effort.
        }
      }
    }

    revalidatePath("/mis-citas");
    return {};
  } catch (err) {
    // Se deja constancia del error real en los logs — antes se perdía del
    // todo, así que si esto volviera a pasar (la reoferta a lista de
    // espera ya queda aislada en la 0021, pero por si hay otra causa) se
    // podría ver cuál es en vez de a ciegas.
    console.error("[cancelBookingAction] No se pudo cancelar:", err);
    return { error: "No se pudo cancelar la reserva. Inténtalo de nuevo." };
  }
}
