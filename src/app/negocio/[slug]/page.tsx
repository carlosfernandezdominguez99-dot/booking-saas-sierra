import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicBusinessBySlug } from "@/lib/services/publicBusinessService";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await getPublicBusinessBySlug(params.slug);
  return { title: result?.business.name ?? "Negocio no encontrado" };
}

export default async function PublicBusinessPage({ params }: PageProps) {
  const result = await getPublicBusinessBySlug(params.slug);

  if (!result) notFound();
  const { business, services } = result;

  return (
    <main className="min-h-screen bg-surface">
      <div className="container-app max-w-2xl py-12">
        <div className="mb-10 text-center">
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo_url}
              alt={business.name}
              className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-900 text-xl font-semibold text-white">
              {business.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-ink-950">{business.name}</h1>
          {business.city && <p className="mt-1 text-sm text-ink-500">{business.city}</p>}
          {business.description && (
            <p className="mx-auto mt-3 max-w-md text-sm text-ink-500">{business.description}</p>
          )}
        </div>

        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Servicios
        </h2>

        {services.length === 0 ? (
          <Card className="border-dashed py-12 text-center text-sm text-ink-400">
            Este negocio todavía no ha publicado servicios.
          </Card>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <Card key={service.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-ink-900">{service.name}</p>
                  <p className="text-sm text-ink-500">{service.duration_minutes} min</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="font-semibold text-ink-900">{(service.price_cents / 100).toFixed(2)} €</p>
                  <Link href={`/negocio/${params.slug}/reservar?servicio=${service.id}`}>
                    <Button type="button" size="sm">
                      Reservar
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}

        {services.length > 0 && (
          <p className="mt-8 text-center">
            <Link
              href={`/negocio/${params.slug}/reservar`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Ver todos los huecos disponibles →
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
