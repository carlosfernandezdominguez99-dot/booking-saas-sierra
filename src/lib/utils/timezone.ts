/**
 * Utilidades mínimas de zona horaria basadas en `Intl` (sin dependencias
 * externas): lo justo para agrupar reservas por "día de calendario" en la
 * zona horaria del negocio, que es lo único que necesita el panel
 * (calendario e inicio).
 */

/** Desfase (minutos) entre la hora local de `timeZone` y UTC en el instante `date`: hora local = hora UTC + desfase. */
function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUtc - date.getTime()) / 60000;
}

/**
 * Instante UTC (ISO) que corresponde a la medianoche del día `dateStr`
 * (YYYY-MM-DD) en `timeZone`. Es una aproximación (recalcula el desfase a
 * partir de una primera estimación en vez de resolver el instante exacto
 * de forma iterativa): en el día concreto de un cambio de hora se puede
 * desviar hasta una hora, que es un margen aceptable para agrupar
 * reservas por día en el panel.
 */
export function zonedMidnightToUtcIso(dateStr: string, timeZone: string): string {
  const naiveUtc = new Date(`${dateStr}T00:00:00Z`);
  const offsetMinutes = getTimezoneOffsetMinutes(naiveUtc, timeZone);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60000).toISOString();
}

/** Fecha de "hoy" (YYYY-MM-DD) tal como se ve en `timeZone`. */
export function todayInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}

/** Suma (o resta) `days` días de calendario a una fecha YYYY-MM-DD. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
