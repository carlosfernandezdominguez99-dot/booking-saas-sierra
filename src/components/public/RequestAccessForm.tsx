"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { requestAccessAction } from "@/app/negocio/[slug]/mis-citas/actions";

export function RequestAccessForm({
  slug,
  businessName,
  invalidLink,
}: {
  slug: string;
  businessName: string;
  invalidLink?: boolean;
}) {
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await requestAccessAction(slug, contact);
      setSent(true);
    });
  }

  return (
    <Card className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink-950">Mis citas en {businessName}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Introduce el teléfono o email con el que reservaste y te mandamos un enlace para entrar.
        </p>
      </div>

      {invalidLink && !sent && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Ese enlace no es válido o ha caducado. Pide uno nuevo abajo.
        </p>
      )}

      {sent ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Si ese contacto está registrado, te llegará un email con el enlace de acceso.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Teléfono o email"
            required
          />
          <Button type="submit" className="w-full" loading={isPending}>
            Enviarme el enlace
          </Button>
        </form>
      )}

      <p className="text-center text-xs text-ink-400">
        ¿Primera vez?{" "}
        <Link href={`/negocio/${slug}`} className="font-medium text-brand-600 hover:underline">
          Reserva desde la página del negocio
        </Link>
        .
      </p>
    </Card>
  );
}
