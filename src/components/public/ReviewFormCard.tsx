"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils/cn";
import { submitReviewAction } from "@/app/negocio/[slug]/resena/[token]/actions";

const STARS = [1, 2, 3, 4, 5];

export function ReviewFormCard({ token, businessName }: { token: string; businessName: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Elige una puntuación.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitReviewAction(token, rating, comment);
      if (!res.ok) {
        setError(res.error ?? "No se pudo enviar tu opinión.");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <Alert tone="success">
        <p className="font-medium">¡Gracias por tu opinión!</p>
        <p className="mt-1">Se la hemos hecho llegar a {businessName}.</p>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">¿Cómo puntúas tu experiencia?</p>
        <div className="flex gap-1">
          {STARS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} estrella${value > 1 ? "s" : ""}`}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl border text-2xl transition-colors",
                value <= rating ? "border-amber-300 bg-amber-50 text-amber-500" : "border-ink-200 text-ink-300",
              )}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <textarea
          placeholder="¿Algo que quieras contarles? (opcional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
        />
      </div>

      <Button type="submit" className="w-full" loading={isPending}>
        Enviar opinión
      </Button>
    </form>
  );
}
