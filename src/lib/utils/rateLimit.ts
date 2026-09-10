import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * IP del visitante tal como la ve Vercel (`x-forwarded-for`: el primer
 * valor de la lista es el cliente real, el resto son proxies
 * intermedios). En local (sin esa cabecera) se usa un valor fijo — el
 * límite ahí no protege nada, pero tampoco hace falta: solo importa en
 * producción, donde Vercel sí la manda siempre.
 */
async function getClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "local";
}

/**
 * Límite de peticiones por IP+acción, respaldado en Postgres
 * (`check_rate_limit`, ver `0024_rate_limiting.sql`) — así funciona igual
 * sin importar en qué instancia serverless de Vercel caiga cada petición.
 *
 * Se llama al principio de un Server Action público (login, registro,
 * reservar, dejar una reseña...) y, si `allowed` sale `false`, se corta
 * ahí devolviendo el mismo tipo de error que ya usa esa acción — nunca se
 * bloquea a nadie por un fallo NUESTRO comprobando el límite (p. ej. si
 * esta migración todavía no se ha ejecutado): en ese caso se deja pasar,
 * como si el límite no existiera, en vez de dejar la acción inservible.
 */
export async function checkRateLimit(
  action: string,
  { maxRequests, windowSeconds }: { maxRequests: number; windowSeconds: number },
): Promise<{ allowed: boolean }> {
  try {
    const ip = await getClientIp();
    const supabase = await createClient();
    const { data, error } = (await (supabase.rpc as any)("check_rate_limit", {
      p_bucket_key: `${action}:${ip}`,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    })) as { data: boolean | null; error: { message: string } | null };

    if (error) {
      console.error(`[rateLimit] Fallo comprobando "${action}":`, error.message);
      return { allowed: true };
    }
    return { allowed: data !== false };
  } catch (err) {
    console.error(`[rateLimit] Fallo comprobando "${action}":`, err);
    return { allowed: true };
  }
}

/** Mensaje homogéneo para cuando se corta por rate limit — mismo texto en todas partes. */
export const RATE_LIMIT_MESSAGE = "Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.";
