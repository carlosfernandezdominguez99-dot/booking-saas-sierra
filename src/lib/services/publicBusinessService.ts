import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Ver el comentario detallado en `authContext.ts`: con los tipos de
// Supabase escritos a mano, forzar aquí el tipo explícito del resultado
// evita depender de una inferencia automática de `.select(...)` que en
// algunos casos concretos colapsaba a `never` en el build de Vercel.
export type PublicBusiness = Pick<
  Database["public"]["Tables"]["businesses"]["Row"],
  | "id"
  | "name"
  | "description"
  | "logo_url"
  | "address"
  | "city"
  | "business_type"
  | "timezone"
  | "manager_display_name"
>;

export type PublicEmployee = Pick<Database["public"]["Tables"]["employees"]["Row"], "id" | "name" | "photo_url">;

export type PublicService = Pick<
  Database["public"]["Tables"]["services"]["Row"],
  "id" | "name" | "description" | "price_cents" | "duration_minutes"
> & {
  /**
   * Empleados activos asignados a este servicio (vacío si el negocio no
   * usa empleados, o si a este servicio en concreto no se le asignó
   * ninguno). Con 0 empleados, reservar sigue funcionando exactamente
   * igual que siempre (horario/hueco general del negocio, sin pedir
   * elegir a nadie) — solo con 1+ se enseña el paso "Elige con quién".
   */
  employees: PublicEmployee[];
};

/**
 * Negocio + servicios activos vistos desde la página pública (sin sesión,
 * cliente `anon`, sujeto a las políticas RLS de lectura pública). La usan
 * tanto `/negocio/[slug]` como `/negocio/[slug]/reservar` (Fase 5) — vive
 * en un solo sitio para no duplicar la consulta ni sus tipos.
 */
export async function getPublicBusinessBySlug(
  slug: string,
): Promise<{ business: PublicBusiness; services: PublicService[] } | null> {
  const supabase = await createClient();

  const { data: business } = (await supabase
    .from("businesses")
    .select("id, name, description, logo_url, address, city, business_type, timezone, manager_display_name")
    .eq("slug", slug)
    .maybeSingle()) as unknown as { data: PublicBusiness | null };

  if (!business) return null;

  const { data: servicesData } = (await supabase
    .from("services")
    .select("id, name, description, price_cents, duration_minutes")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("position", { ascending: true })) as unknown as { data: PublicService[] | null };

  const services = servicesData ?? [];

  // Empleados activos + qué servicios hace cada uno — dos consultas
  // planas + merge en memoria (mismo motivo de siempre: los tipos de
  // Supabase están escritos a mano, sin metadatos de relaciones para
  // selects anidados). Se traen de una vez para todos los servicios del
  // negocio, no uno por servicio.
  if (services.length > 0) {
    const { data: employees } = (await supabase
      .from("employees")
      .select("id, name, photo_url")
      .eq("business_id", business.id)
      .eq("active", true)) as unknown as { data: PublicEmployee[] | null };

    if (employees && employees.length > 0) {
      const employeeIds = employees.map((e) => e.id);
      const { data: assignments } = (await (supabase.from("employee_services") as any)
        .select("employee_id, service_id")
        .in("employee_id", employeeIds)
        .in(
          "service_id",
          services.map((s) => s.id),
        )) as unknown as { data: { employee_id: string; service_id: string }[] | null };

      const employeeById = new Map(employees.map((e) => [e.id, e]));
      const employeeIdsByService = new Map<string, string[]>();
      for (const row of assignments ?? []) {
        const list = employeeIdsByService.get(row.service_id) ?? [];
        list.push(row.employee_id);
        employeeIdsByService.set(row.service_id, list);
      }

      for (const service of services) {
        service.employees = (employeeIdsByService.get(service.id) ?? [])
          .map((id) => employeeById.get(id))
          .filter((e): e is PublicEmployee => Boolean(e));
      }
    } else {
      for (const service of services) service.employees = [];
    }
  }

  return { business, services };
}

export type PartnerBusiness = Pick<Database["public"]["Tables"]["businesses"]["Row"], "id" | "name" | "slug" | "logo_url">;

/**
 * Negocios reales que ya usan la app, para la sección "Negocios que ya
 * confían en nosotros" de la landing (`/`) — hasta `limit` (por defecto
 * 5), los más antiguos primero. Solo negocios que terminaron el
 * onboarding (si no, mostraría altas a medias sin servicios ni nada que
 * enseñar) — RLS ya limita la lectura pública a `subscription_status in
 * ('trial', 'active')`, así que no hace falta repetirlo aquí.
 */
export async function getPartnerBusinesses(limit = 5): Promise<PartnerBusiness[]> {
  const supabase = await createClient();

  const { data } = (await supabase
    .from("businesses")
    .select("id, name, slug, logo_url")
    .not("onboarding_completed_at", "is", null)
    .order("onboarding_completed_at", { ascending: true })
    .limit(limit)) as unknown as { data: PartnerBusiness[] | null };

  return data ?? [];
}
