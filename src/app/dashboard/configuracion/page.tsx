import Link from "next/link";
import { requireBusinessContext } from "@/lib/services/authContext";
import { getBookingSettings } from "@/lib/services/bookingSettingsService";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { LogoUploader } from "@/components/dashboard/LogoUploader";
import { BusinessProfileForm } from "@/components/dashboard/BusinessProfileForm";
import { BookingSettingsForm } from "@/components/dashboard/BookingSettingsForm";
import { Button } from "@/components/ui/Button";
import type { BookingSettingsInput } from "@/lib/validations/business";

const STATUS_LABEL: Record<string, string> = {
  trial: "Prueba gratuita",
  active: "Activa",
  past_due: "Pago pendiente",
  cancelled: "Cancelada",
};

const DEFAULT_SETTINGS: BookingSettingsInput = {
  minNoticeMinutes: 60,
  maxNoticeDays: 30,
  bufferMinutes: 0,
  allowCancellation: true,
  minCancellationHours: 24,
};

export default async function ConfiguracionPage() {
  const { supabase, business } = await requireBusinessContext();
  const settingsRow = await getBookingSettings(supabase, business.id);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const publicUrl = `${siteUrl}/negocio/${business.slug}`;

  const initialSettings: BookingSettingsInput = settingsRow
    ? {
        minNoticeMinutes: settingsRow.min_notice_minutes,
        maxNoticeDays: settingsRow.max_notice_days,
        bufferMinutes: settingsRow.buffer_minutes,
        allowCancellation: settingsRow.allow_cancellation,
        minCancellationHours: settingsRow.min_cancellation_hours,
      }
    : DEFAULT_SETTINGS;

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
        <CardTitle>Logo</CardTitle>
        <CardDescription className="mb-4">
          Aparece en tu página de reservas. Recomendado: imagen cuadrada, al menos 200×200 px.
        </CardDescription>
        <LogoUploader businessName={business.name} initialLogoUrl={business.logo_url} />
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
          Nombre, teléfono y tipo de negocio se piden en el registro y de momento no son editables.
        </CardDescription>
        <dl className="mb-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
        <BusinessProfileForm
          initialProfile={{
            description: business.description ?? "",
            address: business.address ?? "",
            city: business.city ?? "",
          }}
        />
      </Card>

      <Card>
        <CardTitle>Configuración de reservas</CardTitle>
        <CardDescription className="mb-4">
          Antelación, descansos entre citas y política de cancelación. Los mensajes automáticos de
          aviso por WhatsApp llegan en una fase posterior.
        </CardDescription>
        <BookingSettingsForm initialSettings={initialSettings} />
      </Card>
    </div>
  );
}
