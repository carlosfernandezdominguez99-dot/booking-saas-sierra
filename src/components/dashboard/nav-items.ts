export interface DashboardNavItem {
  href: string;
  label: string;
  icon: "home" | "calendar" | "list" | "users" | "scissors" | "clock" | "user-group" | "settings";
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard/inicio", label: "Inicio", icon: "home" },
  { href: "/dashboard/calendario", label: "Calendario", icon: "calendar" },
  { href: "/dashboard/reservas", label: "Reservas", icon: "list" },
  { href: "/dashboard/clientes", label: "Clientes", icon: "users" },
  { href: "/dashboard/servicios", label: "Servicios", icon: "scissors" },
  { href: "/dashboard/horarios", label: "Horarios", icon: "clock" },
  { href: "/dashboard/empleados", label: "Empleados", icon: "user-group" },
  { href: "/dashboard/configuracion", label: "Configuración", icon: "settings" },
];
