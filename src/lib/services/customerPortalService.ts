import type { createClient } from "@/lib/supabase/server";
import type { BookingStatus, WaitlistStatus } from "@/types/database.types";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Capa de servicio del portal del cliente (acceso sin contraseña por
 * enlace de un solo negocio, ver `0010_customer_portal.sql`). Todas las
 * funciones reciben el cliente `anon` — la propia base de datos es quien
 * valida el token en cada llamada (nunca se confía en nada que venga del
 * navegador salvo ese token).
 */

export interface RequestAccessResult {
  customerId: string;
  customerName: string;
  customerEmail: string;
  token: string;
}

/**
 * Pide un enlace de acceso para alguien que YA es cliente del negocio.
 * Devuelve `null` tanto si no se encontró a nadie como si se encontró
 * pero no tiene email guardado — a propósito: quien llama a esto siempre
 * debe responder el mismo mensaje genérico, para no filtrar si un
 * contacto está o no registrado.
 */
export async function requestCustomerAccess(
  client: TypedClient,
  businessId: string,
  contact: string,
): Promise<RequestAccessResult | null> {
  const { data, error } = (await (client.rpc as any)("request_customer_access", {
    p_business_id: businessId,
    p_contact: contact,
  })) as unknown as {
    data: { customer_id: string; customer_name: string; customer_email: string; token: string }[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row) return null;

  return { customerId: row.customer_id, customerName: row.customer_name, customerEmail: row.customer_email, token: row.token };
}

export interface PortalBooking {
  id: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
}

export interface PortalWaitlistEntry {
  id: string;
  serviceName: string;
  preferredDate: string;
  status: WaitlistStatus;
  offeredStartTime: string | null;
  offeredEndTime: string | null;
  createdAt: string;
}

export interface CustomerPortalData {
  businessName: string;
  businessSlug: string;
  businessTimezone: string;
  customerName: string;
  upcomingBookings: PortalBooking[];
  pastBookings: PortalBooking[];
  waitlistEntries: PortalWaitlistEntry[];
}

function mapBookingRow(row: any): PortalBooking {
  return {
    id: row.id,
    serviceName: row.service_name,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
  };
}

function mapWaitlistRow(row: any): PortalWaitlistEntry {
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
export async function getCustomerPortalData(client: TypedClient, token: string): Promise<CustomerPortalData | null> {
  const { data, error } = (await (client.rpc as any)("get_customer_portal_data", {
    p_token: token,
  })) as unknown as {
    data:
      | {
          valid: boolean;
          business_name: string | null;
          business_slug: string | null;
          business_timezone: string | null;
          customer_name: string | null;
          upcoming_bookings: any;
          past_bookings: any;
          waitlist_entries: any;
        }[]
      | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row || !row.valid) return null;

  return {
    businessName: row.business_name ?? "",
    businessSlug: row.business_slug ?? "",
    businessTimezone: row.business_timezone ?? "Europe/Madrid",
    customerName: row.customer_name ?? "",
    upcomingBookings: (row.upcoming_bookings ?? []).map(mapBookingRow),
    pastBookings: (row.past_bookings ?? []).map(mapBookingRow),
    waitlistEntries: (row.waitlist_entries ?? []).map(mapWaitlistRow),
  };
}

export interface JoinWaitlistResult {
  entryId?: string;
  error?: string;
}

/** Para un cliente con sesión de portal ya iniciada. */
export async function joinWaitlistSelf(
  client: TypedClient,
  token: string,
  serviceId: string,
  preferredDate: string,
): Promise<JoinWaitlistResult> {
  const { data, error } = (await (client.rpc as any)("join_waitlist_self", {
    p_token: token,
    p_service_id: serviceId,
    p_preferred_date: preferredDate,
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

export async function leaveWaitlistSelf(client: TypedClient, token: string, entryId: string): Promise<boolean> {
  const { data, error } = (await (client.rpc as any)("leave_waitlist_self", {
    p_token: token,
    p_entry_id: entryId,
  })) as unknown as { data: boolean | null; error: { message: string } | null };
  if (error) throw error;
  return Boolean(data);
}

export interface JoinWaitlistPublicParams {
  businessId: string;
  serviceId: string;
  preferredDate: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

export interface JoinWaitlistPublicResult {
  entryId?: string;
  customerEmail?: string;
  accessToken?: string;
  error?: string;
}

/** Para alguien sin sesión de portal todavía (primera vez que se apunta a una lista de espera). */
export async function joinWaitlistPublic(
  client: TypedClient,
  params: JoinWaitlistPublicParams,
): Promise<JoinWaitlistPublicResult> {
  const { data, error } = (await (client.rpc as any)("join_waitlist_public", {
    p_business_id: params.businessId,
    p_service_id: params.serviceId,
    p_preferred_date: params.preferredDate,
    p_customer_name: params.customerName,
    p_customer_phone: params.customerPhone,
    p_customer_email: params.customerEmail,
  })) as unknown as {
    data: { entry_id: string | null; customer_email: string | null; access_token: string | null; error: string | null }[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row) return { error: "No se pudo apuntar a la lista de espera." };
  if (row.error) return { error: row.error };
  return {
    entryId: row.entry_id ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    accessToken: row.access_token ?? undefined,
  };
}
