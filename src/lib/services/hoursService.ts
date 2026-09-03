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
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })) as unknown as {
    data: BusinessHoursRow[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return data ?? [];
}

/**
 * Sustituye el horario semanal completo del negocio: borra las filas
 * generales existentes y crea una fila por cada tramo de cada día abierto
 * (un día con jornada partida genera varias filas con el mismo
 * `day_of_week`). Es más simple y menos propenso a errores que calcular un
 * diff tramo a tramo, y el formulario siempre envía la semana entera.
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

  const insertPayload: BusinessHoursInsert[] = hours
    .filter((day) => !day.closed)
    .flatMap((day) =>
      day.ranges.map((range) => ({
        business_id: businessId,
        day_of_week: day.dayOfWeek,
        start_time: `${range.startTime}:00`,
        end_time: `${range.endTime}:00`,
      })),
    );

  if (insertPayload.length === 0) return;

  const { error } = await (client.from("business_hours") as any).insert(insertPayload);
  if (error) throw error;
}

/**
 * Convierte las filas guardadas en la forma que usa el formulario: un
 * elemento por cada uno de los 7 días (lunes→domingo), agrupando todas las
 * filas de un mismo día en su lista de tramos (`ranges`), y marcando
 * `closed: true` en los días sin ninguna fila en `business_hours`.
 */
export function hoursRowsToWeekly(rows: BusinessHoursRow[]): WeeklyHoursInput {
  return WEEK_DAYS.map(({ dayOfWeek }) => {
    const dayRows = rows
      .filter((r) => r.day_of_week === dayOfWeek)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (dayRows.length === 0) {
      return { dayOfWeek, closed: true, ranges: [] };
    }

    return {
      dayOfWeek,
      closed: false,
      ranges: dayRows.map((row) => ({
        startTime: row.start_time.slice(0, 5),
        endTime: row.end_time.slice(0, 5),
      })),
    };
  });
}
