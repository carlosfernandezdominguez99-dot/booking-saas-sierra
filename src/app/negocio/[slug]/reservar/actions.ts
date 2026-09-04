"use server";

import { createClient } from "@/lib/supabase/server";
import { getAvailableSlots, type AvailableSlot } from "@/lib/services/availabilityService";
import { createPublicBooking, type PublicBookingResult } from "@/lib/services/bookingService";
import { sendBookingConfirmation } from "@/lib/whatsapp/whatsappService";
import { publicBookingContactSchema } from "@/lib/validations/publicBooking";

export interface GetSlotsActionInput {
  businessId: string;
  serviceId: string;
  /** YYYY-MM-DD, en la zona horaria del negocio. */
  date: string;
}

export type GetSlotsActionResult = { slots: AvailableSlot[]; error?: undefined } | { slots?: undefined; error: string };

/**
 * Se llama directamente como función desde el cliente (no como `<form
 * action>`) cada vez que el visitante cambia de día en el selector de
 * fecha — igual que el resto de acciones "de lectura" del proyecto que se
 * invocan con `useTransition`. Usa el cliente `anon` (sin sesión): la
 * función de Postgres que hay detrás tiene `execute` concedido a `anon`
 * precisamente para esto.
 */
export async function getSlotsAction(input: GetSlotsActionInput): Promise<GetSlotsActionResult> {
  try {
    const supabase = await createClient();
    const slots = await getAvailableSlots(supabase, input);
    return { slots };
  } catch {
    return { error: "No se pudieron cargar los huecos disponibles. Inténtalo de nuevo." };
  }
}

export interface CreatePublicBookingActionInput {
  businessId: string;
  serviceId: string;
  /** ISO timestamptz del hueco elegido (debe ser uno de los `slotStart` devueltos por `getSlotsAction`). */
  startTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  comment?: string;
}

export interface CreatePublicBookingActionResult {
  result?: PublicBookingResult;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Crea la reserva pública. Revalida el hueco en Postgres (nunca en el
 * cliente) — si alguien más se adelantó a por el mismo hueco entre que se
 * cargaron los huecos disponibles y que este visitante confirmó, la
 * función de base de datos lo rechaza con un mensaje claro
 * ("Ese horario ya no está disponible") en vez de crear un solape.
 */
export async function createPublicBookingAction(
  input: CreatePublicBookingActionInput,
): Promise<CreatePublicBookingActionResult> {
  const parsed = publicBookingContactSchema.safeParse({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail ?? "",
    comment: input.comment ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Revisa los campos marcados.", fieldErrors };
  }

  try {
    const supabase = await createClient();
    const result = await createPublicBooking(supabase, {
      businessId: input.businessId,
      serviceId: input.serviceId,
      startTime: input.startTime,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      customerEmail: parsed.data.customerEmail || null,
      comment: parsed.data.comment || null,
    });

    // "Envío" de confirmación por WhatsApp — hoy es un mock que solo deja
    // un log (la integración real llega en la Fase 7). Es un intento
    // aparte, a propósito: si fallara, la reserva ya está creada y no debe
    // deshacerse ni mostrarse como un error al cliente.
    try {
      await sendBookingConfirmation({
        toPhone: parsed.data.customerPhone,
        customerName: parsed.data.customerName,
        businessName: result.businessName,
        serviceName: result.serviceName,
        startTimeIso: result.startTime,
      });
    } catch {
      // No-op: best-effort.
    }

    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear la reserva. Inténtalo de nuevo." };
  }
}
