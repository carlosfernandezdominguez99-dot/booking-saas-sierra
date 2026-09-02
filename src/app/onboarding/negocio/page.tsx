import Link from "next/link";
import { requireBusinessContext } from "@/lib/services/authContext";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default async function OnboardingNegocioPage() {
  const { business } = await requireBusinessContext();

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50/50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            Paso 1 de 5
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">
            ¡Cuenta creada, {business.name}!
          </h1>
        </div>

        <Card>
          <CardTitle>El asistente de configuración llega en la Fase 2</CardTitle>
          <CardDescription className="mb-4">
            Ya tienes usuario y negocio creados de forma segura (con Row Level Security activo).
            En la siguiente fase se implementa aquí el asistente paso a paso: información del
            negocio, servicios, horarios y configuración de reservas.
          </CardDescription>
          <Link href="/dashboard/inicio">
            <Button className="w-full">Ir al panel</Button>
          </Link>
        </Card>
      </div>
    </main>
  );
}
