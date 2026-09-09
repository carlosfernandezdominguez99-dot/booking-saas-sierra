import type { createClient } from "@/lib/supabase/server";
import type { Database, EmployeeInviteStatus } from "@/types/database.types";

type TypedClient = Awaited<ReturnType<typeof createClient>>;
type InviteRow = Database["public"]["Tables"]["employee_invites"]["Row"];

const INVITE_COLUMNS = "id, business_id, employee_id, email, token, status, expires_at, created_at, accepted_at";

export interface EmployeeInvite {
  id: string;
  employeeId: string;
  email: string;
  token: string;
  status: EmployeeInviteStatus;
  expiresAt: string;
  createdAt: string;
}

function mapInvite(row: InviteRow): EmployeeInvite {
  return {
    id: row.id,
    employeeId: row.employee_id,
    email: row.email,
    token: row.token,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * Invitaciones pendientes (o ya usadas/revocadas) del negocio, para poder
 * enseñar en `/dashboard/empleados` si un empleado sin cuenta todavía
 * tiene una invitación en camino, caducada, o ninguna.
 */
export async function listEmployeeInvites(client: TypedClient, businessId: string): Promise<EmployeeInvite[]> {
  const { data, error } = (await (client.from("employee_invites") as any)
    .select(INVITE_COLUMNS)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })) as unknown as {
    data: InviteRow[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;
  return (data ?? []).map(mapInvite);
}

/**
 * Crea (o renueva, si ya había una pendiente) la invitación de un
 * empleado a un email concreto. Revoca cualquier invitación pendiente
 * anterior de ese mismo empleado antes de crear la nueva, para que nunca
 * haya dos enlaces "Aceptar" activos a la vez para la misma persona.
 */
export async function inviteEmployee(
  client: TypedClient,
  businessId: string,
  employeeId: string,
  email: string,
): Promise<EmployeeInvite> {
  const { error: revokeError } = await (client.from("employee_invites") as any)
    .update({ status: "revoked" })
    .eq("employee_id", employeeId)
    .eq("status", "pending");
  if (revokeError) throw revokeError;

  const { data, error } = (await (client.from("employee_invites") as any)
    .insert({ business_id: businessId, employee_id: employeeId, email: email.trim().toLowerCase() })
    .select(INVITE_COLUMNS)
    .single()) as unknown as { data: InviteRow | null; error: { message: string } | null };

  if (error) throw error;
  if (!data) throw new Error("No se pudo crear la invitación.");
  return mapInvite(data);
}

export async function revokeEmployeeInvite(client: TypedClient, inviteId: string): Promise<void> {
  const { error } = await (client.from("employee_invites") as any)
    .update({ status: "revoked" })
    .eq("id", inviteId);
  if (error) throw error;
}

export interface EmployeeInviteDetails {
  valid: boolean;
  businessName: string | null;
  employeeName: string | null;
  email: string | null;
}

/** Envoltorio de `get_employee_invite` — lectura pública por token, sin sesión. */
export async function getEmployeeInvite(client: TypedClient, token: string): Promise<EmployeeInviteDetails> {
  const { data, error } = (await (client.rpc as any)("get_employee_invite", { p_token: token })) as unknown as {
    data: { valid: boolean; business_name: string | null; employee_name: string | null; email: string | null }[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row) return { valid: false, businessName: null, employeeName: null, email: null };
  return { valid: row.valid, businessName: row.business_name, employeeName: row.employee_name, email: row.email };
}

export interface AcceptEmployeeInviteResult {
  ok: boolean;
  error?: string;
  businessSlug?: string;
}

/** Envoltorio de `accept_employee_invite` — hace falta sesión ya iniciada. */
export async function acceptEmployeeInvite(client: TypedClient, token: string): Promise<AcceptEmployeeInviteResult> {
  const { data, error } = (await (client.rpc as any)("accept_employee_invite", { p_token: token })) as unknown as {
    data: { ok: boolean; error: string | null; business_slug: string | null }[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row) return { ok: false, error: "No se pudo aceptar la invitación." };
  if (!row.ok) return { ok: false, error: row.error ?? "No se pudo aceptar la invitación." };
  return { ok: true, businessSlug: row.business_slug ?? undefined };
}
