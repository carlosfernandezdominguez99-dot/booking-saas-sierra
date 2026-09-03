"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

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
    // TODO(fase 9 - pulido final): quitar el detalle técnico entre
    // paréntesis antes de lanzar a usuarios reales. Se deja temporalmente
    // mientras depuramos el flujo de registro/confirmación de email.
    return { error: `Email o contraseña incorrectos. (${error.message})` };
  }

  redirect(redirectTo);
}
