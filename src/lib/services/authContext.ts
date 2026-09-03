import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensureBusinessForUser } from "@/lib/services/businessService";
import type { Database, BusinessMemberRole } from "@/types/database.types";

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];

/**
 * Resuelve el usuario autenticado y su negocio principal para las páginas
 * del panel privado. Si no hay sesión, redirige a /login.
 *
 * Si hay sesión pero el negocio todavía no existe, `ensureBusinessForUser`
 * intenta crearlo a partir de los metadatos guardados en el registro (caso
 * de que la confirmación de email haya retrasado esa creación). Si tampoco
 * hay metadatos suficientes (por ejemplo, un usuario creado a mano en
 * Supabase), redirige a /registro.
 *
 * Se llama desde Server Components / layouts del dashboard: todo lo que
 * dependa del negocio actual pasa por aquí, nunca se confía en datos
 * enviados por el cliente para decidir de qué negocio se sirven datos.
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

  const context = await ensureBusinessForUser(supabase, user);

  if (!context) {
    redirect("/registro");
  }

  return {
    supabase,
    user,
    business: context.business,
    role: context.role as BusinessMemberRole,
  };
}
