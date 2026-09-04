"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Icon } from "./Icon";

// Solo lo más usado va fijo abajo — el resto vive dentro de "Más" para que
// la barra no se quede apretada ni se corten etiquetas en pantallas
// estrechas.
const PRIMARY_ITEMS = [
  { href: "/dashboard/inicio", label: "Inicio", icon: "home" as const },
  { href: "/dashboard/calendario", label: "Calendario", icon: "calendar" as const },
  { href: "/dashboard/reservas", label: "Reservas", icon: "list" as const },
  { href: "/dashboard/clientes", label: "Clientes", icon: "users" as const },
];

const MORE_ITEMS = [
  { href: "/dashboard/estadisticas", label: "Estadísticas", icon: "chart" as const },
  { href: "/dashboard/servicios", label: "Servicios", icon: "scissors" as const },
  { href: "/dashboard/horarios", label: "Horarios", icon: "clock" as const },
  { href: "/dashboard/empleados", label: "Empleados", icon: "user-group" as const },
  { href: "/dashboard/configuracion", label: "Configuración", icon: "settings" as const },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Si el usuario navega (por ejemplo, tocando un enlace dentro del menú
  // "Más"), el menú se cierra solo en vez de quedar abierto de fondo.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const moreActive = MORE_ITEMS.some((item) => pathname?.startsWith(item.href));

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink-950/30 md:hidden"
        />
      )}

      {open && (
        <div className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-lg md:hidden">
          {MORE_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm font-medium",
                  active ? "bg-ink-900 text-white" : "text-ink-700 active:bg-ink-50",
                )}
              >
                <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {PRIMARY_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-ink-900" : "text-ink-400",
              )}
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
            open || moreActive ? "text-ink-900" : "text-ink-400",
          )}
        >
          <Icon name="more" className="h-5 w-5" />
          Más
        </button>
      </nav>
    </>
  );
}
