import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/admin"];

/**
 * Refresca la sesión de Supabase en cada petición y protege las rutas
 * privadas. Se invoca desde el middleware raíz de Next.js.
 *
 * La comprobación de sesión aquí es solo la primera barrera (evita
 * renderizar el panel a un usuario sin sesión). La autorización real por
 * negocio (RLS + verificación de business_id) ocurre siempre en el
 * servidor, en cada Server Component / Route Handler.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Se especifica el genérico `<Database>` explícitamente (igual que en
  // `lib/supabase/server.ts`) y se anota el parámetro de `setAll` a mano:
  // sin ambas cosas, TypeScript no consigue dar contexto de tipos a los
  // parámetros de los callbacks de `cookies` aquí y `next build` falla con
  // "implicitly has an 'any' type" bajo `strict`.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
