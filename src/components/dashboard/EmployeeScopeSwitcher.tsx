"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { setActiveEmployeeScopeAction } from "@/app/dashboard/scopeActions";

interface Person {
  key: string;
  label: string;
  photoUrl: string | null;
}

/**
 * Selector de "de quién es este panel" (Fase 10): un círculo por "Todos",
 * otro por el gerente y otro por cada empleado — con su foto si tiene, o
 * sus iniciales. Al elegir uno, todo el panel (Calendario, Reservas,
 * Estadísticas, Lista de espera, Clientes, Configuración…) pasa a mostrar
 * solo lo suyo, hasta que se cambie de círculo otra vez. Se guarda en una
 * cookie (`setActiveEmployeeScopeAction`), así que aplica en cualquier
 * página sin tener que llevarlo a mano en cada enlace — de ahí el
 * `router.refresh()` tras guardarla, en vez de navegar a ningún sitio.
 */
export function EmployeeScopeSwitcher({
  employees,
  managerName,
  managerPhotoUrl,
  activeKey,
}: {
  employees: { id: string; name: string; photoUrl: string | null }[];
  managerName: string;
  managerPhotoUrl: string | null;
  /** "all" | "manager" | el id de un empleado. */
  activeKey: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function select(value: string) {
    if (value === activeKey || isPending) return;
    startTransition(async () => {
      await setActiveEmployeeScopeAction(value);
      router.refresh();
    });
  }

  const people: Person[] = [
    { key: "manager", label: managerName, photoUrl: managerPhotoUrl },
    ...employees.map((e) => ({ key: e.id, label: e.name, photoUrl: e.photoUrl })),
  ];

  return (
    <div className={cn("flex items-center gap-3 overflow-x-auto pb-0.5", isPending && "opacity-60")}>
      <button
        type="button"
        onClick={() => select("all")}
        disabled={isPending}
        className="flex shrink-0 flex-col items-center gap-1"
      >
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border-2 text-ink-500 transition-colors",
            activeKey === "all" ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-ink-50 hover:border-ink-300",
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </span>
        <span className={cn("text-[11px] font-medium", activeKey === "all" ? "text-ink-900" : "text-ink-400")}>Todos</span>
      </button>

      {people.map((person) => (
        <button
          key={person.key}
          type="button"
          onClick={() => select(person.key)}
          disabled={isPending}
          className="flex shrink-0 flex-col items-center gap-1"
        >
          {person.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.photoUrl}
              alt={person.label}
              className={cn(
                "h-11 w-11 rounded-full border-2 object-cover",
                activeKey === person.key ? "border-ink-900" : "border-transparent",
              )}
            />
          ) : (
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                activeKey === person.key
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-transparent bg-ink-100 text-ink-600 hover:bg-ink-200",
              )}
            >
              {person.label.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className={cn("max-w-[4.5rem] truncate text-[11px] font-medium", activeKey === person.key ? "text-ink-900" : "text-ink-400")}>
            {person.label}
          </span>
        </button>
      ))}
    </div>
  );
}
