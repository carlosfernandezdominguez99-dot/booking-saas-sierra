"use server";

import { cookies } from "next/headers";
import { ACTIVE_EMPLOYEE_COOKIE } from "@/lib/services/employeeScope";

/**
 * Guarda qué círculo del selector de arriba (Fase 10) queda activo:
 * "all" | "manager" | el id de un empleado — ver `employeeScope.ts`. El
 * propio componente cliente llama a `router.refresh()` después, así que
 * aquí no hace falta `revalidatePath` (no cambia ningún dato, solo la
 * cookie que decide qué parte de esos datos se enseña).
 */
export async function setActiveEmployeeScopeAction(value: string): Promise<void> {
  const store = await cookies();
  if (value === "all") {
    store.delete(ACTIVE_EMPLOYEE_COOKIE);
    return;
  }
  store.set(ACTIVE_EMPLOYEE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
