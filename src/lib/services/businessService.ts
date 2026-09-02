import type { createClient } from "@/lib/supabase/server";
import { slugify, withRandomSuffix } from "@/lib/utils/slugify";

// Se deriva del propio factory de `lib/supabase/server.ts` en vez de
// reescribir a mano los genéricos de `SupabaseClient<Database>`: así el
// tipo siempre coincide exactamente con el cliente real que se le pasa,
// sin depender de cómo @supabase/ssr resuelva esos genéricos por dentro
// en cada versión (una discrepancia ahí rompía el build en Vercel).
type TypedClient = Awaited<ReturnType<typeof createClient>>;

const MAX_SLUG_ATTEMPTS = 5;

/**
 * Crea el negocio de un usuario recién registrado, resolviendo colisiones
 * de slug automáticamente. Se apoya en RLS: solo funciona si `ownerId`
 * coincide con el usuario autenticado en `client`.
 */
export async function createBusinessForOwner(
  client: TypedClient,
  params: { ownerId: string; name: string; phone: string; businessType: string },
) {
  const baseSlug = slugify(params.name) || "negocio";
  let attempt = 0;
  let lastError: { message: string } | null = null;

  while (attempt < MAX_SLUG_ATTEMPTS) {
    const candidateSlug = attempt === 0 ? baseSlug : withRandomSuffix(baseSlug);

    const { data, error } = await client
      .from("businesses")
      .insert({
        owner_id: params.ownerId,
        name: params.name,
        slug: candidateSlug,
        phone: params.phone,
        business_type: params.businessType,
      })
      .select("id, slug")
      .single();

    if (!error) {
      return data;
    }

    // 23505 = unique_violation (slug duplicado): reintenta con otro slug.
    const isSlugCollision =
      "code" in error && (error as { code?: string }).code === "23505";
    if (!isSlugCollision) {
      throw error;
    }

    lastError = error;
    attempt += 1;
  }

  throw lastError ?? new Error("No se pudo generar un enlace único para el negocio.");
}

/**
 * Devuelve el primer negocio del que el usuario autenticado es miembro.
 *
 * Se hace en dos consultas planas (en vez de un select anidado
 * `businesses(*)`) porque nuestros tipos de Supabase están escritos a
 * mano y no incluyen metadatos de relaciones; ver el comentario
 * equivalente en `authContext.ts`.
 */
export async function getPrimaryBusinessForUser(client: TypedClient, userId: string) {
  const { data: membership, error: membershipError } = await client
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;

  // Lista explícita de columnas en vez de select("*"): ver el comentario
  // equivalente en authContext.ts.
  const { data: business, error: businessError } = await client
    .from("businesses")
    .select(
      "id, owner_id, name, slug, description, logo_url, phone, address, city, business_type, timezone, subscription_status, trial_ends_at, onboarding_completed_at, created_at, updated_at",
    )
    .eq("id", membership.business_id)
    .single();

  if (businessError) throw businessError;
  return { role: membership.role, business };
}
