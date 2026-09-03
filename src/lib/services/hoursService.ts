import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { WEEK_DAYS, type WeeklyHoursInput } from "@/lib/validations/business";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

type BusinessHoursRow = Database["public"]["Tables"]["business_hours"]["Row"];
type BusinessHoursInsert = Database["public"]["Tables"]["business_hours"]["Insert"];

const HOURS_COLUMNS = "id, business_id, employee_id, day_of_week, start_time, end_time, created_at";

/**
 * Solo gestiona los horarios "generales" del negocio (`employee_id IS
 * NULL`). Los horarios específicos por empleado son de una fase posterior.
 */
export async function listBusinessHours(client: TypedClient, businessId: string): Promise<BusinessHoursRow[]> {
  const { data, error } = (await client
    .from("business_hours")
    .select(HOURS_COLUMNS)
    .eq("business_id", businessId)
    .is("employee_id", null)
    .order("day_of_week", { ascending: true })) as unknown as {
    data: BusinessHoursRow[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return data ?? [];
}

/**
 * Sustituye el horario semanal completo del negocio: borra las filas
 * generales existentes y crea una fila por cada día abierto. Es más simple
 * y menos propenso a errores que calcular un diff día a día, y el
 * formulario siempre envía la semana entera.
 */
export async function replaceBusinessHours(
  client: TypedClient,
  businessId: string,
  hours: WeeklyHoursInput,
): Promise<void> {
  const { error: deleteError } = await (client.from("business_hours") as any)
    .delete()
    .eq("business_id", businessId)
    .is("employee_id", null);

  if (deleteError) throw deleteError;

  const openDays = hours.filter((day) => !day.closed);
  if (openDays.length === 0) return;

  const insertPayload: BusinessHoursInsert[] = openDays.map((day) => ({
    business_id: businessId,
    day_of_week: day.dayOfWeek,
    start_time: `${day.startTime}:00`,
    end_time: `${day.endTime}:00`,
  }));

  const { error } = await (client.from("business_hours") as any).insert(insertPayload);
  if (error) throw error;
}

/**
 * Convierte las filas guardadas en la forma que usa el formulario: un
 * elemento por cada uno de los 7 días (lunes→domingo), marcando
 * `closed: true` en los días sin fila en `business_hours`.
 */
export function hoursRowsToWeekly(rows: BusinessHoursRow[]): WeeklyHoursInput {
  return WEEK_DAYS.map(({ dayOfWeek }) => {
    const row = rows.find((r) => r.day_of_week === dayOfWeek);
    if (!row) {
      return { dayOfWeek, closed: true, startTime: "09:00", endTime: "20:00" };
    }
    return {
      dayOfWeek,
      closed: false,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
    };
  });
}
