"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getAvailableSlots,
  getAvailableSlotsAnyEmployee,
  type AvailableSlot,
} from "@/lib/services/availabilityService";
import type { PublicBookingResult } from "@/lib/services/bookingService";
import { getCustomerSessionToken } from "@/lib/services/customerAuthSession";
import { createAccountBooking, getCustomerAccountProfile } from "@/lib/services/customerAccountService";
import { sendBookingConfirmation } from "@/lib/whatsapp/whatsappService";
import { sendBookingConfirmationEmail } from "@/lib/email/emailService";
import { cancelBookingAction } from "@/app/mis-citas/actions";

export interface GetSlotsActionInput {
  businessId: string;
  serviceId: string;
  /** YYYY-MM-DD, en la zona horaria del negocio. */
  date: string;
  /**
   * Sin empleado (negocio que no los usa): `undefined`/`null`. Un
   * empleado concreto: su id. "Cualquiera disponible" entre varios: la
   * lista de ids elegibles para ese servicio, con `anyOf`.
   */
  employeeId?: string | null;
  anyOf?: string[];
}

// Cada hueco lleva ya el empleado con el que se reservaría (si el negocio
// usa empleados) — así, al elegir una hora, el asistente sabe con quién
// reservar sin tener que volver a preguntar a la base de datos.
export interface SlotWithEmployee extends AvailableSlot {
  employeeId?: string;
}

// Un solo tipo con `slots` SIEMPRE presente (array vacío si hay error) en
// vez de una unión `{slots} | {error}`: TypeScript no consigue estrechar
// (narrow) `res.slots` a partir de comprobar `res.error` en el sitio
// donde se usa (falla el build con "Type 'undefined' is not assignable a
// SetStateAction<AvailableSlot[]>"), así que se evita depender de esa
// inferencia — mismo motivo por el que el resto del proyecto usa
// `data ?? []` en vez de fiarse del estrechado de tipos.
export interface GetSlotsActionResult {
  slots: SlotWithEmployee[];
  error?: string;
}

/**
 * Se llama directamente como función desde el cliente (no como `<form
 * action>`) cada vez que el visitante cambia de día (o de empleado) en el
 * asistente — igual que el resto de acciones "de lectura" del proyecto
 * que se invocan con `useTransition`. Sigue siendo de lectura pública
 * (`anon` conserva el `execute` de `get_available_slots`) — ver
 * `0014_require_account_booking.sql`, que solo revoca las de ESCRITURA.
 */
export async function getSlotsAction(input: GetSlotsActionInput): Promise<GetSlotsActionResult> {
  try {
    const supabase = await createClient();

    if (input.anyOf && input.anyOf.length > 0) {
      const slots = await getAvailableSlotsAnyEmployee(supabase, {
        businessId: input.businessId,
        serviceId: input.serviceId,
        date: input.date,
        employeeIds: input.anyOf,
      });
      return { slots };
    }

    const slots = await getAvailableSlots(supabase, input);
    return { slots: slots.map((s) => ({ ...s, employeeId: input.employeeId ?? undefined })) };
  } catch {
    return { slots: [], error: "No se pudieron cargar los huecos disponibles. Inténtalo de nuevo." };
  }
}

export interface CreateAccountBookingActionInput {
  businessId: string;
  serviceId: string;
  /** ISO timestamptz del hueco elegido (debe ser uno de los `slotStart` devueltos por `getSlotsAction`). */
  startTime: string;
  /** El empleado con el que se reserva — el que venía ya en el hueco elegido (`SlotWithEmployee.employeeId`). */
  employeeId?: string | null;
  comment?: string;
  /**
   * Si se viene de "Modificar" una cita (`CustomerAccountDashboard.tsx`),
   * el id de esa cita anterior — se cancela automáticamente en cuanto
   * esta nueva se crea con éxito, para no dejar las dos activas a la vez.
   */
  replaceBookingId?: string | null;
}

export interface CreateAccountBookingActionResult {
  result?: PublicBookingResult;
  error?: string;
  /**
   * Solo si venía de "Modificar" y la cita nueva se creó bien pero no se
   * pudo cancelar la anterior (p. ej. la política de cancelación de ese
   * negocio ya no lo permite a esta hora) — la reserva nueva es válida
   * igualmente, esto es solo un aviso para que el cliente sepa que tiene
   * que cancelar la anterior él mismo o avisar al negocio.
   */
  replaceWarning?: string;
}

/**
 * Reemplaza a la antigua `createPublicBookingAction` (Fase 7.4): ya no
 * hace falta ni se pueden mandar nombre/teléfono/email desde el
 * formulario — se reserva con la cuenta que tenga la sesión (cookie
 * `zoria_customer_session`), y es la propia base de datos la que usa sus
 * datos guardados (`create_account_booking`, que a su vez llama a
 * `create_public_booking` por dentro). Si no hay sesión válida, la
 * reserva ni se intenta — la página ya no debería haber llegado hasta
 * aquí sin cuenta, pero se revalida también aquí por si la cookie caducó
 * mientras el visitante tenía la página abierta.
 */
export async function createAccountBookingAction(
  input: CreateAccountBookingActionInput,
): Promise<CreateAccountBookingActionResult> {
  const token = await getCustomerSessionToken();
  if (!token) return { error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };

  try {
    const supabase = await createClient();

    // Hace falta el nombre/teléfono/email de la cuenta para el email/
    // WhatsApp de confirmación (la reserva en sí ya los toma internamente
    // en Postgres, pero esos avisos se mandan desde aquí).
    const profile = await getCustomerAccountProfile(supabase, token);
    if (!profile) return { error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };

    const comment = (input.comment ?? "").trim().slice(0, 300);

    // Revalida el hueco de verdad en Postgres (nunca se fía de lo que haya
    // calculado el cliente con `getAvailableSlots`) — si alguien más se
    // adelantó a por el mismo hueco entre medias, la función de base de
    // datos lo rechaza con un mensaje claro.
    const result = await createAccountBooking(supabase, token, {
      businessId: input.businessId,
      serviceId: input.serviceId,
      startTime: input.startTime,
      employeeId: input.employeeId ?? null,
      comment: comment || null,
    });

    // Hace falta la zona horaria del negocio para mostrar la hora
    // correcta en el email de confirmación (nunca en UTC) — se busca
    // aparte porque `create_account_booking` no la devuelve. Lectura
    // pública normal (RLS ya deja leer negocios activos a `anon`).
    const { data: businessRow } = await (supabase.from("businesses") as any)
      .select("timezone")
      .eq("id", input.businessId)
      .maybeSingle();
    const timezone = (businessRow?.timezone as string | undefined) ?? "Europe/Madrid";

    // Nombre del empleado (si lo hay) para que el recordatorio diga con
    // quién es la cita, no solo en qué negocio.
    let employeeName: string | null = null;
    if (input.employeeId) {
      const { data: employeeRow } = await (supabase.from("employees") as any)
        .select("name")
        .eq("id", input.employeeId)
        .maybeSingle();
      employeeName = (employeeRow?.name as string | undefined) ?? null;
    }

    // "Envío" de confirmación por WhatsApp — sigue siendo un mock que solo
    // deja un log (no hay cuenta de WhatsApp Business API conectada
    // todavía). Es un intento aparte, a propósito: si fallara, la reserva
    // ya está creada y no debe deshacerse ni mostrarse como un error al
    // cliente.
    try {
      await sendBookingConfirmation({
        toPhone: profile.phone,
        customerName: profile.name,
        businessName: result.businessName,
        serviceName: result.serviceName,
        startTimeIso: result.startTime,
        employeeName,
      });
    } catch {
      // No-op: best-effort.
    }

    // Confirmación por email — este sí es el canal real mientras tanto
    // (ver `emailService.ts`). Mismo motivo para el try/catch aparte.
    try {
      await sendBookingConfirmationEmail({
        toEmail: profile.email,
        customerName: profile.name,
        businessName: result.businessName,
        serviceName: result.serviceName,
        startTimeIso: result.startTime,
        timezone,
        employeeName,
      });
    } catch {
      // No-op: best-effort.
    }

    // Si venía de "Modificar", cancela la cita anterior ahora que la
    // nueva ya está creada — nunca al revés (si se cancelara primero y
    // luego fallara la creación de la nueva, el cliente se quedaría sin
    // ninguna). Reutiliza `cancelBookingAction` entero (mismo email de
    // cancelación y misma reoferta a la lista de espera que al cancelar
    // desde "Mis citas") en vez de duplicar esa lógica aquí.
    let replaceWarning: string | undefined;
    if (input.replaceBookingId) {
      const cancelRes = await cancelBookingAction(input.replaceBookingId);
      if (cancelRes.error) {
        replaceWarning = `Se creó la nueva cita, pero no se pudo cancelar la anterior automáticamente: ${cancelRes.error}`;
      }
    }

    return { result, replaceWarning };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear la reserva. Inténtalo de nuevo." };
  }
}
