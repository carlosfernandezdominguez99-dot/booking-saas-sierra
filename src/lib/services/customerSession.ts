import "server-only";
import { cookies } from "next/headers";

/**
 * Sesión del portal del cliente (Fase 7.2) — el mismo dominio sirve a
 * varios negocios, así que la cookie va con el `businessId` en el nombre
 * (nunca una única cookie global) para que un cliente pueda tener sesión
 * en varios negocios a la vez sin pisarse entre sí.
 *
 * El valor guardado es directamente el `token` de `customer_access_tokens`
 * — no hay un paso aparte de "cambiar el enlace mágico por una sesión":
 * el mismo token sirve como enlace de un solo negocio Y como cookie de
 * sesión de hasta 30 días, a propósito, por simplicidad (lo que hay detrás
 * — horarios de citas — se considera de sensibilidad baja).
 */

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días — igual que expires_at en customer_access_tokens

export function customerCookieName(businessId: string): string {
  return `zoria_ct_${businessId}`;
}

/** Server Components, Server Actions y Route Handlers: token guardado para este negocio, o `null`. */
export async function getCustomerToken(businessId: string): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(customerCookieName(businessId))?.value ?? null;
}

/** Solo se puede llamar desde una Server Action o un Route Handler (nunca desde un Server Component). */
export async function setCustomerToken(businessId: string, token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(customerCookieName(businessId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** Solo se puede llamar desde una Server Action o un Route Handler. */
export async function clearCustomerToken(businessId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(customerCookieName(businessId));
}
