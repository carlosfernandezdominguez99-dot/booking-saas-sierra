"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import type { Database } from "@/types/database.types";
import {
  createServiceAction,
  deleteServiceAction,
  toggleServiceActiveAction,
  updateServiceAction,
} from "@/app/dashboard/servicios/actions";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

type DraftService = { name: string; description: string; priceEuros: string; durationMinutes: string };
const EMPTY_DRAFT: DraftService = { name: "", description: "", priceEuros: "", durationMinutes: "30" };

function parseDraft(draft: DraftService) {
  return {
    name: draft.name,
    description: draft.description,
    priceEuros: Number(draft.priceEuros.replace(",", ".")),
    durationMinutes: Number(draft.durationMinutes),
  };
}

function serviceToDraft(service: ServiceRow): DraftService {
  return {
    name: service.name,
    description: service.description ?? "",
    priceEuros: String(service.price_cents / 100),
    durationMinutes: String(service.duration_minutes),
  };
}

/**
 * Lista + alta/edición/baja de servicios. Se usa tanto en
 * `/dashboard/servicios` como en el paso 2 del asistente de onboarding:
 * en ambos casos el negocio ya existe, así que cada cambio se guarda al
 * momento (no hay un estado "sin guardar" que perder).
 */
export function ServicesManager({ initialServices }: { initialServices: ServiceRow[] }) {
  const [services, setServices] = useState(initialServices);
  const [draft, setDraft] = useState<DraftService>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftService>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setError(null);
    const parsed = parseDraft(draft);

    startTransition(async () => {
      const result = await createServiceAction(parsed);
      if (result.error || !result.data) {
        setError(result.error ?? "No se pudo crear el servicio.");
        return;
      }
      setServices((prev) => [...prev, result.data!]);
      setDraft(EMPTY_DRAFT);
    });
  }

  function handleToggleActive(service: ServiceRow) {
    setError(null);
    const nextActive = !service.active;
    setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, active: nextActive } : s)));

    startTransition(async () => {
      const result = await toggleServiceActiveAction(service.id, nextActive);
      if (result.error) {
        setError(result.error);
        setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, active: !nextActive } : s)));
      }
    });
  }

  function handleDelete(serviceId: string) {
    setError(null);
    const previous = services;
    setServices((prev) => prev.filter((s) => s.id !== serviceId));

    startTransition(async () => {
      const result = await deleteServiceAction(serviceId);
      if (result.error) {
        setError(result.error);
        setServices(previous);
      }
    });
  }

  function startEdit(service: ServiceRow) {
    setError(null);
    setEditingId(service.id);
    setEditDraft(serviceToDraft(service));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleSaveEdit(serviceId: string) {
    setError(null);
    const parsed = parseDraft(editDraft);

    startTransition(async () => {
      const result = await updateServiceAction(serviceId, parsed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId
            ? {
                ...s,
                name: parsed.name,
                description: parsed.description || null,
                price_cents: Math.round(parsed.priceEuros * 100),
                duration_minutes: parsed.durationMinutes,
              }
            : s,
        ),
      );
      setEditingId(null);
    });
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      {services.length > 0 && (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
          {services.map((service) =>
            editingId === service.id ? (
              <li key={service.id} className="space-y-3 px-4 py-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor={`edit-name-${service.id}`}>Nombre</Label>
                    <Input
                      id={`edit-name-${service.id}`}
                      value={editDraft.name}
                      onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`edit-price-${service.id}`}>Precio (€)</Label>
                    <Input
                      id={`edit-price-${service.id}`}
                      inputMode="decimal"
                      value={editDraft.priceEuros}
                      onChange={(e) => setEditDraft((d) => ({ ...d, priceEuros: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`edit-duration-${service.id}`}>Duración (min)</Label>
                    <Input
                      id={`edit-duration-${service.id}`}
                      inputMode="numeric"
                      value={editDraft.durationMinutes}
                      onChange={(e) => setEditDraft((d) => ({ ...d, durationMinutes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    loading={isPending}
                    disabled={!editDraft.name.trim() || !editDraft.priceEuros}
                    onClick={() => handleSaveEdit(service.id)}
                  >
                    Guardar
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                </div>
              </li>
            ) : (
              <li key={service.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <button
                  type="button"
                  onClick={() => startEdit(service)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-ink-900">{service.name}</p>
                  <p className="text-xs text-ink-500">
                    {formatPrice(service.price_cents)} · {service.duration_minutes} min
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(service)}
                    disabled={isPending}
                    className={
                      service.active
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-500"
                    }
                  >
                    {service.active ? "Activo" : "Oculto"}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDelete(service.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <div className="rounded-xl border border-dashed border-ink-200 p-4">
        <p className="mb-3 text-sm font-medium text-ink-700">Añadir servicio</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="service-name">Nombre</Label>
            <Input
              id="service-name"
              placeholder="Ej. Corte de pelo"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="service-price">Precio (€)</Label>
            <Input
              id="service-price"
              inputMode="decimal"
              placeholder="15"
              value={draft.priceEuros}
              onChange={(e) => setDraft((d) => ({ ...d, priceEuros: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="service-duration">Duración (min)</Label>
            <Input
              id="service-duration"
              inputMode="numeric"
              placeholder="30"
              value={draft.durationMinutes}
              onChange={(e) => setDraft((d) => ({ ...d, durationMinutes: e.target.value }))}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          loading={isPending}
          disabled={!draft.name.trim() || !draft.priceEuros}
          onClick={handleAdd}
        >
          Añadir servicio
        </Button>
      </div>
    </div>
  );
}
