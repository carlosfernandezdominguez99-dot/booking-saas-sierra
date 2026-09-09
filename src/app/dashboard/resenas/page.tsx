import { requireBusinessContext } from "@/lib/services/authContext";
import { listReviews } from "@/lib/services/reviewsService";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" aria-label={`${rating} de 5 estrellas`}>
      {"★".repeat(rating)}
      <span className="text-ink-200">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

/**
 * Panel para ver las reseñas de la Fase 9.3 — solo lectura, sin
 * agregados públicos todavía (eso queda fuera de alcance por ahora).
 * Incluye las pendientes (enlace mandado, sin responder) para que el
 * gerente vea de un vistazo a cuántos clientes se les ha pedido opinión.
 */
export default async function ResenasPage() {
  const { supabase, business } = await requireBusinessContext();
  const reviews = await listReviews(supabase, business.id);

  const submitted = reviews.filter((r) => r.submittedAt);
  const pending = reviews.filter((r) => !r.submittedAt);
  const avgRating =
    submitted.length > 0
      ? submitted.reduce((sum, r) => sum + (r.rating ?? 0), 0) / submitted.length
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Reseñas</h1>
        <p className="mt-1 text-sm text-ink-500">
          El enlace para opinar se manda solo cuando un cliente termina su primera cita contigo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardDescription>Puntuación media</CardDescription>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">
            {avgRating !== null ? avgRating.toFixed(1) : "—"}
          </p>
        </Card>
        <Card>
          <CardDescription>Reseñas recibidas</CardDescription>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">{submitted.length}</p>
        </Card>
        <Card>
          <CardDescription>Pendientes de responder</CardDescription>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">{pending.length}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Opiniones de clientes</CardTitle>
        <CardDescription className="mb-4">Las más recientes primero.</CardDescription>
        {submitted.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">
            Todavía no ha respondido ningún cliente — en cuanto lo haga, aparecerá aquí.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {submitted.map((r) => (
              <li key={r.id} className="py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink-900">{r.customerName}</span>
                  <Stars rating={r.rating ?? 0} />
                </div>
                {r.comment && <p className="mt-1.5 text-sm text-ink-600">{r.comment}</p>}
                <p className="mt-1.5 text-xs text-ink-400">
                  {r.submittedAt ? formatDate(r.submittedAt) : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardTitle>Pendientes</CardTitle>
          <CardDescription className="mb-4">
            Se les mandó el enlace pero todavía no han opinado.
          </CardDescription>
          <ul className="divide-y divide-ink-100">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-ink-900">{r.customerName}</span>
                <span className="text-ink-400">Pedida el {formatDate(r.requestedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
