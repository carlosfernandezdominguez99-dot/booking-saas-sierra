import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicBusinessBySlug } from "@/lib/services/publicBusinessService";
import { getCustomerToken } from "@/lib/services/customerSession";
import { getCustomerPortalData } from "@/lib/services/customerPortalService";
import { createClient } from "@/lib/supabase/server";
import { RequestAccessForm } from "@/components/public/RequestAccessForm";
import { CustomerPortal } from "@/components/public/CustomerPortal";

interface PageProps {
  params: { slug: string };
  searchParams: { error?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await getPublicBusinessBySlug(params.slug);
  return { title: result ? `Mis citas · ${result.business.name}` : "Negocio no encontrado" };
}

// Portal del cliente (Fase 7.2) — sin cuenta ni contraseña: si hay una
// cookie de sesión válida (ver `customerSession.ts`) para ESTE negocio, se
// pinta el panel directamente; si no, un formulario para pedir un enlace
// de acceso nuevo por email.
export default async function MisCitasPage({ params, searchParams }: PageProps) {
  const result = await getPublicBusinessBySlug(params.slug);
  if (!result) notFound();
  const { business, services } = result;

  const token = await getCustomerToken(business.id);

  let portalData = null;
  if (token) {
    const supabase = await createClient();
    portalData = await getCustomerPortalData(supabase, token);
  }

  return (
    <main className="min-h-screen bg-surface">
      <div className="container-app max-w-md py-12">
        {!portalData && (
          <div className="mb-6">
            <Link href={`/negocio/${params.slug}`} className="text-sm text-ink-500 hover:text-ink-800">
              ← {business.name}
            </Link>
          </div>
        )}

        {portalData ? (
          <CustomerPortal
            slug={params.slug}
            data={portalData}
            services={services.map((s) => ({ id: s.id, name: s.name }))}
          />
        ) : (
          <RequestAccessForm
            slug={params.slug}
            businessName={business.name}
            invalidLink={searchParams.error === "enlace_invalido" || Boolean(token)}
          />
        )}
      </div>
    </main>
  );
}
