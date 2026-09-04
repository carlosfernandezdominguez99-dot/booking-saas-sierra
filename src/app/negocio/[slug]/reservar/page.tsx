import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublicBusinessBySlug } from "@/lib/services/publicBusinessService";
import { getAvailableSlots, type AvailableSlot } from "@/lib/services/availabilityService";
import { todayInTimezone } from "@/lib/utils/timezone";
import { BookingWizard } from "@/components/public/BookingWizard";

interface PageProps {
  params: { slug: string };
  searchParams: { servicio?: string };
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

  let initialSlots: AvailableSlot[] = [];
  if (effectiveServiceId) {
    const supabase = await createClient();
    try {
      initialSlots = await getAvailableSlots(supabase, {
        businessId: business.id,
        serviceId: effectiveServiceId,
        date: today,
      });
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

        <BookingWizard
          slug={params.slug}
          businessId={business.id}
          businessName={business.name}
          timezone={business.timezone}
          services={services}
          initialServiceId={effectiveServiceId}
          initialDate={today}
          initialSlots={initialSlots}
        />
      </div>
    </main>
  );
}
