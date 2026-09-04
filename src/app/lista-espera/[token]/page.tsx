import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { WaitlistResponseCard } from "@/components/public/WaitlistResponseCard";

export const metadata: Metadata = { title: "Lista de espera" };

interface PageProps {
  params: { token: string };
}

// Página pública (sin sesión) para responder a una oferta de lista de
// espera — el enlace de un solo uso que "lleva" el mensaje de WhatsApp
// mock (ver whatsappService.sendWaitlistOffer). Toda la validación real
// (¿sigue libre el hueco?, ¿ya respondió antes?) vive en
// `respond_to_waitlist_offer` (Postgres) — esta página solo pinta el
// resultado que devuelva.
export default function WaitlistResponsePage({ params }: PageProps) {
  return (
    <main className="min-h-screen bg-surface">
      <div className="container-app flex min-h-screen max-w-md flex-col justify-center py-12">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-ink-950">¿Quieres esta cita?</h1>
          <p className="mt-1 text-sm text-ink-500">Se ha liberado el hueco que tenías pendiente.</p>
        </div>
        <Card>
          <WaitlistResponseCard token={params.token} />
        </Card>
      </div>
    </main>
  );
}
