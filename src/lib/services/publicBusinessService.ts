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

export type PartnerBusiness = Pick<Database["public"]["Tables"]["businesses"]["Row"], "id" | "name" | "slug" | "logo_url">;

/**
 * Negocios reales que ya usan la app, para la sección "Negocios que ya
 * confían en nosotros" de la landing (`/`) — hasta `limit` (por defecto
 * 5), los más antiguos primero. Solo negocios que terminaron el
 * onboarding (si no, mostraría altas a medias sin servicios ni nada que
 * enseñar) — RLS ya limita la lectura pública a `subscription_status in
 * ('trial', 'active')`, así que no hace falta repetirlo aquí.
 */
export async function getPartnerBusinesses(limit = 5): Promise<PartnerBusiness[]> {
  const supabase = await createClient();

  const { data } = (await supabase
    .from("businesses")
    .select("id, name, slug, logo_url")
    .not("onboarding_completed_at", "is", null)
    .order("onboarding_completed_at", { ascending: true })
    .limit(limit)) as unknown as { data: PartnerBusiness[] | null };

  return data ?? [];
}
