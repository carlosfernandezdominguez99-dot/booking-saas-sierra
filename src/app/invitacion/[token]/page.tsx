import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getEmployeeInvite } from "@/lib/services/employeeInviteService";
import { Card } from "@/components/ui/Card";
import { AcceptInviteForm } from "./AcceptInviteForm";

interface PageProps {
  params: { token: string };
}

export const metadata: Metadata = { title: "Invitación de equipo" };

export default async function InvitacionPage({ params }: PageProps) {
  const supabase = await createClient();
  const invite = await getEmployeeInvite(supabase, params.token).catch(() => null);

  return (
    <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/15 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="ZoriaBooking" className="h-12 w-12" />
            <span className="text-sm font-semibold tracking-tight text-white">
              Zoria<span className="text-brand-400">Booking</span>
            </span>
          </Link>
        </div>

        <Card>
          {!invite || !invite.valid ? (
            <div className="space-y-2 text-center">
              <h1 className="text-lg font-semibold text-ink-950">Invitación no válida</h1>
              <p className="text-sm text-ink-500">
                Este enlace de invitación ha caducado, fue revocado, o ya se usó. Pide al negocio que te
                envíe una nueva invitación.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="text-lg font-semibold text-ink-950">Te han invitado a un equipo</h1>
                <p className="mt-1 text-sm text-ink-500">
                  <strong>{invite.businessName}</strong> te ha invitado a unirte como{" "}
                  <strong>{invite.employeeName}</strong>. Crea tu acceso (o inicia sesión si ya tienes
                  cuenta) para ver y gestionar tu propia agenda.
                </p>
              </div>
              <AcceptInviteForm
                token={params.token}
                email={invite.email ?? ""}
                employeeName={invite.employeeName ?? ""}
              />
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
