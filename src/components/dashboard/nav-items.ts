import type { BusinessMemberRole } from "@/types/database.types";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon:
    | "home"
    | "calendar"
    | "list"
    | "users"
    | "scissors"
    | "clock"
    | "user-group"
    | "settings"
    | "chart"
    | "more"
    | "waitlist";
  /**
   * A qué roles se les enseña este punto de menú. Sin esto, a todos
   * (comportamiento de siempre). Un empleado con acceso propio (`staff`)
   * solo gestiona lo suyo — no ve secciones de todo el negocio como
   * Servicios, Empleados, Estadísticas, Lista de espera o Configuración.
   */
  roles?: BusinessMemberRole[];
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard/inicio", label: "Inicio", icon: "home" },
  { href: "/dashboard/calendario", label: "Calendario", icon: "calendar" },
  { href: "/dashboard/reservas", label: "Reservas", icon: "list" },
  { href: "/dashboard/clientes", label: "Clientes", icon: "users" },
  { href: "/dashboard/servicios", label: "Servicios", icon: "scissors", roles: ["owner"] },
  { href: "/dashboard/horarios", label: "Horarios", icon: "clock" },
  { href: "/dashboard/empleados", label: "Empleados", icon: "user-group", roles: ["owner"] },
  { href: "/dashboard/estadisticas", label: "Estadísticas", icon: "chart", roles: ["owner"] },
  { href: "/dashboard/lista-espera", label: "Lista de espera", icon: "waitlist", roles: ["owner"] },
  { href: "/dashboard/configuracion", label: "Configuración", icon: "settings", roles: ["owner"] },
];

export function navItemsForRole(role: BusinessMemberRole): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
