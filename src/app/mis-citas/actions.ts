"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCustomerSessionToken, setCustomerSessionToken, clearCustomerSessionToken } from "@/lib/services/customerAuthSession";
import { customerSignup, customerLogin, customerLogout, leaveWaitlistByAccount } from "@/lib/services/customerAccountService";

export interface AuthActionInput {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

export interface AuthActionResult {
  error?: string;
  /** Solo en login: true cuando ese email no tiene ninguna cuenta todavía. */
  accountNotFound?: boolean;
}

export async function signupAction(input: AuthActionInput): Promise<AuthActionResult> {
  if (!input.name || !input.phone) {
    return { error: "Introduce tu nombre y tu teléfono." };
  }

  const supabase = await createClient();
  const result = await customerSignup(supabase, {
    email: input.email,
    password: input.password,
    name: input.name,
    phone: input.phone,
  });

  if (result.error || !result.sessionToken) {
    return { error: result.error ?? "No se pudo crear la cuenta." };
  }

  await setCustomerSessionToken(result.sessionToken);
  revalidatePath("/mis-citas");
  return {};
}

export async function loginAction(input: AuthActionInput): Promise<AuthActionResult> {
  const supabase = await createClient();
  const result = await customerLogin(supabase, input.email, input.password);

  if (result.error || !result.sessionToken) {
    return { error: result.error ?? "No se pudo iniciar sesión.", accountNotFound: result.accountNotFound };
  }

  await setCustomerSessionToken(result.sessionToken);
  revalidatePath("/mis-citas");
  return {};
}

export async function logoutAction(): Promise<void> {
  const token = await getCustomerSessionToken();
  if (token) {
    const supabase = await createClient();
    try {
      await customerLogout(supabase, token);
    } catch {
      // No-op: aunque falle borrar la fila en la base de datos, se borra
      // igualmente la cookie — el token caduca solo a los 30 días.
    }
  }
  await clearCustomerSessionToken();
  revalidatePath("/mis-citas");
}

export async function leaveWaitlistAction(entryId: string): Promise<{ error?: string }> {
  const token = await getCustomerSessionToken();
  if (!token) return { error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };

  const supabase = await createClient();
  const ok = await leaveWaitlistByAccount(supabase, token, entryId);
  if (!ok) return { error: "No se pudo quitar de la lista de espera." };

  revalidatePath("/mis-citas");
  return {};
}
