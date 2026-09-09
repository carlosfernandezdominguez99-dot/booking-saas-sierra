import type { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";

type TypedClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;

export interface PendingReviewRequest {
  reviewToken: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  serviceName: string | null;
}

/**
 * Envuelve `request_pending_reviews` (0020_reviews.sql): busca citas
 * confirmadas ya terminadas cuyo cliente todavía no tiene ninguna reseña
 * con ese negocio, crea la fila (con su enlace) y devuelve solo las que
 * se acaban de crear — para que el cron sepa a quién mandarle el email
 * SIN reenviárselo nunca a quien ya lo recibió. Necesita el cliente
 * `admin` (service_role): no hay sesión de usuario en un cron.
 */
export async function requestPendingReviews(client: AdminClient): Promise<PendingReviewRequest[]> {
  const { data, error } = (await (client.rpc as any)("request_pending_reviews")) as unknown as {
    data:
      | {
          review_token: string;
          business_id: string;
          business_name: string;
          business_slug: string;
          customer_id: string;
          customer_name: string;
          customer_email: string | null;
          service_name: string | null;
        }[]
      | null;
    error: { message: string } | null;
  };

  if (error) throw error;

  return (data ?? []).map((row) => ({
    reviewToken: row.review_token,
    businessId: row.business_id,
    businessName: row.business_name,
    businessSlug: row.business_slug,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    serviceName: row.service_name,
  }));
}

export interface ReviewByToken {
  valid: boolean;
  businessName?: string;
  alreadySubmitted?: boolean;
}

/** Envuelve `get_review_by_token` — para la página pública `/negocio/[slug]/resena/[token]`. */
export async function getReviewByToken(client: TypedClient, token: string): Promise<ReviewByToken> {
  const { data, error } = (await (client.rpc as any)("get_review_by_token", {
    p_token: token,
  })) as unknown as {
    data: { valid: boolean; business_name: string | null; already_submitted: boolean }[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  const row = data?.[0];
  if (!row || !row.valid) return { valid: false };
  return { valid: true, businessName: row.business_name ?? undefined, alreadySubmitted: row.already_submitted };
}

/** Envuelve `submit_review`. */
export async function submitReview(
  client: TypedClient,
  input: { token: string; rating: number; comment?: string },
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = (await (client.rpc as any)("submit_review", {
    p_token: input.token,
    p_rating: input.rating,
    p_comment: input.comment ?? null,
  })) as unknown as {
    data: { ok: boolean; error: string | null }[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  const row = data?.[0];
  if (!row) return { ok: false, error: "No se pudo enviar tu opinión." };
  return { ok: row.ok, error: row.error ?? undefined };
}

export interface ReviewRow {
  id: string;
  customerName: string;
  rating: number | null;
  comment: string | null;
  requestedAt: string;
  submittedAt: string | null;
}

/**
 * Lista las reseñas de un negocio para el panel (`/dashboard/resenas`) —
 * incluye también las pendientes (enlace mandado, aún sin responder) para
 * que se vea de un vistazo a cuántos clientes se les ha pedido opinión.
 * Select normal de cliente autenticado: RLS ya limita a las del propio
 * negocio (`is_business_member`).
 */
export async function listReviews(client: TypedClient, businessId: string): Promise<ReviewRow[]> {
  const { data: reviews, error } = (await (client.from("reviews") as any)
    .select("id, customer_id, rating, comment, requested_at, submitted_at")
    .eq("business_id", businessId)
    .order("requested_at", { ascending: false })) as unknown as {
    data:
      | { id: string; customer_id: string; rating: number | null; comment: string | null; requested_at: string; submitted_at: string | null }[]
      | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  if (!reviews || reviews.length === 0) return [];

  // Dos consultas planas + merge en memoria, no un select anidado — mismo
  // motivo que en `listBookingsWithDetails` (ver la nota larga en
  // `database.types.ts`): los tipos de Supabase están escritos a mano.
  const customerIds = [...new Set(reviews.map((r) => r.customer_id))];
  const { data: customers } = (await (client.from("customers") as any)
    .select("id, name")
    .in("id", customerIds)) as unknown as { data: { id: string; name: string }[] | null };
  const nameById = new Map((customers ?? []).map((c) => [c.id, c.name]));

  return reviews.map((row) => ({
    id: row.id,
    customerName: nameById.get(row.customer_id) ?? "Cliente",
    rating: row.rating,
    comment: row.comment,
    requestedAt: row.requested_at,
    submittedAt: row.submitted_at,
  }));
}
