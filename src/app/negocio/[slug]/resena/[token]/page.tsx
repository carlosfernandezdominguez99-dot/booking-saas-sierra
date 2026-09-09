import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getReviewByToken } from "@/lib/services/reviewsService";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { ReviewFormCard } from "@/components/public/ReviewFormCard";

export const metadata: Metadata = { title: "Tu opinión" };

interface PageProps {
  params: { slug: string; token: string };
}

/**
 * Página pública (sin sesión) para dejar la reseña de una cita ya
 * terminada — el enlace que manda el cron de la Fase 9.3. Toda la
 * validación real (¿existe el token?, ¿ya se usó?) vive en
 * `get_review_by_token`/`submit_review` (Postgres); esta página solo
 * enseña el resultado.
 */
export default async function ReviewPage({ params }: PageProps) {
  const supabase = await createClient();
  const review = await getReviewByToken(supabase, params.token);

  return (
    <main className="min-h-screen bg-surface">
      <div className="container-app flex min-h-screen max-w-md flex-col justify-center py-12">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-ink-950">¿Qué te ha parecido?</h1>
          {review.valid && <p className="mt-1 text-sm text-ink-500">Tu opinión sobre {review.businessName}.</p>}
        </div>
        <Card>
          {!review.valid ? (
            <Alert tone="error">
              <p className="font-medium">Este enlace no es válido.</p>
            </Alert>
          ) : review.alreadySubmitted ? (
            <Alert tone="info">
              <p className="font-medium">Ya has dejado tu opinión con este enlace.</p>
              <p className="mt-1">¡Gracias por tu tiempo!</p>
            </Alert>
          ) : (
            <ReviewFormCard token={params.token} businessName={review.businessName ?? "el negocio"} />
          )}
        </Card>
      </div>
    </main>
  );
}
