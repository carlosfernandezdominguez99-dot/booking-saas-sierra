import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];
type EmployeeUpdate = Database["public"]["Tables"]["employees"]["Update"];

const EMPLOYEE_COLUMNS = "id, business_id, name, photo_url, active, created_at, updated_at";

/** Lista los empleados de un negocio, activos primero y luego por nombre. */
export async function listEmployees(client: TypedClient, businessId: string): Promise<EmployeeRow[]> {
  const { data, error } = (await client
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("business_id", businessId)
    .order("active", { ascending: false })
    .order("name", { ascending: true })) as unknown as {
    data: EmployeeRow[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return data ?? [];
}

export async function createEmployee(client: TypedClient, businessId: string, name: string): Promise<EmployeeRow> {
  const insertPayload: EmployeeInsert = { business_id: businessId, name: name.trim() };

  const { data, error } = (await (client.from("employees") as any)
    .insert(insertPayload)
    .select(EMPLOYEE_COLUMNS)
    .single()) as unknown as { data: EmployeeRow | null; error: { message: string } | null };

  if (error) throw error;
  if (!data) throw new Error("No se pudo crear el empleado.");
  return data;
}

export async function updateEmployee(
  client: TypedClient,
  employeeId: string,
  input: { name?: string; active?: boolean },
): Promise<void> {
  const updatePayload: EmployeeUpdate = {};
  if (input.name !== undefined) updatePayload.name = input.name.trim();
  if (input.active !== undefined) updatePayload.active = input.active;

  const { error } = await (client.from("employees") as any).update(updatePayload).eq("id", employeeId);
  if (error) throw error;
}

/**
 * Borra un empleado, pero solo si no tiene ninguna reserva asociada (ni
 * siquiera pasada): `bookings.employee_id` es `on delete set null`, así
 * que técnicamente no fallaría, pero dejaría huérfanas — sin saber quién
 * atendió — todas sus citas históricas. Mejor pedir que se desactive
 * (`updateEmployee(..., { active: false })`) en ese caso, igual que ya se
 * hace con los servicios cuando se dejan de ofrecer.
 */
export async function deleteEmployee(client: TypedClient, employeeId: string): Promise<void> {
  const { count, error: countError } = (await (client.from("bookings") as any)
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)) as unknown as { count: number | null; error: { message: string } | null };
  if (countError) throw countError;

  if (count && count > 0) {
    throw new Error("HAS_BOOKINGS");
  }

  const { error } = await (client.from("employees") as any).delete().eq("id", employeeId);
  if (error) throw error;
}

/** IDs de los servicios que realiza un empleado. */
export async function listEmployeeServiceIds(client: TypedClient, employeeId: string): Promise<string[]> {
  const { data, error } = (await (client.from("employee_services") as any)
    .select("service_id")
    .eq("employee_id", employeeId)) as unknown as {
    data: { service_id: string }[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;
  return (data ?? []).map((r) => r.service_id);
}

/**
 * Sustituye la lista completa de servicios que hace un empleado — mismo
 * patrón que `replaceBusinessHours` (borra todo lo existente y vuelve a
 * insertar), más simple que calcular un diff.
 */
export async function setEmployeeServices(client: TypedClient, employeeId: string, serviceIds: string[]): Promise<void> {
  const { error: deleteError } = await (client.from("employee_services") as any)
    .delete()
    .eq("employee_id", employeeId);
  if (deleteError) throw deleteError;

  if (serviceIds.length === 0) return;

  const insertPayload = serviceIds.map((serviceId) => ({ employee_id: employeeId, service_id: serviceId }));
  const { error } = await (client.from("employee_services") as any).insert(insertPayload);
  if (error) throw error;
}

/**
 * Todas las asignaciones empleado↔servicio del negocio de una vez, para
 * pintar la matriz en `/dashboard/empleados` sin una consulta por
 * empleado. Devuelve un mapa `employeeId -> Set<serviceId>`.
 */
export async function listEmployeeServiceMap(
  client: TypedClient,
  businessId: string,
): Promise<Map<string, Set<string>>> {
  const { data, error } = (await (client.from("employee_services") as any)
    .select("employee_id, service_id, employees!inner(business_id)")
    .eq("employees.business_id", businessId)) as unknown as {
    data: { employee_id: string; service_id: string }[] | null;
    error: { message: string } | null;
  };

  // Si el select anidado fallara por lo que sea (tipos escritos a mano,
  // sin metadatos de relaciones — ver la nota larga en
  // `database.types.ts`), se recurre a dos consultas planas + merge en
  // memoria, el patrón habitual en el resto del proyecto.
  if (error) {
    const employees = await listEmployees(client, businessId);
    const employeeIds = employees.map((e) => e.id);
    if (employeeIds.length === 0) return new Map();

    const { data: rows, error: rowsError } = (await (client.from("employee_services") as any)
      .select("employee_id, service_id")
      .in("employee_id", employeeIds)) as unknown as {
      data: { employee_id: string; service_id: string }[] | null;
      error: { message: string } | null;
    };
    if (rowsError) throw rowsError;

    const map = new Map<string, Set<string>>();
    for (const row of rows ?? []) {
      const set = map.get(row.employee_id) ?? new Set<string>();
      set.add(row.service_id);
      map.set(row.employee_id, set);
    }
    return map;
  }

  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const set = map.get(row.employee_id) ?? new Set<string>();
    set.add(row.service_id);
    map.set(row.employee_id, set);
  }
  return map;
}
