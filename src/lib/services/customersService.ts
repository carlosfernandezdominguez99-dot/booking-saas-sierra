import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type TypedClient = Awaited<ReturnType<typeof createClient>>;
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

const CUSTOMER_COLUMNS = "id, business_id, name, phone, email, notes, created_at, updated_at";

/**
 * Lista los clientes del negocio autenticado. Los clientes se crean solo
 * a través de `create_public_booking` (al reservar) — aquí no hay alta
 * manual todavía.
 */
export async function listCustomers(client: TypedClient, businessId: string): Promise<CustomerRow[]> {
  const { data, error } = (await client
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("business_id", businessId)
    .order("name", { ascending: true })) as unknown as {
    data: CustomerRow[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return data ?? [];
}
