"use server";

import { createClient } from "@/lib/supabase/server";
import { submitReview } from "@/lib/services/reviewsService";

export interface SubmitReviewActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Deja la opinión de un enlace de reseña (Fase 9.3). Público — sin
 * sesión: el propio token en la URL es la autorización, igual que en
 * `/lista-espera/[token]`. `submit_review` (Postgres) es quien de verdad
 * rechaza un enlace ya usado o inválido; esto solo lo envuelve.
 */
export async function submitReviewAction(
  token: string,
  rating: number,
  comment: string,
): Promise<SubmitReviewActionResult> {
  try {
    const supabase = await createClient();
    const result = await submitReview(supabase, { token, rating, comment: comment.trim().slice(0, 500) });
    if (!result.ok) return { ok: false, error: result.error ?? "No se pudo enviar tu opinión." };
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo enviar tu opinión. Inténtalo de nuevo." };
  }
}
