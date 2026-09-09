"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptEmployeeInvite } from "@/lib/services/employeeInviteService";

export interface AcceptInviteResult {
  error?: string;
  /** Si el proyecto exige confirmar el email antes de tener sesión. */
  needsEmailConfirmation?: boolean;
}

/**
 * Crea la cuenta con el email de la invitación (no se deja escribir otro,
 * para que quede claro que es ESA invitación la que se acepta) y, si ya
 * hay sesión tras el `signUp` (sin confirmación de email por medio),
 * acepta la invitación al momento y entra directo al panel.
 */
export async function signupForInviteAction(
  token: string,
  email: string,
  fullName: string,
  password: string,
): Promise<AcceptInviteResult> {
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes("already registered")) {
      return { error: "Ya existe una cuenta con ese email — usa \"Ya tengo cuenta\" para iniciar sesión." };
    }
    return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }

  if (!signUpData.session) {
    return { needsEmailConfirmation: true };
  }

  const result = await acceptEmployeeInvite(supabase, token);
  if (!result.ok) {
    return { error: result.error ?? "No se pudo aceptar la invitación." };
  }

  redirect("/dashboard/inicio");
}

/** Para quien ya tiene cuenta (de este negocio o de otro) — inicia sesión y acepta. */
export async function loginForInviteAction(token: string, email: string, password: string): Promise<AcceptInviteResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  const result = await acceptEmployeeInvite(supabase, token);
  if (!result.ok) {
    return { error: result.error ?? "No se pudo aceptar la invitación." };
  }

  redirect("/dashboard/inicio");
}
