import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
 */
export async function requireBusinessContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/registro");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", membership.business_id)
    .single();

  if (!business) {
    redirect("/registro");
  }

  return { supabase, user, business, role: membership.role };
}
