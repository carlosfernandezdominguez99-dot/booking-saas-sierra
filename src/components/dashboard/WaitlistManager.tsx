"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input, FieldError } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils/cn";
import { addToWaitlistAction, deleteWaitlistEntryAction } from "@/app/dashboard/lista-espera/actions";
import type { WaitlistEntryWithDetails } from "@/lib/services/waitlistService";

const STATUS_LABELS: Record<WaitlistEntryWithDetails["status"], { label: string; className: string }> = {
  waiting: { label: "Esperando", className: "bg-ink-100 text-ink-600" },
  offered: { label: "Oferta enviada", className: "bg-amber-100 text-amber-700" },
  accepted: { label: "Aceptó", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rechazó", className: "bg-ink-100 text-ink-400" },
  expired: { label: "Caducó", className: "bg-ink-100 text-ink-400" },
};

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatOfferedSlot(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
}

const EMPTY_DRAFT = { customerName: "", customerPhone: "", serviceId: "", preferredDate: "" };

export function WaitlistManager({
  initialEntries,
  services,
  timezone,
  today,
}: {
  initialEntries: WaitlistEntryWithDetails[];
  services: { id: string; name: string }[];
  timezone: string;
  today: string;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setFormError(null);
    startTransition(async () => {
      const result = await addToWaitlistAction(draft);
      if (result.error || !result.data) {
        setFormError(result.error ?? "No se pudo añadir.");
        return;
      }
      setEntries((prev) => [result.data!, ...prev]);
      setDraft(EMPTY_DRAFT);
    });
  }

  function handleDelete(entryId: string) {
    setRowError((prev) => ({ ...prev, [entryId]: "" }));
    startTransition(async () => {
      const result = await deleteWaitlistEntryAction(entryId);
      if (result.error) {
        setRowError((prev) => ({ ...prev, [entryId]: result.error! }));
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-dashed border-ink-200 p-4">
        <p className="mb-3 text-sm font-medium text-ink-900">Añadir a la lista de espera</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nombre</Label>
            <Input
              value={draft.customerName}
              onChange={(e) => setDraft((d) => ({ ...d, customerName: e.target.value }))}
              placeholder="Nombre del cliente"
            />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input
              value={draft.customerPhone}
              onChange={(e) => setDraft((d) => ({ ...d, customerPhone: e.target.value }))}
              placeholder="+34 600 000 000"
            />
          </div>
          <div>
            <Label>Servicio</Label>
            <select
              value={draft.serviceId}
              onChange={(e) => setDraft((d) => ({ ...d, serviceId: e.target.value }))}
              className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
            >
              <option value="">Elige un servicio…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Día que quiere</Label>
            <Input
              type="date"
              min={today}
              value={draft.preferredDate}
              onChange={(e) => setDraft((d) => ({ ...d, preferredDate: e.target.value }))}
            />
          </div>
        </div>
        <FieldError message={formError ?? undefined} />
        <Button type="button" className="mt-3" size="sm" disabled={isPending} onClick={handleAdd}>
          Añadir
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">
          No hay nadie en la lista de espera todavía.
        </p>
      ) : (
        <div className="space-y-2.5">
          {entries.map((entry) => {
            const statusInfo = STATUS_LABELS[entry.status];
            return (
              <div key={entry.id} className="rounded-xl border border-ink-100 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{entry.customerName}</p>
                    <p className="text-sm text-ink-500">
                      {entry.serviceName} · quiere el {formatDate(entry.preferredDate)}
                    </p>
                    {entry.status === "offered" && entry.offeredStartTime && (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Oferta: {formatOfferedSlot(entry.offeredStartTime, timezone)}
                      </p>
                    )}
                    {rowError[entry.id] && <p className="mt-1 text-xs text-red-600">{rowError[entry.id]}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusInfo.className)}>
                      {statusInfo.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      disabled={isPending}
                      className="text-xs font-medium text-ink-400 hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
