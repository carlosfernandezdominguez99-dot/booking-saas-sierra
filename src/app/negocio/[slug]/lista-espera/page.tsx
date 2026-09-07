import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicBusinessBySlug } from "@/lib/services/publicBusinessService";
import { todayInTimezone } from "@/lib/utils/timezone";
import { WaitlistJoinForm } from "@/components/public/WaitlistJoinForm";

interface PageProps {
  params: { slug: string };
  searchParams: { servicio?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await getPublicBusinessBySlug(params.slug);
  return { title: result ? `Lista de espera · ${result.business.name}` : "Negocio no encontrado" };
}

// Página pública para apuntarse a la lista de espera sin haber reservado
// antes (o sin sesión de portal todavía) — enlazada desde el asistente de
// reserva cuando no hay huecos ese día, y desde la página del negocio.
export default async function ListaEsperaPublicaPage({ params, searchParams }: PageProps) {
  const result = await getPublicBusinessBySlug(params.slug);
  if (!result) notFound();
  const { business, services } = result;

  const queryServiceId = searchParams.servicio;
  const effectiveServiceId =
    (queryServiceId && services.some((s) => s.id === queryServiceId) ? queryServiceId : null) ??
    (services.length === 1 ? services[0].id : null);

  const today = todayInTimezone(business.timezone);

  return (
    <main className="min-h-screen bg-surface">
      <div className="container-app max-w-xl py-10">
        <div className="mb-8">
          <Link href={`/negocio/${params.slug}`} className="text-sm text-ink-500 hover:text-ink-800">
            ← {business.name}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">Lista de espera</h1>
          <p className="mt-1 text-sm text-ink-500">
            Te avisaremos por email en cuanto se libere un hueco que encaje.
          </p>
        </div>

        <WaitlistJoinForm
          slug={params.slug}
          businessName={business.name}
          services={services.map((s) => ({ id: s.id, name: s.name }))}
          today={today}
          initialServiceId={effectiveServiceId}
        />
      </div>
    </main>
  );
}
