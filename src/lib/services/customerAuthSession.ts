import "server-only";
import { cookies } from "next/headers";

/**
 * Sesión de la cuenta de cliente (Fase 7.3 — sustituye al enlace mágico
 * por negocio de la Fase 7.2). Ahora es UNA sola cookie global, no una por
 * negocio: la cuenta agrega citas de cualquier negocio, así que no tiene
 * sentido namespacearla por `businessId` como antes.
 *
 * El valor guardado es directamente el `token` de `customer_sessions` —
 * mismo patrón de siempre (el token sirve de sesión de hasta 30 días sin
 * un paso aparte de "canjear" nada).
 */

const COOKIE_NAME = "zoria_customer_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días — igual que expires_at en customer_sessions

/** Server Components, Server Actions y Route Handlers: token de sesión guardado, o `null`. */
export async function getCustomerSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

/** Solo se puede llamar desde una Server Action o un Route Handler (nunca desde un Server Component). */
export async function setCustomerSessionToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** Solo se puede llamar desde una Server Action o un Route Handler. */
export async function clearCustomerSessionToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
