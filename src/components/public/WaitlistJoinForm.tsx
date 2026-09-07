"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, FieldError } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { DatePicker } from "@/components/ui/DatePicker";
import { joinWaitlistPublicAction } from "@/app/negocio/[slug]/lista-espera/actions";

export interface WaitlistServiceLite {
  id: string;
  name: string;
}

export function WaitlistJoinForm({
  slug,
  businessName,
  services,
  today,
  initialServiceId,
}: {
  slug: string;
  businessName: string;
  services: WaitlistServiceLite[];
  today: string;
  initialServiceId: string | null;
}) {
  const [serviceId, setServiceId] = useState(initialServiceId ?? "");
  const [preferredDate, setPreferredDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!serviceId || !preferredDate) {
      setFormError("Elige un servicio y un día.");
      return;
    }

    startTransition(async () => {
      const res = await joinWaitlistPublicAction(slug, {
        serviceId,
        preferredDate,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
      });

      if (res.error) {
        setFormError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }

      setDone(true);
    });
  }

  if (services.length === 0) {
    return (
      <Card className="border-dashed py-12 text-center text-sm text-ink-400">
        Este negocio todavía no tiene servicios disponibles.
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
          ✓
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink-950">¡Apuntado!</h2>
          <p className="mt-1 text-sm text-ink-500">
            Te avisaremos por email en cuanto se libere un hueco que encaje en {businessName}.
          </p>
        </div>
        <p className="text-xs text-ink-400">
          Te hemos enviado un email con un enlace para consultar o darte de baja de la lista de espera cuando quieras.
        </p>
        <Link href={`/negocio/${slug}`} className="inline-block text-sm font-medium text-brand-600 hover:underline">
          Volver a la página de {businessName}
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Servicio</Label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
          >
            <option value="">Elige un servicio…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Día que te viene bien</Label>
          <DatePicker value={preferredDate} onChange={setPreferredDate} todayStr={today} />
        </div>
        <div>
          <Input
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.customerName}
            required
          />
          <FieldError message={fieldErrors.customerName} />
        </div>
        <div>
          <Input
            type="tel"
            placeholder="Tu teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={fieldErrors.customerPhone}
            required
          />
          <FieldError message={fieldErrors.customerPhone} />
        </div>
        <div>
          <Input
            type="email"
            placeholder="Tu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.customerEmail}
            required
          />
          <FieldError message={fieldErrors.customerEmail} />
        </div>

        {formError && <Alert tone="error">{formError}</Alert>}

        <Button type="submit" className="w-full" loading={isPending}>
          Apuntarme a la lista de espera
        </Button>
      </form>
    </Card>
  );
}
