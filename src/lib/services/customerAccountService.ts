import type { createClient } from "@/lib/supabase/server";
import type { BookingStatus, WaitlistStatus } from "@/types/database.types";
import type { PublicBookingResult } from "@/lib/services/bookingService";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Capa de servicio de la cuenta de cliente (Fase 7.3): registro, login,
 * logout y el panel agregado. Todo pasa por el cliente `anon` — la propia
 * base de datos valida la contraseña (hash con `pgcrypto`) y el token de
 * sesión en cada llamada, nunca se confía en nada que venga del navegador
 * salvo ese token.
 */

export interface SignupParams {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export interface AuthResult {
  sessionToken?: string;
  error?: string;
  /** Solo relevante en login: true cuando el email no corresponde a ninguna cuenta. */
  accountNotFound?: boolean;
}

export async function customerSignup(client: TypedClient, params: SignupParams): Promise<AuthResult> {
  const { data, error } = (await (client.rpc as any)("customer_signup", {
    p_email: params.email,
    p_password: params.password,
    p_name: params.name,
    p_phone: params.phone,
  })) as unknown as {
    data: { session_token: string | null; error: string | null }[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row) return { error: "No se pudo crear la cuenta." };
  if (row.error) return { error: row.error };
  return { sessionToken: row.session_token ?? undefined };
}

export async function customerLogin(
  client: TypedClient,
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = (await (client.rpc as any)("customer_login", {
    p_email: email,
    p_password: password,
  })) as unknown as {
    data: { session_token: string | null; error: string | null; account_not_found: boolean | null }[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row) return { error: "No se pudo iniciar sesión." };
  if (row.error) return { error: row.error, accountNotFound: row.account_not_found ?? undefined };
  return { sessionToken: row.session_token ?? undefined };
}

export async function customerLogout(client: TypedClient, token: string): Promise<void> {
  const { error } = await (client.rpc as any)("customer_logout", { p_token: token });
  if (error) throw error;
}

export interface AccountBooking {
  id: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
}

export interface AccountWaitlistEntry {
  id: string;
  serviceName: string;
  preferredDate: string;
  status: WaitlistStatus;
  offeredStartTime: string | null;
  offeredEndTime: string | null;
  createdAt: string;
}

export interface AccountBusinessData {
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessTimezone: string;
  upcomingBookings: AccountBooking[];
  pastBookings: AccountBooking[];
  waitlistEntries: AccountWaitlistEntry[];
}

export interface CustomerAccountData {
  accountName: string;
  accountEmail: string;
  businesses: AccountBusinessData[];
}

function mapBookingRow(row: any): AccountBooking {
  return {
    id: row.id,
    serviceName: row.service_name,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
  };
}

function mapWaitlistRow(row: any): AccountWaitlistEntry {
  return {
    id: row.id,
    serviceName: row.service_name,
    preferredDate: row.preferred_date,
    status: row.status,
    offeredStartTime: row.offered_start_time,
    offeredEndTime: row.offered_end_time,
    createdAt: row.created_at,
  };
}

/** Devuelve `null` si el token no es válido (caducado, borrado, o inventado). */
export async function getCustomerAccountData(
  client: TypedClient,
  token: string,
): Promise<CustomerAccountData | null> {
  const { data, error } = (await (client.rpc as any)("get_customer_account_data", {
    p_token: token,
  })) as unknown as {
    data:
      | {
          valid: boolean;
          account_name: string | null;
          account_email: string | null;
          businesses: any;
        }[]
      | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row || !row.valid) return null;

  const businesses: AccountBusinessData[] = (row.businesses ?? []).map((b: any) => ({
    businessId: b.business_id,
    businessName: b.business_name,
    businessSlug: b.business_slug,
    businessTimezone: b.business_timezone,
    upcomingBookings: (b.upcoming_bookings ?? []).map(mapBookingRow),
    pastBookings: (b.past_bookings ?? []).map(mapBookingRow),
    waitlistEntries: (b.waitlist_entries ?? []).map(mapWaitlistRow),
  }));

  return {
    accountName: row.account_name ?? "",
    accountEmail: row.account_email ?? "",
    businesses,
  };
}

export async function leaveWaitlistByAccount(client: TypedClient, token: string, entryId: string): Promise<boolean> {
  const { data, error } = (await (client.rpc as any)("leave_waitlist_by_account", {
    p_token: token,
    p_entry_id: entryId,
  })) as unknown as { data: boolean | null; error: { message: string } | null };
  if (error) throw error;
  return Boolean(data);
}

export interface CustomerAccountProfile {
  name: string;
  email: string;
  phone: string;
}

/**
 * Perfil mínimo (nombre/email/teléfono) de la cuenta dueña de este token —
 * para autorellenar el formulario de reserva/lista de espera sin tener que
 * volver a pedirlos (Fase 7.4). Devuelve `null` si el token no es válido
 * (caducado, borrado, o no hay sesión), igual que `getCustomerAccountData`.
 */
export async function getCustomerAccountProfile(
  client: TypedClient,
  token: string,
): Promise<CustomerAccountProfile | null> {
  const { data, error } = (await (client.rpc as any)("get_customer_account_profile", {
    p_token: token,
  })) as unknown as {
    data: { valid: boolean; name: string | null; email: string | null; phone: string | null }[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row || !row.valid) return null;

  return {
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
  };
}

export interface CreateAccountBookingParams {
  businessId: string;
  serviceId: string;
  /** ISO timestamptz del hueco elegido (debe coincidir con un `slotStart` de `getAvailableSlots`). */
  startTime: string;
  comment?: string | null;
}

/**
 * Envuelve `create_account_booking` (0014_require_account_booking.sql):
 * resuelve la cuenta a partir del token de sesión y reserva con su nombre,
 * teléfono y email guardados — ya no hace falta (ni se puede) mandar esos
 * datos desde el formulario. Lanza un `Error` con el mensaje de negocio tal
 * cual (p. ej. "Ese horario ya no está disponible", "Tu sesión ha
 * caducado."), igual que `createPublicBooking`.
 */
export async function createAccountBooking(
  client: TypedClient,
  token: string,
  params: CreateAccountBookingParams,
): Promise<PublicBookingResult> {
  const { data, error } = (await (client.rpc as any)("create_account_booking", {
    p_token: token,
    p_business_id: params.businessId,
    p_service_id: params.serviceId,
    p_start_time: params.startTime,
    p_comment: params.comment ?? null,
  })) as unknown as {
    data:
      | {
          booking_id: string;
          business_name: string;
          service_name: string;
          price_cents: number;
          start_time: string;
          end_time: string;
          status: string;
        }[]
      | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);

  const result = data?.[0];
  if (!result) throw new Error("No se pudo crear la reserva.");

  return {
    bookingId: result.booking_id,
    businessName: result.business_name,
    serviceName: result.service_name,
    priceCents: result.price_cents,
    startTime: result.start_time,
    endTime: result.end_time,
    status: result.status,
  };
}

export interface JoinWaitlistByAccountParams {
  businessId: string;
  serviceId: string;
  preferredDate: string;
}

export interface JoinWaitlistByAccountResult {
  entryId?: string;
  error?: string;
}

/** Envuelve `join_waitlist_by_account` — mismo patrón que `createAccountBooking`. */
export async function joinWaitlistByAccount(
  client: TypedClient,
  token: string,
  params: JoinWaitlistByAccountParams,
): Promise<JoinWaitlistByAccountResult> {
  const { data, error } = (await (client.rpc as any)("join_waitlist_by_account", {
    p_token: token,
    p_business_id: params.businessId,
    p_service_id: params.serviceId,
    p_preferred_date: params.preferredDate,
  })) as unknown as {
    data: { entry_id: string | null; error: string | null }[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row) return { error: "No se pudo apuntar a la lista de espera." };
  if (row.error) return { error: row.error };
  return { entryId: row.entry_id ?? undefined };
}
