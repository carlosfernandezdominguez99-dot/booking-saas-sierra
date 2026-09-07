import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Capa de servicio de Stripe (Fase 8 — suscripciones). Mismo patrón que
 * `emailService.ts`/`whatsappService.ts`: usa la API HTTP de Stripe
 * directamente (sin SDK oficial) para no añadir una dependencia nueva
 * solo por dos llamadas (Checkout Session y Billing Portal Session).
 *
 * A diferencia de WhatsApp/email, aquí NO tiene sentido "mockear" un pago
 * — no hay ningún log que sustituya a cobrar de verdad. Mientras no estén
 * configuradas las variables de entorno, las funciones devuelven un error
 * claro (`No se pudo iniciar el pago: Stripe no está configurado...`) en
 * vez de intentar nada.
 *
 * Para activarlo hace falta, todo en el dashboard de Stripe:
 *  - STRIPE_SECRET_KEY: clave secreta (modo prueba o real).
 *  - STRIPE_PRICE_ID: el ID del precio recurrente (5 €/mes) del producto.
 *  - STRIPE_WEBHOOK_SECRET: el "signing secret" del endpoint de webhook
 *    que hay que crear apuntando a `https://tu-dominio/api/stripe/webhook`,
 *    suscrito como mínimo a `checkout.session.completed`,
 *    `customer.subscription.updated` y `customer.subscription.deleted`.
 */

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export interface StripeUrlResult {
  url?: string;
  error?: string;
}

/**
 * Stripe espera el body como `application/x-www-form-urlencoded`, con
 * objetos/arrays anidados usando notación de corchetes
 * (`line_items[0][price]=...`) — nunca JSON. Esta función aplana
 * cualquier estructura anidada a ese formato.
 */
function appendParam(form: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendParam(form, `${key}[${index}]`, item));
  } else if (typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      appendParam(form, `${key}[${nestedKey}]`, nestedValue);
    }
  } else {
    form.append(key, String(value));
  }
}

function toFormBody(params: Record<string, unknown>): string {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    appendParam(form, key, value);
  }
  return form.toString();
}

async function stripeRequest(
  path: string,
  params: Record<string, unknown>,
): Promise<{ data?: any; error?: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { error: "Stripe no está configurado todavía (falta STRIPE_SECRET_KEY)." };
  }

  try {
    const response = await fetch(`${STRIPE_API_BASE}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: toFormBody(params),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return { error: json?.error?.message ?? `Stripe devolvió un error (${response.status}).` };
    }

    return { data: json };
  } catch (err) {
    console.error("[stripeService] Fallo de red al llamar a Stripe:", err);
    return { error: "No se pudo contactar con Stripe. Inténtalo de nuevo." };
  }
}

export interface CreateCheckoutSessionParams {
  businessId: string;
  /** Email del dueño del negocio — solo se usa si todavía no hay `existingCustomerId`. */
  customerEmail?: string | null;
  /** Si el negocio ya tiene cliente de Stripe (de una suscripción anterior), se reutiliza. */
  existingCustomerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Crea una Checkout Session en modo suscripción para el plan único de
 * 5 €/mes. `client_reference_id` y `metadata.business_id` llevan el ID del
 * negocio para que el webhook sepa a quién activar en cuanto se complete
 * el pago (`checkout.session.completed`), sin depender solo de
 * `stripe_customer_id` (que en ese momento puede que todavía no exista).
 */
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<StripeUrlResult> {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return { error: "Stripe no está configurado todavía (falta STRIPE_PRICE_ID)." };
  }

  const result = await stripeRequest("checkout/sessions", {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.businessId,
    metadata: { business_id: params.businessId },
    ...(params.existingCustomerId
      ? { customer: params.existingCustomerId }
      : params.customerEmail
        ? { customer_email: params.customerEmail }
        : {}),
  });

  if (result.error) return { error: result.error };
  return { url: result.data?.url };
}

export interface CreateBillingPortalSessionParams {
  customerId: string;
  returnUrl: string;
}

/** Sesión del portal de facturación de Stripe (cambiar tarjeta, ver facturas, cancelar). */
export async function createBillingPortalSession(
  params: CreateBillingPortalSessionParams,
): Promise<StripeUrlResult> {
  const result = await stripeRequest("billing_portal/sessions", {
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  if (result.error) return { error: result.error };
  return { url: result.data?.url };
}

const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Verifica la firma de un webhook de Stripe a mano (sin el SDK) siguiendo
 * su esquema documentado: la cabecera `Stripe-Signature` trae
 * `t=<timestamp>,v1=<firma>`, y la firma es un HMAC-SHA256 de
 * `"<timestamp>.<cuerpo crudo>"` con el signing secret del endpoint. Se
 * compara con `timingSafeEqual` (nunca con `===`) para no filtrar por
 * temporización, y se rechazan eventos con más de 5 minutos de antigüedad
 * para evitar ataques de repetición.
 */
export function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): boolean {
  const parts: Record<string, string> = {};
  for (const pair of signatureHeader.split(",")) {
    const [key, value] = pair.split("=");
    if (key && value) parts[key] = value;
  }

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expectedSignature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const providedBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

/** Estado de suscripción del negocio, mapeado desde el `status` que manda Stripe. */
export function mapStripeSubscriptionStatus(stripeStatus: string): "active" | "past_due" | "cancelled" {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "past_due" || stripeStatus === "unpaid" || stripeStatus === "incomplete") return "past_due";
  return "cancelled";
}
