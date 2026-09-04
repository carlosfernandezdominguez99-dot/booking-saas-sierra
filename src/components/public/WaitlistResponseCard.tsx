"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { respondToWaitlistOfferAction } from "@/app/lista-espera/[token]/actions";
import type { RespondToWaitlistOfferResult } from "@/lib/services/waitlistService";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WaitlistResponseCard({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RespondToWaitlistOfferResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function respond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await respondToWaitlistOfferAction(token, accept);
        setResult(res);
      } catch {
        setError("Algo ha fallado. Vuelve a intentarlo en unos segundos.");
      }
    });
  }

  if (result) {
    if (result.result === "accepted" && result.booking) {
      return (
        <Alert tone="success">
          <p className="font-medium">¡Cita confirmada!</p>
          <p className="mt-1">
            {result.booking.serviceName} en {result.businessName} — {formatDateTime(result.booking.startTime)}.
          </p>
        </Alert>
      );
    }
    if (result.result === "rejected") {
      return (
        <Alert tone="info">
          <p className="font-medium">Vale, sin problema.</p>
          <p className="mt-1">Hemos avisado a la siguiente persona en la lista de espera.</p>
        </Alert>
      );
    }
    if (result.result === "expired") {
      return (
        <Alert tone="error">
          <p className="font-medium">Ese hueco ya no está disponible.</p>
          <p className="mt-1">Alguien se te ha adelantado. Lo sentimos.</p>
        </Alert>
      );
    }
    return (
      <Alert tone="error">
        <p className="font-medium">Este enlace ya no es válido.</p>
        <p className="mt-1">Puede que ya hayas respondido antes, o que la oferta haya caducado.</p>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" className="flex-1" disabled={pending} onClick={() => respond(true)}>
          Sí, la quiero
        </Button>
        <Button type="button" variant="outline" className="flex-1" disabled={pending} onClick={() => respond(false)}>
          No, gracias
        </Button>
      </div>
    </div>
  );
}
