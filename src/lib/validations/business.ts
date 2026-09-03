import { z } from "zod";

// -----------------------------------------------------------------------
// Paso 1 del onboarding: datos adicionales del negocio (el nombre, teléfono
// y tipo ya se piden en el registro).
// -----------------------------------------------------------------------
export const businessProfileSchema = z.object({
  description: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
});
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

// -----------------------------------------------------------------------
// Paso 2: servicios.
// -----------------------------------------------------------------------
export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Introduce un nombre").max(80),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  // El precio se introduce en euros (con decimales) y se convierte a
  // céntimos antes de guardar, para no perder precisión con floats.
  priceEuros: z
    .number({ invalid_type_error: "Introduce un precio válido" })
    .min(0, "El precio no puede ser negativo")
    .max(10000, "Precio demasiado alto"),
  durationMinutes: z
    .number({ invalid_type_error: "Introduce una duración válida" })
    .int()
    .min(5, "Mínimo 5 minutos")
    .max(600, "Máximo 600 minutos"),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

// -----------------------------------------------------------------------
// Paso 3: horarios. Un rango por día (suficiente para el MVP; varios
// tramos por día — p. ej. mañana y tarde con descanso — queda para una
// fase posterior).
// -----------------------------------------------------------------------
export const dayHoursSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    closed: z.boolean(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido"),
  })
  .refine((d) => d.closed || d.startTime < d.endTime, {
    message: "La hora de cierre debe ser posterior a la de apertura",
    path: ["endTime"],
  });
export type DayHoursInput = z.infer<typeof dayHoursSchema>;

export const weeklyHoursSchema = z.array(dayHoursSchema).length(7);
export type WeeklyHoursInput = z.infer<typeof weeklyHoursSchema>;

// -----------------------------------------------------------------------
// Paso 4: configuración de reservas.
// -----------------------------------------------------------------------
export const bookingSettingsSchema = z.object({
  minNoticeMinutes: z.number().int().min(0).max(10080), // hasta 7 días
  maxNoticeDays: z.number().int().min(1).max(365),
  bufferMinutes: z.number().int().min(0).max(120),
  allowCancellation: z.boolean(),
  minCancellationHours: z.number().int().min(0).max(168),
});
export type BookingSettingsInput = z.infer<typeof bookingSettingsSchema>;

// Etiquetas en español para los días, en el orden en que se muestran en la
// UI (lunes primero), junto con su `day_of_week` real en la base de datos
// (0 = domingo, según la migración).
export const WEEK_DAYS: { dayOfWeek: number; label: string; short: string }[] = [
  { dayOfWeek: 1, label: "Lunes", short: "L" },
  { dayOfWeek: 2, label: "Martes", short: "M" },
  { dayOfWeek: 3, label: "Miércoles", short: "X" },
  { dayOfWeek: 4, label: "Jueves", short: "J" },
  { dayOfWeek: 5, label: "Viernes", short: "V" },
  { dayOfWeek: 6, label: "Sábado", short: "S" },
  { dayOfWeek: 0, label: "Domingo", short: "D" },
];

export function defaultWeeklyHours(): WeeklyHoursInput {
  return WEEK_DAYS.map(({ dayOfWeek }) => ({
    dayOfWeek,
    closed: dayOfWeek === 0, // domingo cerrado por defecto
    startTime: "09:00",
    endTime: "20:00",
  }));
}
