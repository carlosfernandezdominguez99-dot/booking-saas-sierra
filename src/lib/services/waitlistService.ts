import type { createClient } from "@/lib/supabase/server";
import type { Database, WaitlistStatus } from "@/types/database.types";

type TypedClient = Awaited<ReturnType<typeof createClient>>;
type WaitlistRow = Database["public"]["Tables"]["waitlist_entries"]["Row"];

const WAITLIST_COLUMNS =
  "id, business_id, customer_id, service_id, preferred_date, status, offered_start_time, offered_end_time, offered_at, respond_token, created_at, updated_at";

export interface AddToWaitlistParams {
  businessId: string;
  serviceId: string;
  /** Fecha (YYYY-MM-DD) para la que la persona quiere hueco. */
  preferredDate: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
}

/**
 * Añade a alguien a la lista de espera de un día concreto. Todavía no hay
 * alta manual de clientes en el panel (ver `customersService.ts`), así que
 * esto hace su propio upsert por `(business_id, phone)` — igual que
 * `create_public_booking`, pero desde TypeScript porque aquí quien llama
 * ya es un miembro autenticado del negocio (RLS se encarga del resto).
 */
export async function addToWaitlist(
  client: TypedClient,
  params: AddToWaitlistParams,
): Promise<WaitlistEntryWithDetails> {
  const name = params.customerName.trim();
  const phone = params.customerPhone.trim();
  const email = params.customerEmail?.trim() || null;

  const { data: existing, error: findError } = (await (client.from("customers") as any)
    .select("id")
    .eq("business_id", params.businessId)
    .eq("phone", phone)
    .maybeSingle()) as unknown as { data: { id: string } | null; error: { message: string } | null };
  if (findError) throw findError;

  let customerId: string;
  if (existing) {
    customerId = existing.id;
    const { error: updateError } = await (client.from("customers") as any)
      .update({ name, ...(email ? { email } : {}) })
      .eq("id", customerId);
    if (updateError) throw updateError;
  } else {
    const { data: created, error: insertError } = (await (client.from("customers") as any)
      .insert({ business_id: params.businessId, name, phone, email })
      .select("id")
      .single()) as unknown as { data: { id: string } | null; error: { message: string } | null };
    if (insertError) throw insertError;
    if (!created) throw new Error("No se pudo crear el cliente.");
    customerId = created.id;
  }

  const { data: entry, error } = (await (client.from("waitlist_entries") as any)
    .insert({
      business_id: params.businessId,
      customer_id: customerId,
      service_id: params.serviceId,
      preferred_date: params.preferredDate,
    })
    .select("id, status, created_at")
    .single()) as unknown as {
    data: { id: string; status: WaitlistStatus; created_at: string } | null;
    error: { message: string } | null;
  };
  if (error) throw error;
  if (!entry) throw new Error("No se pudo añadir a la lista de espera.");

  const { data: service, error: serviceError } = (await (client.from("services") as any)
    .select("name")
    .eq("id", params.serviceId)
    .single()) as unknown as { data: { name: string } | null; error: { message: string } | null };
  if (serviceError) throw serviceError;

  return {
    id: entry.id,
    preferredDate: params.preferredDate,
    status: entry.status,
    customerName: name,
    customerPhone: phone,
    serviceName: service?.name ?? "Servicio eliminado",
    offeredStartTime: null,
    offeredEndTime: null,
    createdAt: entry.created_at,
  };
}

export interface WaitlistEntryWithDetails {
  id: string;
  preferredDate: string;
  status: WaitlistStatus;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  offeredStartTime: string | null;
  offeredEndTime: string | null;
  createdAt: string;
}

export interface ListWaitlistParams {
  businessId: string;
  /** Filtra por un día concreto (YYYY-MM-DD). Si no se da, trae todos. */
  date?: string;
  statuses?: WaitlistStatus[];
}

/**
 * Lista la lista de espera del negocio, con nombre de cliente y servicio
 * (mismo patrón de consultas planas + merge en memoria que
 * `listBookingsWithDetails`, por el mismo motivo: los tipos de Supabase
 * están escritos a mano, sin metadatos de relaciones para selects
 * anidados).
 */
export async function listWaitlist(
  client: TypedClient,
  params: ListWaitlistParams,
): Promise<WaitlistEntryWithDetails[]> {
  let query = (client.from("waitlist_entries") as any)
    .select(WAITLIST_COLUMNS)
    .eq("business_id", params.businessId);

  if (params.date) query = query.eq("preferred_date", params.date);
  if (params.statuses && params.statuses.length > 0) query = query.in("status", params.statuses);

  const { data: entries, error } = (await query.order("created_at", { ascending: true })) as unknown as {
    data: WaitlistRow[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;
  if (!entries || entries.length === 0) return [];

  const customerIds = [...new Set(entries.map((e) => e.customer_id))];
  const serviceIds = [...new Set(entries.map((e) => e.service_id))];

  const [{ data: customers, error: customersError }, { data: services, error: servicesError }] = await Promise.all([
    (client.from("customers") as any)
      .select("id, name, phone")
      .eq("business_id", params.businessId)
      .in("id", customerIds) as unknown as Promise<{
      data: { id: string; name: string; phone: string }[] | null;
      error: { message: string } | null;
    }>,
    (client.from("services") as any)
      .select("id, name")
      .eq("business_id", params.businessId)
      .in("id", serviceIds) as unknown as Promise<{
      data: { id: string; name: string }[] | null;
      error: { message: string } | null;
    }>,
  ]);
  if (customersError) throw customersError;
  if (servicesError) throw servicesError;

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));

  return entries.map((e) => ({
    id: e.id,
    preferredDate: e.preferred_date,
    status: e.status,
    customerName: customerById.get(e.customer_id)?.name ?? "Cliente eliminado",
    customerPhone: customerById.get(e.customer_id)?.phone ?? "—",
    serviceName: serviceById.get(e.service_id)?.name ?? "Servicio eliminado",
    offeredStartTime: e.offered_start_time,
    offeredEndTime: e.offered_end_time,
    createdAt: e.created_at,
  }));
}

/** Quita a alguien de la lista de espera a mano (se arrepintió, duplicado, etc.). */
export async function deleteWaitlistEntry(client: TypedClient, entryId: string): Promise<void> {
  const { error } = await (client.from("waitlist_entries") as any).delete().eq("id", entryId);
  if (error) throw error;
}

export interface WaitlistOffer {
  entryId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  offeredStartTime: string;
  offeredEndTime: string;
  respondToken: string;
}

/**
 * Se llama justo después de cancelar una reserva: busca a la siguiente
 * persona en espera para ese día cuyo servicio quepa en el hueco que
 * acaba de liberarse y le marca la oferta. Devuelve `null` si no había
 * nadie esperando ese hueco.
 */
export async function offerNextWaitlistCandidate(
  client: TypedClient,
  bookingId: string,
): Promise<WaitlistOffer | null> {
  const { data, error } = (await (client.rpc as any)("offer_next_waitlist_candidate", {
    p_booking_id: bookingId,
  })) as unknown as {
    data:
      | {
          entry_id: string;
          customer_name: string;
          customer_phone: string;
          service_name: string;
          offered_start_time: string;
          offered_end_time: string;
          respond_token: string;
        }[]
      | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const offer = data?.[0];
  if (!offer) return null;

  return {
    entryId: offer.entry_id,
    customerName: offer.customer_name,
    customerPhone: offer.customer_phone,
    serviceName: offer.service_name,
    offeredStartTime: offer.offered_start_time,
    offeredEndTime: offer.offered_end_time,
    respondToken: offer.respond_token,
  };
}

export type WaitlistResponseResult = "accepted" | "rejected" | "expired" | "not_found";

export interface RespondToWaitlistOfferResult {
  result: WaitlistResponseResult;
  /** Nombre del negocio — presente salvo cuando `result` es `not_found`. */
  businessName?: string;
  booking?: {
    bookingId: string;
    serviceName: string;
    startTime: string;
    endTime: string;
  };
  /** Si al rechazar había alguien más esperando, aquí va su oferta (para "enviarle" el mensaje). */
  nextOffer?: WaitlistOffer;
}

/**
 * Responde (aceptar/rechazar) a una oferta de lista de espera desde el
 * enlace público de un solo uso — se llama con el cliente `anon`, sin
 * sesión, igual que `createPublicBooking`.
 */
export async function respondToWaitlistOffer(
  client: TypedClient,
  token: string,
  accept: boolean,
): Promise<RespondToWaitlistOfferResult> {
  const { data, error } = (await (client.rpc as any)("respond_to_waitlist_offer", {
    p_token: token,
    p_accept: accept,
  })) as unknown as {
    data:
      | {
          result: WaitlistResponseResult;
          booking_id: string | null;
          business_name: string | null;
          service_name: string | null;
          start_time: string | null;
          end_time: string | null;
          next_entry_id: string | null;
          next_customer_name: string | null;
          next_customer_phone: string | null;
          next_service_name: string | null;
          next_offered_start_time: string | null;
          next_offered_end_time: string | null;
          next_respond_token: string | null;
        }[]
      | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const row = data?.[0];
  if (!row) return { result: "not_found" };

  const out: RespondToWaitlistOfferResult = { result: row.result, businessName: row.business_name ?? undefined };

  if (row.result === "accepted" && row.booking_id && row.service_name && row.start_time && row.end_time) {
    out.booking = {
      bookingId: row.booking_id,
      serviceName: row.service_name,
      startTime: row.start_time,
      endTime: row.end_time,
    };
  }

  if (
    row.next_entry_id &&
    row.next_customer_name &&
    row.next_customer_phone &&
    row.next_service_name &&
    row.next_offered_start_time &&
    row.next_offered_end_time &&
    row.next_respond_token
  ) {
    out.nextOffer = {
      entryId: row.next_entry_id,
      customerName: row.next_customer_name,
      customerPhone: row.next_customer_phone,
      serviceName: row.next_service_name,
      offeredStartTime: row.next_offered_start_time,
      offeredEndTime: row.next_offered_end_time,
      respondToken: row.next_respond_token,
    };
  }

  return out;
}
