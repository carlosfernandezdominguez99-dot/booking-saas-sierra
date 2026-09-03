"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  bookingsCount: number;
  lastVisit: string | null;
}

function formatLastVisit(iso: string | null, timezone: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { timeZone: timezone, day: "2-digit", month: "short", year: "numeric" });
}

export function CustomersTable({ customers, timezone }: { customers: CustomerRow[]; timezone: string }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por nombre o teléfono..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {customers.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">
          Todavía no tienes clientes — aparecerán aquí en cuanto reciban su primera reserva.
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">Ningún cliente coincide con esa búsqueda.</p>
      ) : (
        <div className="overflow-x-auto">
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
              {filtered.map((customer) => (
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
      )}
    </div>
  );
}
