import { Card } from "@/components/ui/Card";

/**
 * Se muestra al instante en cuanto se hace clic en cualquier enlace del
 * panel (Next.js la usa como "fallback" mientras la página de destino —
 * calendario, reservas, estadísticas... — todavía está resolviendo sus
 * datos en el servidor). Sin este archivo, la pantalla se queda "congelada"
 * con el contenido anterior durante ese tiempo de espera, que es justo lo
 * que se percibía como lentitud al cambiar de vista o de fecha en el
 * calendario: cada clic dispara varias consultas a Supabase (comprobar
 * sesión, negocio, reservas...) y sin esta pantalla de carga no había
 * ninguna señal visual de que algo estaba pasando.
 *
 * Al vivir en `src/app/dashboard/loading.tsx` (justo al lado del layout),
 * Next.js la usa como pantalla de carga para CUALQUIER página dentro de
 * `/dashboard` — inicio, calendario, reservas, clientes, estadísticas,
 * etc. — no hace falta repetirla en cada una.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-ink-100" />

      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
            <div className="mt-3 h-7 w-12 animate-pulse rounded bg-ink-100" />
          </Card>
        ))}
      </div>

      <Card>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-14 animate-pulse rounded-lg bg-ink-100" />
              <div className="h-4 flex-1 animate-pulse rounded bg-ink-100" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
