import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Recibe al usuario después de que confirme su email (o de cualquier otro
 * flujo de Supabase Auth basado en PKCE que redirija con `?code=...`), y
 * cambia ese código de un solo uso por una sesión real (cookies).
 *
 * Esta URL debe estar configurada como `emailRedirectTo` en el `signUp`
 * (ver `registro/actions.ts`) y añadida a la lista de "Redirect URLs" del
 * proyecto de Supabase; si no, Supabase rechaza la confirmación.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding/negocio";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "No pudimos confirmar tu email. Prueba a iniciar sesión.",
    )}`,
  );
}
