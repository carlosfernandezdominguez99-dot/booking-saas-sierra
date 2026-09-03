import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { slugify, withRandomSuffix } from "@/lib/utils/slugify";

// Se deriva del propio factory de `lib/supabase/server.ts` en vez de
// reescribir a mano los genéricos de `SupabaseClient<Database>`: así el
// tipo siempre coincide exactamente con el cliente real que se le pasa,
// sin depender de cómo @supabase/ssr resuelva esos genéricos por dentro
// en cada versión (una discrepancia ahí rompía el build en Vercel).
type TypedClient = Awaited<ReturnType<typeof createClient>>;

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
type BusinessInsert = Database["public"]["Tables"]["businesses"]["Insert"];
type BusinessUpdate = Database["public"]["Tables"]["businesses"]["Update"];

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

    // El objeto a insertar se tipa por separado contra `BusinessInsert`
    // (para detectar typos/columnas inexistentes en este archivo), y la
    // llamada a `.insert(...)` en sí se hace sobre el query builder "sin
    // tipar" (`as any` solo en el acceso a la tabla) y el resultado final
    // se fuerza al shape que realmente esperamos. Esto evita depender de
    // cómo resuelve @supabase/supabase-js el genérico de `insert()` para
    // esta tabla, que en algún build de Vercel llegó a colapsar a
    // `never[]` pese a que `Database["businesses"]["Insert"]` es correcto
    // (ver la nota larga en `database.types.ts`).
    const insertPayload: BusinessInsert = {
      owner_id: params.ownerId,
      name: params.name,
      slug: candidateSlug,
      phone: params.phone,
      business_type: params.businessType,
    };

    const { data, error } = (await (client.from("businesses") as any)
      .insert(insertPayload)
      .select("id, slug")
      .single()) as unknown as {
      data: { id: string; slug: string } | null;
      error: { message: string; code?: string } | null;
    };

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
export async function getPrimaryBusinessForUser(
  client: TypedClient,
  // Ya no se usa: la RPC de abajo resuelve siempre el negocio del usuario
  // autenticado de la sesión (`auth.uid()` dentro de la función SQL), no
  // el id que se le pase aquí. Se mantiene el parámetro para no tener que
  // tocar todas las llamadas existentes (`ensureBusinessForUser` sigue
  // pasando `user.id`).
  _userId: string,
): Promise<{ role: string; business: BusinessRow } | null> {
  // Antes esto eran dos consultas secuenciadas (`business_members` y
  // luego `businesses`): dos idas y vueltas de red a Supabase en CADA
  // página del panel, porque `requireBusinessContext` pasa por aquí
  // siempre. Se sustituyen por una sola llamada a la función SQL
  // `get_my_primary_business` (`0005_primary_business_rpc.sql`), que hace
  // el join dentro de Postgres y devuelve todo de una vez — la mitad de
  // idas y vueltas en cada carga del panel.
  //
  // `(client.rpc as any)`: mismo fallo de inferencia de tipos que en
  // `availabilityService.ts`/`bookingService.ts` — ver el comentario
  // detallado allí.
  const { data, error } = (await (client.rpc as any)("get_my_primary_business")) as unknown as {
    data: ({ role: string } & BusinessRow)[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;

  const row = data?.[0];
  if (!row) return null;

  const { role, ...business } = row;
  return { role, business: business as unknown as BusinessRow };
}

/**
 * Devuelve el negocio del usuario autenticado, creándolo si todavía no
 * existe.
 *
 * Es necesaria porque, cuando el proyecto de Supabase exige confirmación
 * de email, `registerAction` no puede crear el negocio en el momento del
 * registro (no hay sesión todavía, y RLS exige un usuario autenticado).
 * En su lugar, los datos del negocio (`business_name`, `business_type`,
 * `phone`) se guardan en `user_metadata` durante el `signUp`, y esta
 * función los usa para crear el negocio la primera vez que el usuario
 * llega autenticado (tras confirmar su email y pasar por
 * `/auth/callback`, o simplemente al iniciar sesión).
 */
export async function ensureBusinessForUser(
  client: TypedClient,
  user: { id: string; user_metadata?: Record<string, unknown> | null },
): Promise<{ role: string; business: BusinessRow } | null> {
  const existing = await getPrimaryBusinessForUser(client, user.id);
  if (existing) return existing;

  const metadata = (user.user_metadata ?? {}) as {
    business_name?: string;
    business_type?: string;
    phone?: string;
  };

  if (!metadata.business_name) return null;

  await createBusinessForOwner(client, {
    ownerId: user.id,
    name: metadata.business_name,
    phone: metadata.phone ?? "",
    businessType: metadata.business_type ?? "",
  });

  return getPrimaryBusinessForUser(client, user.id);
}

/**
 * Paso 1 del onboarding: descripción, dirección y ciudad. El resto de
 * datos del negocio (nombre, teléfono, tipo) ya se piden en el registro.
 */
export async function updateBusinessProfile(
  client: TypedClient,
  businessId: string,
  input: { description?: string; address?: string; city?: string },
): Promise<void> {
  const updatePayload: BusinessUpdate = {
    description: input.description ? input.description : null,
    address: input.address ? input.address : null,
    city: input.city ? input.city : null,
  };

  // `as any` en el acceso a la tabla por el mismo motivo que en
  // `createBusinessForOwner`: ver la nota larga en `database.types.ts`.
  const { error } = await (client.from("businesses") as any)
    .update(updatePayload)
    .eq("id", businessId);

  if (error) throw error;
}

/**
 * Marca el asistente de onboarding como completado (último paso, paso 5).
 */
export async function completeOnboarding(client: TypedClient, businessId: string): Promise<void> {
  const updatePayload: BusinessUpdate = { onboarding_completed_at: new Date().toISOString() };

  const { error } = await (client.from("businesses") as any)
    .update(updatePayload)
    .eq("id", businessId);

  if (error) throw error;
}
