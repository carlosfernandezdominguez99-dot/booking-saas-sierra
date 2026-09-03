import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type { ServiceInput } from "@/lib/validations/business";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];

const SERVICE_COLUMNS =
  "id, business_id, name, description, price_cents, duration_minutes, active, position, created_at, updated_at";

/**
 * Lista los servicios de un negocio, ordenados por `position` (orden
 * manual, para cuando se añada reordenar) y luego por fecha de creación.
 */
export async function listServices(client: TypedClient, businessId: string): Promise<ServiceRow[]> {
  const { data, error } = (await client
    .from("services")
    .select(SERVICE_COLUMNS)
    .eq("business_id", businessId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })) as unknown as {
    data: ServiceRow[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return data ?? [];
}

/**
 * Crea un servicio nuevo. El precio llega en euros (con decimales) desde
 * el formulario y se convierte a céntimos aquí, para no perder precisión
 * con floats y porque así se guarda en la base de datos.
 */
export async function createService(
  client: TypedClient,
  businessId: string,
  input: ServiceInput,
): Promise<ServiceRow> {
  const insertPayload: ServiceInsert = {
    business_id: businessId,
    name: input.name,
    description: input.description ? input.description : null,
    price_cents: Math.round(input.priceEuros * 100),
    duration_minutes: input.durationMinutes,
  };

  // `as any` en el acceso a la tabla: ver la nota larga en
  // `database.types.ts` sobre por qué el genérico de `.insert()` no es de
  // fiar en el build de producción.
  const { data, error } = (await (client.from("services") as any)
    .insert(insertPayload)
    .select(SERVICE_COLUMNS)
    .single()) as unknown as { data: ServiceRow | null; error: { message: string } | null };

  if (error) throw error;
  if (!data) throw new Error("No se pudo crear el servicio.");
  return data;
}

/**
 * Actualiza un servicio existente. Solo se envían a la base de datos los
 * campos presentes en `input`, para poder usarse tanto en la edición
 * completa del formulario como en acciones puntuales (activar/desactivar).
 */
export async function updateService(
  client: TypedClient,
  serviceId: string,
  input: Partial<Pick<ServiceInput, "name" | "description" | "priceEuros" | "durationMinutes">> & {
    active?: boolean;
  },
): Promise<void> {
  const updatePayload: ServiceUpdate = {};

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.description !== undefined) updatePayload.description = input.description ? input.description : null;
  if (input.priceEuros !== undefined) updatePayload.price_cents = Math.round(input.priceEuros * 100);
  if (input.durationMinutes !== undefined) updatePayload.duration_minutes = input.durationMinutes;
  if (input.active !== undefined) updatePayload.active = input.active;

  const { error } = await (client.from("services") as any).update(updatePayload).eq("id", serviceId);
  if (error) throw error;
}

export async function deleteService(client: TypedClient, serviceId: string): Promise<void> {
  const { error } = await (client.from("services") as any).delete().eq("id", serviceId);
  if (error) throw error;
}
