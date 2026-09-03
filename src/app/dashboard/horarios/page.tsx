import { requireBusinessContext } from "@/lib/services/authContext";
import { hoursRowsToWeekly, listBusinessHours } from "@/lib/services/hoursService";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { HoursEditor } from "@/components/dashboard/HoursEditor";

export default async function HorariosPage() {
  const { supabase, business } = await requireBusinessContext();
  const rows = await listBusinessHours(supabase, business.id);
  const weeklyHours = hoursRowsToWeekly(rows);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Horarios</h1>

      <Card>
        <CardTitle>Horario de apertura</CardTitle>
        <CardDescription className="mb-4">
          Define en qué franjas puede reservar tu negocio. Los huecos disponibles para reservar se
          calculan a partir de este horario y de la duración de cada servicio.
        </CardDescription>
        <HoursEditor initialHours={weeklyHours} />
      </Card>
    </div>
  );
}
