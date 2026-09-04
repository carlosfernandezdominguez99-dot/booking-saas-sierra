import { z } from "zod";

/**
 * Datos de contacto del formulario público de reserva (Fase 5). El
 * negocio y el hueco elegido no se validan aquí con Zod: se revalidan de
 * verdad en `create_public_booking` (Postgres, `security definer`), que
 * nunca se fía de lo que calculó el cliente.
 */
export const publicBookingContactSchema = z.object({
  customerName: z.string().trim().min(2, "Introduce tu nombre"),
  customerPhone: z
    .string()
    .trim()
    .min(6, "Introduce un teléfono válido")
    .max(20, "Ese teléfono no parece válido"),
  customerEmail: z
    .string()
    .trim()
    .email("Introduce un email válido")
    .optional()
    .or(z.literal("")),
  comment: z.string().trim().max(300, "Máximo 300 caracteres").optional().or(z.literal("")),
});

export type PublicBookingContactInput = z.infer<typeof publicBookingContactSchema>;
