import type { createClient } from "@/lib/supabase/server";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

export interface AvailableSlot {
  /** ISO timestamptz de inicio del hueco, en UTC. */
  slotStart: string;
  /** ISO timestamptz de fin del hueco, en UTC. */
  slotEnd: string;
}

export interface GetAvailableSlotsParams {
  businessId: string;
  serviceId: string;
  /** Fecha en formato YYYY-MM-DD, interpretada en la zona horaria del negocio. */
  date: string;
  employeeId?: string | null;
}

/**
 * Envuelve la función `get_available_slots` de Postgres (ver
 * `supabase/migrations/0003_booking_functions.sql`). Toda la lógica real
 * de disponibilidad — horario del día (incluida jornada partida, porque
 * la función recorre cada fila de `business_hours` de ese día), días
 * bloqueados, antelación mínima/máxima, buffer entre citas y solapes con
 * reservas existentes — vive en esa función `security definer`; esta capa
 * solo la invoca y da forma al resultado.
 *
 * Funciona igual con el cliente autenticado del panel que con el cliente
 * anónimo de la página pública: la función tiene `execute` concedido a
 * `anon` y a `authenticated` (0003_booking_functions.sql), y decide ella
 * misma qué exponer sin fugar datos de otras reservas.
 */
export async function getAvailableSlots(
  client: TypedClient,
  { businessId, serviceId, date, employeeId }: GetAvailableSlotsParams,
): Promise<AvailableSlot[]> {
  // `as unknown as` en el resultado, igual que en el resto del proyecto:
  // ver la nota larga en `database.types.ts` sobre por qué no nos fiamos
  // a ciegas de la inferencia automática de @supabase/supabase-js.
  const { data, error } = (await client.rpc("get_available_slots", {
    p_business_id: businessId,
    p_service_id: serviceId,
    p_date: date,
    p_employee_id: employeeId ?? null,
  })) as unknown as {
    data: { slot_start: string; slot_end: string }[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;

  return (data ?? []).map((slot) => ({ slotStart: slot.slot_start, slotEnd: slot.slot_end }));
}
