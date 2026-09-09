"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import {
  createEmployee,
  deleteEmployee,
  setEmployeeServices,
  updateEmployee,
} from "@/lib/services/employeesService";
import { inviteEmployee, revokeEmployeeInvite } from "@/lib/services/employeeInviteService";
import { uploadEmployeePhoto } from "@/lib/services/logoService";
import { sendEmployeeInviteEmail } from "@/lib/email/emailService";
import { employeeNameSchema, inviteEmployeeSchema } from "@/lib/validations/business";
import type { Database } from "@/types/database.types";

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
export type EmployeeActionResult = { data?: EmployeeRow; error?: string };
export type SimpleActionResult = { error?: string };
export type PhotoActionResult = { url?: string; error?: string };

// Todas estas acciones son solo del propietario — RLS ya lo garantiza a
// nivel de base de datos (ver `0018_employees_feature.sql`), pero se
// comprueba aquí también para poder dar un mensaje claro en vez de un
// error genérico de permisos.
async function requireOwnerContext() {
  const ctx = await requireBusinessContext();
  if (ctx.role !== "owner") {
    throw new Error("NOT_OWNER");
  }
  return ctx;
}

export async function createEmployeeAction(name: string): Promise<EmployeeActionResult> {
  const parsed = employeeNameSchema.safeParse(name);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Introduce un nombre." };
  }

  try {
    const { supabase, business } = await requireOwnerContext();
    const data = await createEmployee(supabase, business.id, parsed.data);
    revalidatePath("/dashboard/empleados");
    return { data };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_OWNER") {
      return { error: "Solo el propietario del negocio puede gestionar empleados." };
    }
    return { error: "No se pudo crear el empleado. Inténtalo de nuevo." };
  }
}

export async function updateEmployeeAction(
  employeeId: string,
  input: { name?: string; active?: boolean },
): Promise<SimpleActionResult> {
  if (input.name !== undefined) {
    const parsed = employeeNameSchema.safeParse(input.name);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Introduce un nombre." };
    input = { ...input, name: parsed.data };
  }

  try {
    const { supabase } = await requireOwnerContext();
    await updateEmployee(supabase, employeeId, input);
    revalidatePath("/dashboard/empleados");
    return {};
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_OWNER") {
      return { error: "Solo el propietario del negocio puede gestionar empleados." };
    }
    return { error: "No se pudo actualizar el empleado." };
  }
}

export async function deleteEmployeeAction(employeeId: string): Promise<SimpleActionResult> {
  try {
    const { supabase } = await requireOwnerContext();
    await deleteEmployee(supabase, employeeId);
    revalidatePath("/dashboard/empleados");
    return {};
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_OWNER") {
      return { error: "Solo el propietario del negocio puede gestionar empleados." };
    }
    if (err instanceof Error && err.message === "HAS_BOOKINGS") {
      return { error: "Este empleado tiene citas (pasadas o próximas) asociadas — desactívalo en vez de borrarlo." };
    }
    return { error: "No se pudo eliminar el empleado." };
  }
}

export async function setEmployeeServicesAction(
  employeeId: string,
  serviceIds: string[],
): Promise<SimpleActionResult> {
  try {
    const { supabase } = await requireOwnerContext();
    await setEmployeeServices(supabase, employeeId, serviceIds);
    revalidatePath("/dashboard/empleados");
    return {};
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_OWNER") {
      return { error: "Solo el propietario del negocio puede gestionar empleados." };
    }
    return { error: "No se pudieron guardar los servicios de este empleado." };
  }
}

export async function inviteEmployeeAction(employeeId: string, email: string): Promise<SimpleActionResult> {
  const parsed = inviteEmployeeSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Introduce un email válido." };
  }

  try {
    const { supabase, business } = await requireOwnerContext();

    // Se busca el nombre del empleado para el email de invitación — no
    // hace falta pasarlo desde el cliente, ya está en la base de datos.
    const { data: employee } = await (supabase.from("employees") as any)
      .select("name")
      .eq("id", employeeId)
      .maybeSingle();

    const invite = await inviteEmployee(supabase, business.id, employeeId, parsed.data.email);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    try {
      await sendEmployeeInviteEmail({
        toEmail: invite.email,
        businessName: business.name,
        employeeName: employee?.name ?? "",
        acceptUrl: `${siteUrl}/invitacion/${invite.token}`,
      });
    } catch {
      // No-op: best-effort — la invitación ya quedó creada; se puede
      // reenviar volviendo a invitar (renueva el token) si el email no
      // llegó.
    }

    revalidatePath("/dashboard/empleados");
    return {};
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_OWNER") {
      return { error: "Solo el propietario del negocio puede invitar empleados." };
    }
    return { error: "No se pudo enviar la invitación. Inténtalo de nuevo." };
  }
}

/**
 * Sube la foto de un empleado — se usa tanto desde `/dashboard/empleados`
 * como desde Configuración cuando el panel está "puesto" en ese empleado
 * (Fase 10), por eso comprueba pertenencia igual que el resto de acciones
 * de aquí en vez de asumir que quien llama ya lo verificó.
 */
export async function uploadEmployeePhotoAction(employeeId: string, formData: FormData): Promise<PhotoActionResult> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona una imagen." };
  }

  try {
    const { supabase, business } = await requireOwnerContext();

    const { data: employee } = await (supabase.from("employees") as any)
      .select("id")
      .eq("id", employeeId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!employee) return { error: "No se encontró ese empleado." };

    const url = await uploadEmployeePhoto(supabase, business.id, employeeId, file);
    revalidatePath("/dashboard/empleados");
    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard", "layout");
    return { url };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_OWNER") {
      return { error: "Solo el propietario del negocio puede gestionar empleados." };
    }
    return { error: err instanceof Error ? err.message : "No se pudo subir la foto." };
  }
}

export async function revokeInviteAction(inviteId: string): Promise<SimpleActionResult> {
  try {
    const { supabase } = await requireOwnerContext();
    await revokeEmployeeInvite(supabase, inviteId);
    revalidatePath("/dashboard/empleados");
    return {};
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_OWNER") {
      return { error: "Solo el propietario del negocio puede gestionar empleados." };
    }
    return { error: "No se pudo revocar la invitación." };
  }
}
