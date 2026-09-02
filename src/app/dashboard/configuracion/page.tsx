import Link from "next/link";
import { requireBusinessContext } from "@/lib/services/authContext";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { Button } from "@/components/ui/Button";

const STATUS_LABEL: Record<string, string> = {
  trial: "Prueba gratuita",
  active: "Activa",
  past_due: "Pago pendiente",
  cancelled: "Cancelada",
};

export default async function ConfiguracionPage() {
  const { business } = await requireBusinessContext();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const publicUrl = `${siteUrl}/negocio/${business.slug}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Configuración</h1>

      <Card>
        <CardTitle>Tu página de reservas</CardTitle>
        <CardDescription className="mb-4">
          Compártela en Instagram, WhatsApp, Google o donde quieras que te encuentren tus clientes.
        </CardDescription>
        <div className="flex flex-col gap-3 rounded-xl border border-ink-100 bg-ink-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <code className="break-all text-sm text-ink-700">{publicUrl}</code>
          <div className="flex shrink-0 gap-2">
            <CopyLinkButton url={publicUrl} />
            <Link href={`/negocio/${business.slug}`} target="_blank">
              <Button type="button" variant="ghost" size="sm">Ver página</Button>
            </Link>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Suscripción</CardTitle>
        <CardDescription className="mb-4">
          Plan único de 5 €/mes. La integración de pago (Stripe) llega en la Fase 8.
        </CardDescription>
        <span className="inline-flex items-center rounded-full bg-ink-100 px-3 py-1 text-sm font-medium text-ink-700">
          {STATUS_LABEL[business.subscription_status] ?? business.subscription_status}
        </span>
      </Card>

      <Card>
        <CardTitle>Datos del negocio</CardTitle>
        <CardDescription className="mb-4">
          La edición completa (logo, descripción, dirección) se habilita en la Fase 2.
        </CardDescription>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-400">Nombre</dt>
            <dd className="text-ink-800">{business.name}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Teléfono</dt>
            <dd className="text-ink-800">{business.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Tipo de negocio</dt>
            <dd className="text-ink-800">{business.business_type ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Zona horaria</dt>
            <dd className="text-ink-800">{business.timezone}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
