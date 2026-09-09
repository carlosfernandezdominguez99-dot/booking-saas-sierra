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
  // `(client.rpc as any)`: el overload de `.rpc()` no está resolviendo el
  // parámetro de argumentos para esta función (falla en build con "is not
  // assignable to parameter of type 'undefined'"), el mismo tipo de fallo
  // de inferencia que motivó los `as any` en `.insert()`/`.update()` — ver
  // la nota larga en `database.types.ts`. Se evita apoyándose en el
  // overload sin tipar, y se fuerza el resultado al shape real que
  // esperamos.
  const { data, error } = (await (client.rpc as any)("get_available_slots", {
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

export interface AvailableSlotWithEmployee extends AvailableSlot {
  /**
   * Qué empleado concreto ofrece este hueco — el que se reserva de verdad
   * si se elige. `undefined` significa el propio gerente (Fase 9.2):
   * "sin empleado" sigue siendo un candidato más, no solo lo que queda
   * cuando no hay ninguno de verdad.
   */
  employeeId?: string;
}

/**
 * "Cualquiera disponible": pide los huecos de CADA candidato elegible por
 * separado (`get_available_slots` ya sabe hacerlo uno a uno) y los junta
 * en una sola lista de horas, sin duplicar una misma hora si varios
 * candidatos la tienen libre — se queda con el primero de la lista
 * (`employeeIds` ya viene en el orden en que se quiera priorizar) para
 * cada hora repetida. Así la persona que reserva solo ve "a qué horas hay
 * hueco", pero la reserva se crea siempre con un candidato concreto y
 * libre de verdad — nunca "sin decidir", que rompería la garantía de
 * no-solape (ver el comentario en `0018_employees_feature.sql`).
 *
 * `null` dentro de `employeeIds` representa al gerente (Fase 9.2): su
 * propia agenda ("sin empleado") entra en la mezcla igual que cualquier
 * empleado real, para no perderla en cuanto el negocio tiene empleados.
 */
export async function getAvailableSlotsAnyEmployee(
  client: TypedClient,
  params: { businessId: string; serviceId: string; date: string; employeeIds: (string | null)[] },
): Promise<AvailableSlotWithEmployee[]> {
  const perEmployee = await Promise.all(
    params.employeeIds.map(async (employeeId) => ({
      employeeId: employeeId ?? undefined,
      slots: await getAvailableSlots(client, { ...params, employeeId }),
    })),
  );

  const byStart = new Map<string, AvailableSlotWithEmployee>();
  for (const { employeeId, slots } of perEmployee) {
    for (const slot of slots) {
      if (!byStart.has(slot.slotStart)) {
        byStart.set(slot.slotStart, { ...slot, employeeId });
      }
    }
  }

  return [...byStart.values()].sort((a, b) => a.slotStart.localeCompare(b.slotStart));
}
