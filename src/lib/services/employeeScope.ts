import "server-only";
import { cookies } from "next/headers";
import { listEmployees } from "@/lib/services/employeesService";
import type { createClient } from "@/lib/supabase/server";
import type { Database, BusinessMemberRole } from "@/types/database.types";

type TypedClient = Awaited<ReturnType<typeof createClient>>;
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];

/**
 * Cookie que recuerda qué círculo tiene seleccionado el propietario arriba
 * del panel (Fase 10) — "all" | "manager" | el id de un empleado. Vive en
 * una cookie (no en la URL) para que aplique en todas las páginas del
 * panel sin tener que llevarlo a mano en cada enlace.
 */
export const ACTIVE_EMPLOYEE_COOKIE = "zoria_active_employee";

export type EmployeeScope =
  | { kind: "all" }
  | { kind: "manager" }
  | { kind: "employee"; employeeId: string; employeeName: string; photoUrl: string | null };

export interface DashboardScope {
  scope: EmployeeScope;
  /** Solo para pintar el selector — vacío para un empleado con acceso propio (no lo ve). */
  employees: EmployeeRow[];
  /**
   * Lo que hay que pasar a `listBookingsWithDetails`/`listBusinessHours`/etc:
   * `undefined` = sin filtrar (todos), `null` = solo el gerente
   * (`employee_id is null`), un id = solo ese empleado.
   */
  employeeFilter: string | null | undefined;
}

/**
 * Resuelve qué "cara" del panel toca mostrar (Fase 10: "si tengo más de un
 * empleado cada panel debe ser independiente"). Para el propietario, según
 * el círculo seleccionado (cookie); para un empleado con su propio acceso,
 * siempre lo suyo — nunca ve el selector, así que ni se molesta en leer la
 * cookie ni en listar al resto del equipo.
 */
export async function getDashboardScope(
  client: TypedClient,
  business: { id: string },
  role: BusinessMemberRole,
  ownEmployeeId: string | null,
  /** Solo para el empleado que ES quien ha entrado (`role === "staff"`) — el nombre ya lo tiene `requireBusinessContext`, así aquí no hace falta otra consulta. */
  ownEmployeeName?: string | null,
): Promise<DashboardScope> {
  if (role !== "owner") {
    return {
      scope: ownEmployeeId
        ? { kind: "employee", employeeId: ownEmployeeId, employeeName: ownEmployeeName ?? "", photoUrl: null }
        : { kind: "manager" },
      employees: [],
      employeeFilter: ownEmployeeId ?? null,
    };
  }

  const employees = await listEmployees(client, business.id);
  if (employees.length === 0) {
    return { scope: { kind: "all" }, employees, employeeFilter: undefined };
  }

  const store = await cookies();
  const raw = store.get(ACTIVE_EMPLOYEE_COOKIE)?.value;

  if (raw === "manager") {
    return { scope: { kind: "manager" }, employees, employeeFilter: null };
  }
  if (raw) {
    const match = employees.find((e) => e.id === raw);
    if (match) {
      return {
        scope: { kind: "employee", employeeId: match.id, employeeName: match.name, photoUrl: match.photo_url },
        employees,
        employeeFilter: match.id,
      };
    }
  }
  return { scope: { kind: "all" }, employees, employeeFilter: undefined };
}
