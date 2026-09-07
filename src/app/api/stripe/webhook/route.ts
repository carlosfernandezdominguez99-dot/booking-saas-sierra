import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeSignature, mapStripeSubscriptionStatus } from "@/lib/stripe/stripeService";

/**
 * Webhook de Stripe — la única forma fiable de saber que un pago se
 * completó de verdad o que una suscripción cambió de estado (impago,
 * cancelación desde el propio portal de Stripe, etc.). Usa el cliente
 * `admin` (service_role, salta RLS) porque esta petición no lleva sesión
 * de ningún usuario — solo la firma de Stripe la autentica.
 *
 * Hace falta leer el cuerpo como texto crudo (`request.text()`, nunca
 * `request.json()`) porque la verificación de la firma se calcula sobre
 * los bytes exactos que mandó Stripe; si Next.js lo parseara y
 * reserializara antes, la firma no cuadraría nunca.
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET no configurado — evento rechazado.");
    return NextResponse.json({ error: "Webhook no configurado." }, { status: 400 });
  }

  if (!signature || !verifyStripeSignature(payload, signature, webhookSecret)) {
    console.error("[stripe/webhook] Firma inválida o ausente.");
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Cuerpo no es JSON válido." }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const businessId: string | null = session.client_reference_id ?? session.metadata?.business_id ?? null;
        if (businessId && session.mode === "subscription") {
          await (supabase.from("businesses") as any)
            .update({
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              subscription_status: "active",
            })
            .eq("id", businessId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        await (supabase.from("businesses") as any)
          .update({
            stripe_subscription_id: subscription.id,
            subscription_status: mapStripeSubscriptionStatus(subscription.status),
          })
          .eq("stripe_customer_id", subscription.customer);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await (supabase.from("businesses") as any)
          .update({ subscription_status: "cancelled" })
          .eq("stripe_customer_id", subscription.customer);
        break;
      }

      default:
        // Cualquier otro evento (facturas, disputas, etc.) se ignora a
        // propósito — no hace falta reaccionar a nada más para el plan
        // único que tiene la app.
        break;
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error procesando el evento ${event?.type}:`, err);
    // Se responde 200 igualmente: si Stripe reintentara por un fallo
    // nuestro (no de firma), lo haría varias veces sin que sirva de nada
    // sin arreglar antes el código — el log ya deja rastro para depurarlo.
  }

  return NextResponse.json({ received: true });
}
