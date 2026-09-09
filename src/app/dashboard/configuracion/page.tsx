import Link from "next/link";
import { requireBusinessContext } from "@/lib/services/authContext";
import { getDashboardScope } from "@/lib/services/employeeScope";
import { getBookingSettings } from "@/lib/services/bookingSettingsService";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { LogoUploader } from "@/components/dashboard/LogoUploader";
import { EmployeePhotoUploader } from "@/components/dashboard/EmployeePhotoUploader";
import { EmployeeIdentityForm } from "@/components/dashboard/EmployeeIdentityForm";
import { ManagerPhotoUploader } from "@/components/dashboard/ManagerPhotoUploader";
import { ManagerIdentityForm } from "@/components/dashboard/ManagerIdentityForm";
import { BusinessProfileForm } from "@/components/dashboard/BusinessProfileForm";
import { BookingSettingsForm } from "@/components/dashboard/BookingSettingsForm";
import { SubscriptionCard } from "@/components/dashboard/SubscriptionCard";
import { Button } from "@/components/ui/Button";
import type { BookingSettingsInput } from "@/lib/validations/business";

const DEFAULT_SETTINGS: BookingSettingsInput = {
  minNoticeMinutes: 60,
  maxNoticeDays: 30,
  bufferMinutes: 0,
  allowCancellation: true,
  minCancellationHours: 24,
};

interface ConfiguracionPageProps {
  searchParams: { checkout?: string };
}

export default async function ConfiguracionPage({ searchParams }: ConfiguracionPageProps) {
  const { supabase, business, role, employeeId, employeeName } = await requireBusinessContext();
  const settingsRow = await getBookingSettings(supabase, business.id);

  // Fase 10: puesto en un empleado, esta página edita SU nombre y foto en
  // vez de los datos del negocio — el resto (enlace público, suscripción,
  // política de reservas) sigue siendo del negocio entero, no tiene
  // sentido "independizarlo" por persona.
  const { scope, employees } = await getDashboardScope(supabase, business, role, employeeId, employeeName);
  const employeeScope = scope.kind === "employee" ? scope : null;
  // Fase 11: el gerente solo necesita alias + foto propios (para su
  // círculo de arriba y el paso público "¿con quién?") cuando hay algún
  // empleado con quien distinguirse — sin empleados, sigue siendo
  // simplemente "el negocio", como hasta ahora.
  const hasEmployees = employees.length > 0;

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

      {employeeScope ? (
        <Card>
          <CardTitle>Foto y nombre de {employeeScope.employeeName}</CardTitle>
          <CardDescription className="mb-4">
            Así aparece en el selector de arriba y en el paso &quot;¿con quién?&quot; al reservar. El resto de
            esta página (logo, datos del negocio, política de reservas) es del negocio entero, no de
            cada empleado — cambia de círculo arriba para editar el tuyo o el de otro.
          </CardDescription>
          <div className="space-y-5">
            <EmployeePhotoUploader
              employeeId={employeeScope.employeeId}
              employeeName={employeeScope.employeeName}
              initialPhotoUrl={employeeScope.photoUrl}
            />
            <EmployeeIdentityForm employeeId={employeeScope.employeeId} initialName={employeeScope.employeeName} />
          </div>
        </Card>
      ) : (
        <>
          {hasEmployees && (
            <Card>
              <CardTitle>Tu perfil como gerente</CardTitle>
              <CardDescription className="mb-4">
                Alias y foto con los que apareces tú, junto a tus empleados, en el selector de círculos de
                arriba y en el paso &quot;¿con quién?&quot; al reservar.
              </CardDescription>
              <div className="space-y-5">
                <ManagerPhotoUploader
                  managerName={business.manager_display_name ?? business.name}
                  initialPhotoUrl={business.manager_photo_url}
                />
                <ManagerIdentityForm initialName={business.manager_display_name ?? business.name} />
              </div>
            </Card>
          )}

          <Card>
            <CardTitle>Logo</CardTitle>
            <CardDescription className="mb-4">
              Aparece en tu página de reservas. Recomendado: imagen cuadrada, al menos 200×200 px.
            </CardDescription>
            <LogoUploader businessName={business.name} initialLogoUrl={business.logo_url} />
          </Card>
        </>
      )}

      <Card>
        <CardTitle>Suscripción</CardTitle>
        <CardDescription className="mb-4">Plan único de 5 €/mes.</CardDescription>
        <SubscriptionCard
          status={business.subscription_status}
          trialEndsAt={business.trial_ends_at}
          hasStripeCustomer={Boolean(business.stripe_customer_id)}
          checkoutParam={searchParams.checkout}
        />
      </Card>

      {!employeeScope && (
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
              managerDisplayName: business.manager_display_name ?? business.name,
            }}
            hideManagerNameField={hasEmployees}
          />
        </Card>
      )}

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
