"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  bookingsCount: number;
  lastVisit: string | null;
}

const PAGE_SIZE_OPTIONS = [5, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 20;

function formatLastVisit(iso: string | null, timezone: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { timeZone: timezone, day: "2-digit", month: "short", year: "numeric" });
}

export function CustomersTable({ customers, timezone }: { customers: CustomerRow[]; timezone: string }) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Si la búsqueda o el tamaño de página cambian y la página actual deja de
  // tener sentido (por ejemplo, estabas en la página 4 y ahora solo hay 2),
  // se vuelve a la página 1 en vez de mostrar una página vacía.
  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por nombre o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <div className="flex items-center gap-1.5 text-sm text-ink-500">
          <span className="whitespace-nowrap">Por página:</span>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setPageSize(size)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                pageSize === size ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200",
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {customers.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">
          Todavía no tienes clientes — aparecerán aquí en cuanto reciban su primera reserva.
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">Ningún cliente coincide con esa búsqueda.</p>
      ) : (
        <>
          {/* Escritorio/tablet: tabla normal. En móvil se oculta y se */}
          {/* sustituye por tarjetas (debajo) — una tabla con 4 columnas no */}
          {/* cabe en una pantalla estrecha sin cortarse o requerir scroll */}
          {/* horizontal. */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="pb-2 pr-4 font-medium">Nombre</th>
                  <th className="pb-2 pr-4 font-medium">Teléfono</th>
                  <th className="pb-2 pr-4 font-medium">Reservas</th>
                  <th className="pb-2 font-medium">Última visita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {paged.map((customer) => (
                  <tr key={customer.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink-900">{customer.name}</p>
                      {customer.email && <p className="text-xs text-ink-400">{customer.email}</p>}
                    </td>
                    <td className="py-3 pr-4 text-ink-700">{customer.phone}</td>
                    <td className="py-3 pr-4 text-ink-700">{customer.bookingsCount}</td>
                    <td className="py-3 text-ink-700">{formatLastVisit(customer.lastVisit, timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: una tarjeta por cliente, sin scroll horizontal. */}
          <div className="space-y-2.5 sm:hidden">
            {paged.map((customer) => (
              <div key={customer.id} className="rounded-xl border border-ink-100 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{customer.name}</p>
                    <p className="text-sm text-ink-500">{customer.phone}</p>
                    {customer.email && <p className="truncate text-xs text-ink-400">{customer.email}</p>}
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink-500">
                    <p className="text-sm font-semibold text-ink-900">{customer.bookingsCount}</p>
                    <p>{customer.bookingsCount === 1 ? "reserva" : "reservas"}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink-400">
                  Última visita: {formatLastVisit(customer.lastVisit, timezone)}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-ink-400">
              {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"} · página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Anterior
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente →
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
