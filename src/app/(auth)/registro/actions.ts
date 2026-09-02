"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createBusinessForOwner } from "@/lib/services/businessService";
import { registerSchema } from "@/lib/validations/auth";

export interface RegisterFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function registerAction(
  _prevState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    businessType: String(formData.get("businessType") ?? ""),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Revisa los campos marcados.", fieldErrors };
  }

  const { fullName, email, password, businessName, phone, businessType } = parsed.data;

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } },
  });

  if (signUpError) {
    return { error: mapAuthError(signUpError.message) };
  }

  // Si el proyecto de Supabase requiere confirmación de email, `session`
  // vendrá vacío aquí: no hay forma de crear el negocio todavía (RLS exige
  // un usuario autenticado). Pedimos al usuario que confirme su correo.
  if (!signUpData.session) {
    return {
      error:
        "Te hemos enviado un email para confirmar tu cuenta. Confírmalo y después inicia sesión para continuar.",
    };
  }

  try {
    await createBusinessForOwner(supabase, {
      ownerId: signUpData.session.user.id,
      name: businessName,
      phone,
      businessType,
    });
  } catch {
    return {
      error:
        "Tu cuenta se creó correctamente, pero no pudimos crear el negocio. Inicia sesión y vuelve a intentarlo.",
    };
  }

  redirect("/onboarding/negocio");
}

function mapAuthError(message: string): string {
  if (message.toLowerCase().includes("already registered")) {
    return "Ya existe una cuenta con ese email. Prueba a iniciar sesión.";
  }
  return "No se pudo crear la cuenta. Inténtalo de nuevo.";
}
