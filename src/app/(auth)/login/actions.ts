"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/utils/rateLimit";

export interface LoginFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const redirectTo = String(formData.get("redirectTo") ?? "") || "/dashboard/inicio";

  // Freno a probar contraseñas por fuerza bruta: 10 intentos cada 15 min
  // por IP, sin importar el email que se pruebe cada vez.
  const { allowed } = await checkRateLimit("login", { maxRequests: 10, windowSeconds: 15 * 60 });
  if (!allowed) return { error: RATE_LIMIT_MESSAGE };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Revisa los campos marcados.", fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  redirect(redirectTo);
}
