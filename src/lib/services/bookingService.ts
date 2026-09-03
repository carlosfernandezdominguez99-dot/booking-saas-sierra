import type { createClient } from "@/lib/supabase/server";
import type { Database, BookingStatus } from "@/types/database.types";

type TypedClient = Awaited<ReturnType<typeof createClient>>;
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

const BOOKING_COLUMNS =
  "id, business_id, service_id, employee_id, customer_id, start_time, end_time, status, comment, created_at, updated_at";

export interface CreatePublicBookingParams {
  businessId: string;
  serviceId: string;
  /** ISO timestamptz del inicio exacto del hueco elegido (debe coincidir con un `slotStart` de `getAvailableSlots`). */
  startTime: string;
  customerName: string;
  customerPhone: string;
  employeeId?: string | null;
  customerEmail?: string | null;
  comment?: string | null;
}

export interface PublicBookingResult {
  bookingId: string;
  businessName: string;
  serviceName: string;
  priceCents: number;
  startTime: string;
  endTime: string;
  status: string;
}

/**
 * Envuelve `create_public_booking` (0003_booking_functions.sql): revalida
 * el hueco directamente en Postgres (nunca se fía de lo que haya calculado
 * el cliente con `getAvailableSlots`, que pudo quedar desactualizado),
 * crea o actualiza el cliente por `(business_id, phone)` y crea la reserva
 * en una sola operación atómica.
 *
 * Lanza un `Error` con el mensaje de negocio tal cual lo da la función
 * (p. ej. "Ese horario ya no está disponible", "Servicio no disponible")
 * para poder mostrarlo directamente al usuario sin traducir códigos.
 */
export async function createPublicBooking(
  client: TypedClient,
  params: CreatePublicBookingParams,
): Promise<PublicBookingResult> {
  // `(client.rpc as any)`: mismo fallo de inferencia de tipos que en
  // `availabilityService.ts` — ver el comentario detallado allí.
  const { data, error } = (await (client.rpc as any)("create_public_booking", {
    p_business_id: params.businessId,
    p_service_id: params.serviceId,
    p_start_time: params.startTime,
    p_customer_name: params.customerName,
    p_customer_phone: params.customerPhone,
    p_employee_id: params.employeeId ?? null,
    p_customer_email: params.customerEmail ?? null,
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

export interface ListBookingsParams {
  businessId: string;
  /** ISO timestamptz, inclusive. */
  from?: string;
  /** ISO timestamptz, exclusive. */
  to?: string;
  statuses?: BookingStatus[];
  /** Orden por `start_time`. Por defecto ascendente. */
  order?: "asc" | "desc";
}

/**
 * Lista reservas del negocio autenticado. Pensada para el calendario y el
 * listado de reservas del panel (Fase 4) — usa siempre el cliente
 * autenticado del usuario, nunca el anónimo, y se apoya en RLS
 * (`is_business_member`) para que solo se puedan leer las del propio
 * negocio.
 */
export async function listBookings(client: TypedClient, params: ListBookingsParams): Promise<BookingRow[]> {
  // Se construye la consulta sobre el query builder "sin tipar" (`as any`
  // en el acceso a la tabla), en vez de reasignar `query = query.gte(...)`
  // paso a paso: encadenar filtros condicionalmente sobre el builder
  // tipado es justo el patrón que, en otros puntos de este proyecto,
  // colapsó a `never` en el build de producción de Vercel (ver la nota
  // larga en `database.types.ts`). El resultado final sí se fuerza al
  // shape real que esperamos.
  let query = (client.from("bookings") as any).select(BOOKING_COLUMNS).eq("business_id", params.businessId);

  if (params.from) query = query.gte("start_time", params.from);
  if (params.to) query = query.lt("start_time", params.to);
  if (params.statuses && params.statuses.length > 0) query = query.in("status", params.statuses);

  const { data, error } = (await query.order("start_time", {
    ascending: params.order !== "desc",
  })) as unknown as {
    data: BookingRow[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return data ?? [];
}

/**
 * Cancela una reserva desde el panel (el negocio cancela manualmente). El
 * flujo de cancelación por WhatsApp con lista de espera es la Fase 7 y
 * vivirá en su propio servicio. RLS garantiza que solo se puede cancelar
 * una reserva del propio negocio.
 */
export async function cancelBooking(client: TypedClient, bookingId: string): Promise<void> {
  const { error } = await (client.from("bookings") as any).update({ status: "cancelled" }).eq("id", bookingId);
  if (error) throw error;
}

export interface BookingWithDetails {
  id: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  comment: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
}

/**
 * Igual que `listBookings`, pero añade el nombre del cliente y del
 * servicio para mostrar en el calendario/listado del panel (Fase 4).
 *
 * Se hace con consultas planas + un merge en memoria, en vez de un select
 * anidado (`bookings(*, customers(name), services(name))`): nuestros
 * tipos de Supabase están escritos a mano y no incluyen metadatos de
 * relaciones — ver el comentario equivalente en `businessService.ts` /
 * `authContext.ts`. Con el volumen de reservas de un negocio pequeño esto
 * es más que suficiente; si hiciera falta paginar en el futuro, este es
 * el sitio a revisar primero.
 */
export async function listBookingsWithDetails(
  client: TypedClient,
  params: ListBookingsParams,
): Promise<BookingWithDetails[]> {
  const bookings = await listBookings(client, params);
  if (bookings.length === 0) return [];

  const customerIds = [...new Set(bookings.map((b) => b.customer_id))];
  const serviceIds = [...new Set(bookings.map((b) => b.service_id))];

  // `as any` en el acceso a ambas tablas, por el mismo motivo que en
  // `listBookings` de este mismo archivo (ver nota de arriba).
  const [{ data: customers, error: customersError }, { data: services, error: servicesError }] = await Promise.all([
    (client.from("customers") as any)
      .select("id, name, phone")
      .eq("business_id", params.businessId)
      .in("id", customerIds) as unknown as Promise<{
      data: { id: string; name: string; phone: string }[] | null;
      error: { message: string } | null;
    }>,
    (client.from("services") as any)
      .select("id, name, price_cents, duration_minutes")
      .eq("business_id", params.businessId)
      .in("id", serviceIds) as unknown as Promise<{
      data: { id: string; name: string; price_cents: number; duration_minutes: number }[] | null;
      error: { message: string } | null;
    }>,
  ]);

  if (customersError) throw customersError;
  if (servicesError) throw servicesError;

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));

  return bookings.map((b) => {
    const customer = customerById.get(b.customer_id);
    const service = serviceById.get(b.service_id);
    return {
      id: b.id,
      startTime: b.start_time,
      endTime: b.end_time,
      status: b.status,
      comment: b.comment,
      customerId: b.customer_id,
      customerName: customer?.name ?? "Cliente eliminado",
      customerPhone: customer?.phone ?? "—",
      serviceId: b.service_id,
      serviceName: service?.name ?? "Servicio eliminado",
      priceCents: service?.price_cents ?? 0,
      durationMinutes: service?.duration_minutes ?? 0,
    };
  });
}
