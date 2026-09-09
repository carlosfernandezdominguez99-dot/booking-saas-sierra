import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublicBusinessBySlug } from "@/lib/services/publicBusinessService";
import { getAvailableSlots } from "@/lib/services/availabilityService";
import { todayInTimezone } from "@/lib/utils/timezone";
import { BookingWizard } from "@/components/public/BookingWizard";
import { CustomerAuthForm } from "@/components/public/CustomerAuthForm";
import { getCustomerSessionToken } from "@/lib/services/customerAuthSession";
import { getCustomerAccountProfile } from "@/lib/services/customerAccountService";
import type { SlotWithEmployee } from "./actions";

interface PageProps {
  params: { slug: string };
  searchParams: { servicio?: string; reemplaza?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await getPublicBusinessBySlug(params.slug);
  return { title: result ? `Reservar en ${result.business.name}` : "Negocio no encontrado" };
}

export default async function ReservarPage({ params, searchParams }: PageProps) {
  const result = await getPublicBusinessBySlug(params.slug);
  if (!result) notFound();
  const { business, services } = result;

  // El servicio con el que arranca el asistente: el de `?servicio=` si es
  // válido, o el único que tenga el negocio si solo ofrece uno. Se
  // resuelve aquí (no en el componente de cliente) para poder traer sus
  // huecos del primer día ya en esta misma petición, en vez de dejar que
  // el asistente los pida después con una ida y vuelta de más.
  const queryServiceId = searchParams.servicio;
  const effectiveServiceId =
    (queryServiceId && services.some((s) => s.id === queryServiceId) ? queryServiceId : null) ??
    (services.length === 1 ? services[0].id : null);

  const today = todayInTimezone(business.timezone);
  const supabase = await createClient();

  // Pedido explícito de Carlos: ya no se puede reservar sin cuenta — hace
  // falta haber iniciado sesión en `/mis-citas` (o desde el selector "Soy
  // cliente" de `/login`/`/registro`). El cierre real está en la base de
  // datos (`create_public_booking` ya no tiene `execute` para `anon`, ver
  // `0014_require_account_booking.sql`); esta comprobación aquí es solo
  // para no enseñar el asistente si de todas formas la reserva no se va a
  // poder completar.
  const token = await getCustomerSessionToken();
  let accountProfile: { name: string; email: string; phone: string } | null = null;
  if (token) {
    try {
      accountProfile = await getCustomerAccountProfile(supabase, token);
    } catch {
      accountProfile = null;
    }
  }

  // Si venía de "Modificar" (ver `CustomerAccountDashboard.tsx`), el id de
  // la cita que hay que cancelar en cuanto la nueva se cree con éxito —
  // se conserva también en `redirectTo` para no perderlo si hay que
  // iniciar sesión primero.
  const replaceBookingId = searchParams.reemplaza ?? null;

  const redirectParams = new URLSearchParams();
  if (queryServiceId) redirectParams.set("servicio", queryServiceId);
  if (replaceBookingId) redirectParams.set("reemplaza", replaceBookingId);
  const redirectQuery = redirectParams.toString();
  const redirectTo = `/negocio/${params.slug}/reservar${redirectQuery ? `?${redirectQuery}` : ""}`;

  // Si el servicio inicial tiene 1+ empleados asignados, hace falta
  // elegir con quién antes de poder enseñar huecos (o "cualquiera
  // disponible", que el propio asistente resuelve en el cliente) — así
  // que no se piden huecos aquí todavía, se deja que el asistente
  // arranque en el paso "Elige con quién". El gerente (Fase 9.2) siempre
  // cuenta como un candidato más además de los empleados reales, así que
  // con 1 solo empleado asignado YA hace falta preguntar (él o el
  // gerente) — ya no se auto-selecciona en silencio como antes. Sin
  // ningún empleado real asignado (negocio sin empleados, o este servicio
  // en concreto sin asignar), funciona igual que siempre: los huecos del
  // horario general, que son los del gerente.
  const effectiveService = services.find((s) => s.id === effectiveServiceId) ?? null;
  const needsEmployeeStep = Boolean(effectiveService && effectiveService.employees.length >= 1);

  let initialSlots: SlotWithEmployee[] = [];
  if (effectiveServiceId && !needsEmployeeStep) {
    try {
      const slots = await getAvailableSlots(supabase, {
        businessId: business.id,
        serviceId: effectiveServiceId,
        date: today,
        employeeId: null,
      });
      initialSlots = slots.map((slot) => ({ ...slot, employeeId: undefined }));
    } catch {
      initialSlots = [];
    }
  }

  return (
    <main className="min-h-screen bg-surface">
      <div className="container-app max-w-xl py-10">
        <div className="mb-8">
          <Link href={`/negocio/${params.slug}`} className="text-sm text-ink-500 hover:text-ink-800">
            ← {business.name}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">Reservar cita</h1>
        </div>

        {!accountProfile ? (
          <CustomerAuthForm
            initialMode="login"
            redirectTo={redirectTo}
            title="Inicia sesión para reservar"
            description={`Para reservar en ${business.name} hace falta una cuenta gratuita — así tampoco tendrás que volver a escribir tus datos la próxima vez.`}
          />
        ) : (
          <BookingWizard
            slug={params.slug}
            businessId={business.id}
            businessName={business.name}
            timezone={business.timezone}
            businessAddress={business.address}
            managerName={business.manager_display_name ?? business.name}
            managerPhotoUrl={business.manager_photo_url}
            services={services}
            initialServiceId={effectiveServiceId}
            initialDate={today}
            initialSlots={initialSlots}
            accountProfile={accountProfile}
            replaceBookingId={replaceBookingId}
          />
        )}
      </div>
    </main>
  );
}
