import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Cliente con la service_role key: salta RLS por completo.
 *
 * SOLO se importa desde código que corre en el servidor (Route Handlers,
 * Server Actions, cron/Edge Functions) y solo para operaciones que
 * necesitan privilegios de administrador (p. ej. tareas del panel admin
 * interno, webhooks). Nunca se expone al cliente ni se usa para servir
 * datos de un negocio a otro.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para crear el cliente admin de Supabase.",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
