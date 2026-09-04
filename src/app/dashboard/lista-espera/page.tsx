import { requireBusinessContext } from "@/lib/services/authContext";
import { listWaitlist } from "@/lib/services/waitlistService";
import { listServices } from "@/lib/services/servicesService";
import { todayInTimezone } from "@/lib/utils/timezone";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { WaitlistManager } from "@/components/dashboard/WaitlistManager";

export default async function ListaEsperaPage() {
  const { supabase, business } = await requireBusinessContext();

  const [entries, services] = await Promise.all([
    listWaitlist(supabase, { businessId: business.id }),
    listServices(supabase, business.id),
  ]);

  const activeServices = services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Lista de espera</h1>
        <p className="mt-1 text-sm text-ink-500">
          Cuando se cancela una cita, se avisa en orden a quien esté esperando ese día un servicio
          que quepa en el hueco liberado.
        </p>
      </div>

      <Card>
        <CardTitle>Quién está esperando</CardTitle>
        <CardDescription className="mb-4">
          Añade a alguien a mano (por ejemplo, tras una llamada) o espera a que se apunte solo
          cuando esa función esté conectada a WhatsApp.
        </CardDescription>
        <WaitlistManager
          initialEntries={entries}
          services={activeServices}
          timezone={business.timezone}
          today={todayInTimezone(business.timezone)}
        />
      </Card>
    </div>
  );
}
