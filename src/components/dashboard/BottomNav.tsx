"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Icon } from "./Icon";

const MOBILE_ITEMS = [
  { href: "/dashboard/inicio", label: "Inicio", icon: "home" as const },
  { href: "/dashboard/calendario", label: "Calendario", icon: "calendar" as const },
  { href: "/dashboard/reservas", label: "Reservas", icon: "list" as const },
  { href: "/dashboard/clientes", label: "Clientes", icon: "users" as const },
  { href: "/dashboard/configuracion", label: "Ajustes", icon: "settings" as const },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-white/95 backdrop-blur-md md:hidden">
      {MOBILE_ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
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
    </nav>
  );
}
