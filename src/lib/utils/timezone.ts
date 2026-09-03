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

/** Fecha de calendario (YYYY-MM-DD) tal como se ve `iso` (timestamptz) en `timeZone`. Inversa de `zonedMidnightToUtcIso`. */
export function dateStringInTimezone(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}

/** Suma (o resta) `months` meses de calendario, devolviendo siempre el día 1 de ese mes (YYYY-MM-01). */
export function addMonthsToDateString(dateStr: string, months: number): string {
  const [y, m] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  return date.toISOString().slice(0, 10);
}

/** Día 1 (YYYY-MM-01) del mes al que pertenece `dateStr`. */
export function startOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Lunes (YYYY-MM-DD) de la semana a la que pertenece `dateStr`. Semana de lunes a domingo. */
export function startOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0 = domingo .. 6 = sábado
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

/**
 * Semanas completas (lunes a domingo, cada una un array de 7 fechas
 * YYYY-MM-DD) necesarias para pintar la cuadrícula de un mes en el
 * calendario del panel — incluye los días de relleno del mes anterior y
 * siguiente que caen en la primera/última semana visible.
 */
export function getMonthGridWeeks(dateStr: string): string[][] {
  const first = startOfMonth(dateStr);
  const [y, m] = first.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastDateStr = `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const gridStart = startOfWeek(first);
  const gridEnd = startOfWeek(lastDateStr);

  const weeks: string[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDaysToDateString(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
