"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { startCheckoutAction, openBillingPortalAction } from "@/app/dashboard/configuracion/actions";
import type { Database } from "@/types/database.types";

type SubscriptionStatus = Database["public"]["Tables"]["businesses"]["Row"]["subscription_status"];

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Prueba gratuita",
  active: "Activa",
  past_due: "Pago pendiente",
  cancelled: "Cancelada",
};

const STATUS_CLASS: Record<SubscriptionStatus, string> = {
  trial: "bg-ink-100 text-ink-700",
  active: "bg-emerald-100 text-emerald-700",
  past_due: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export function SubscriptionCard({
  status,
  trialEndsAt,
  hasStripeCustomer,
  checkoutParam,
}: {
  status: SubscriptionStatus;
  trialEndsAt: string;
  hasStripeCustomer: boolean;
  checkoutParam?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpgrade() {
    setError(null);
    startTransition(async () => {
      const res = await startCheckoutAction();
      if (res.error || !res.url) {
        setError(res.error ?? "No se pudo iniciar el pago.");
        return;
      }
      window.location.href = res.url;
    });
  }

  function handleManage() {
    setError(null);
    startTransition(async () => {
      const res = await openBillingPortalAction();
      if (res.error || !res.url) {
        setError(res.error ?? "No se pudo abrir el portal de facturación.");
        return;
      }
      window.location.href = res.url;
    });
  }

  return (
    <div className="space-y-3">
      {checkoutParam === "cancelled" && (
        <Alert tone="info">Has cerrado el pago sin completarlo. Puedes intentarlo de nuevo cuando quieras.</Alert>
      )}
      {checkoutParam === "success" && status !== "active" && (
        <Alert tone="info">
          Pago recibido — tu plan se activará en cuanto Stripe confirme la suscripción (unos segundos).
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
        {status === "trial" && <p className="text-xs text-ink-400">Termina el {formatDate(trialEndsAt)}</p>}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex gap-2">
        {status === "active" && hasStripeCustomer ? (
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleManage}>
            Gestionar suscripción
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={isPending} onClick={handleUpgrade}>
            {status === "past_due" ? "Actualizar método de pago" : "Pasar a plan de pago"}
          </Button>
        )}
      </div>
    </div>
  );
}
