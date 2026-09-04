import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Ver el comentario detallado en `authContext.ts`: con los tipos de
// Supabase escritos a mano, forzar aquí el tipo explícito del resultado
// evita depender de una inferencia automática de `.select(...)` que en
// algunos casos concretos colapsaba a `never` en el build de Vercel.
export type PublicBusiness = Pick<
  Database["public"]["Tables"]["businesses"]["Row"],
  "id" | "name" | "description" | "logo_url" | "city" | "business_type" | "timezone"
>;

export type PublicService = Pick<
  Database["public"]["Tables"]["services"]["Row"],
  "id" | "name" | "description" | "price_cents" | "duration_minutes"
>;

/**
 * Negocio + servicios activos vistos desde la página pública (sin sesión,
 * cliente `anon`, sujeto a las políticas RLS de lectura pública). La usan
 * tanto `/negocio/[slug]` como `/negocio/[slug]/reservar` (Fase 5) — vive
 * en un solo sitio para no duplicar la consulta ni sus tipos.
 */
export async function getPublicBusinessBySlug(
  slug: string,
): Promise<{ business: PublicBusiness; services: PublicService[] } | null> {
  const supabase = await createClient();

  const { data: business } = (await supabase
    .from("businesses")
    .select("id, name, description, logo_url, city, business_type, timezone")
    .eq("slug", slug)
    .maybeSingle()) as unknown as { data: PublicBusiness | null };

  if (!business) return null;

  const { data: services } = (await supabase
    .from("services")
    .select("id, name, description, price_cents, duration_minutes")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("position", { ascending: true })) as unknown as { data: PublicService[] | null };

  return { business, services: services ?? [] };
}
