import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database, BusinessMemberRole } from "@/types/database.types";

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
type MembershipRow = { business_id: string; role: BusinessMemberRole };

/**
 * Resuelve el usuario autenticado y su negocio principal para las páginas
 * del panel privado. Si no hay sesión, redirige a /login. Si hay sesión
 * pero todavía no hay negocio (no debería pasar tras el registro, pero se
 * cubre por robustez), redirige a /registro.
 *
 * Se llama desde Server Components / layouts del dashboard: todo lo que
 * dependa del negocio actual pasa por aquí, nunca se confía en datos
 * enviados por el cliente para decidir de qué negocio se sirven datos.
 *
 * Nota: se hacen dos consultas en lugar de un "select" anidado
 * (`business_members` → `businesses(*)`) a propósito: nuestros tipos de
 * Supabase están escritos a mano (sin metadatos de relaciones), y el
 * tipado de selects anidados de @supabase/supabase-js depende de esos
 * metadatos. Dos consultas planas son igual de eficientes para este caso
 * y evitan depender de esa inferencia.
 *
 * El tipo de retorno se anota explícitamente (`Promise<{ ...; business:
 * BusinessRow; ... }>`) y el resultado de la consulta de `businesses` se
 * fuerza con `as unknown as BusinessRow | null`. En la versión de
 * @supabase/supabase-js instalada, el tipo automático que infiere
 * `.select(...)` para esta tabla concreta colapsaba a `never` en el build
 * de Vercel (aunque la consulta en sí funciona perfectamente en runtime);
 * forzar el tipo aquí evita depender de esa inferencia rota.
 */
export async function requireBusinessContext(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  business: BusinessRow;
  role: BusinessMemberRole;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Igual que con `businesses` más abajo: se fuerza el tipo del resultado
  // porque `membership` se reutiliza en la siguiente consulta, y la
  // inferencia automática de este `select` colapsaba a `never` en el
  // build de Vercel.
  const { data: membership } = (await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()) as unknown as { data: MembershipRow | null };

  if (!membership) {
    redirect("/registro");
  }

  // Se usa una lista explícita de columnas en vez de select("*") (ver nota
  // más arriba); esta lista debe reflejar todas las columnas de
  // `businesses` en supabase/migrations/0001_schema.sql.
  const { data: business } = (await supabase
    .from("businesses")
    .select(
      "id, owner_id, name, slug, description, logo_url, phone, address, city, business_type, timezone, subscription_status, trial_ends_at, onboarding_completed_at, created_at, updated_at",
    )
    .eq("id", membership.business_id)
    .single()) as unknown as { data: BusinessRow | null };

  if (!business) {
    redirect("/registro");
  }

  return { supabase, user, business, role: membership.role };
}
