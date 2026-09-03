"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { DASHBOARD_NAV_ITEMS } from "./nav-items";
import { Icon } from "./Icon";

export function Sidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-white px-4 py-6 md:flex">
      <div className="mb-8 px-2">
        <p className="text-sm font-semibold tracking-tight text-ink-900">
          Zoria<span className="text-brand-500">Booking</span>
        </p>
        <p className="mt-1 truncate text-xs text-ink-500">{businessName}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {DASHBOARD_NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
