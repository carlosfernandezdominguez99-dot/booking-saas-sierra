import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestPendingReviews } from "@/lib/services/reviewsService";
import { sendReviewRequestEmail } from "@/lib/email/emailService";

/**
 * Fase 9.3 — lo llama un cron de Vercel (ver `vercel.json`), nunca un
 * navegador. No hay ningún trigger de base de datos que se dispare solo
 * con el paso del tiempo (nada cambia el estado de una reserva a
 * `completed`), así que hace falta revisar periódicamente qué citas
 * confirmadas ya han terminado — `request_pending_reviews` (con la
 * service role, que salta RLS) es quien decide de verdad a quién le toca
 * y crea la fila (una única vez por cliente y negocio, ver
 * `0020_reviews.sql`); aquí solo se manda el email por cada una que
 * devuelva.
 *
 * Protegido con `CRON_SECRET` (Vercel lo manda como
 * `Authorization: Bearer <CRON_SECRET>` en cuanto esa variable de entorno
 * existe en el proyecto) para que nadie más pueda dispararlo a mano.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/review-requests] CRON_SECRET no configurado — petición rechazada.");
    return NextResponse.json({ error: "Cron no configurado." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let pending: Awaited<ReturnType<typeof requestPendingReviews>>;
  try {
    pending = await requestPendingReviews(supabase);
  } catch (err) {
    console.error("[cron/review-requests] No se pudo consultar reseñas pendientes:", err);
    return NextResponse.json({ error: "No se pudo consultar reseñas pendientes." }, { status: 500 });
  }

  let sent = 0;
  for (const item of pending) {
    if (!item.customerEmail) continue;
    try {
      const result = await sendReviewRequestEmail({
        toEmail: item.customerEmail,
        customerName: item.customerName,
        businessName: item.businessName,
        reviewUrl: `${siteUrl}/negocio/${item.businessSlug}/resena/${item.reviewToken}`,
      });
      if (result.sent || result.mocked) sent += 1;
    } catch (err) {
      // No-op a propósito: la fila de `reviews` ya se creó (no se
      // reintentará en la siguiente pasada, porque el `unique` ya existe),
      // así que un fallo de envío aquí no debe tirar abajo el resto del
      // lote — solo se deja constancia en los logs.
      console.error(`[cron/review-requests] No se pudo enviar el email a ${item.customerEmail}:`, err);
    }
  }

  return NextResponse.json({ requested: pending.length, sent });
}
