import { requireBusinessContext } from "@/lib/services/authContext";
import { listServices } from "@/lib/services/servicesService";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { ServicesManager } from "@/components/dashboard/ServicesManager";

export default async function ServiciosPage() {
  const { supabase, business } = await requireBusinessContext();
  const services = await listServices(supabase, business.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Servicios</h1>

      <Card>
        <CardTitle>Tus servicios</CardTitle>
        <CardDescription className="mb-4">
          Estos son los servicios que verán tus clientes al reservar. Puedes ocultar uno sin
          borrarlo si dejas de ofrecerlo temporalmente.
        </CardDescription>
        <ServicesManager initialServices={services} />
      </Card>
    </div>
  );
}
