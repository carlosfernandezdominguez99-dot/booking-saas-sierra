import { z } from "zod";

export const BUSINESS_TYPES = [
  { value: "peluqueria", label: "Peluquería" },
  { value: "barberia", label: "Barbería" },
  { value: "estetica", label: "Centro de estética" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "academia", label: "Academia" },
  { value: "autoescuela", label: "Autoescuela" },
  { value: "entrenador_personal", label: "Entrenador personal" },
  { value: "otro", label: "Otro" },
] as const;

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Introduce tu nombre completo"),
  email: z.string().trim().email("Introduce un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  businessName: z.string().trim().min(2, "Introduce el nombre de tu negocio"),
  phone: z.string().trim().min(6, "Introduce un teléfono válido"),
  businessType: z.enum(
    BUSINESS_TYPES.map((t) => t.value) as [string, ...string[]],
    { errorMap: () => ({ message: "Selecciona el tipo de negocio" }) },
  ),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Introduce un email válido"),
  password: z.string().min(1, "Introduce tu contraseña"),
});

export type LoginInput = z.infer<typeof loginSchema>;
