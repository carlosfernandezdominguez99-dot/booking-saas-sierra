"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { FieldError } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/utils/cn";
import { todayInTimezone } from "@/lib/utils/timezone";
import {
  joinWaitlistSelfAction,
  leaveWaitlistSelfAction,
  logoutAction,
} from "@/app/negocio/[slug]/mis-citas/actions";
import type {
  CustomerPortalData,
  PortalBooking,
  PortalWaitlistEntry,
} from "@/lib/services/customerPortalService";

type Tab = "inicio" | "proximas" | "pasadas";

const BOOKING_STATUS_LABELS: Record<PortalBooking["status"], { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmada", className: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelada", className: "bg-ink-100 text-ink-400" },
  completed: { label: "Completada", className: "bg-ink-100 text-ink-500" },
  no_show: { label: "No se presentó", className: "bg-ink-100 text-ink-400" },
};

const WAITLIST_STATUS_LABELS: Record<PortalWaitlistEntry["status"], { label: string; className: string }> = {
  waiting: { label: "Esperando", className: "bg-ink-100 text-ink-600" },
  offered: { label: "¡Oferta enviada!", className: "bg-amber-100 text-amber-700" },
  accepted: { label: "Aceptaste", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rechazaste", className: "bg-ink-100 text-ink-400" },
  expired: { label: "Caducó", className: "bg-ink-100 text-ink-400" },
};

function formatDateTime(iso: string, timezone: string): string {
  const label = new Date(iso).toLocaleString("es-ES", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDateOnly(dateStr: string): string {
  const label = new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function BookingRow({ booking, timezone }: { booking: PortalBooking; timezone: string }) {
  const statusInfo = BOOKING_STATUS_LABELS[booking.status];
  return (
    <div className="rounded-xl border border-ink-100 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{booking.serviceName}</p>
          <p className="text-sm text-ink-500">{formatDateTime(booking.startTime, timezone)}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", statusInfo.className)}>
          {statusInfo.label}
        </span>
      </div>
    </div>
  );
}

export function CustomerPortal({
  slug,
  data,
  services,
}: {
  slug: string;
  data: CustomerPortalData;
  services: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<Tab>("inicio");
  const [entries, setEntries] = useState(data.waitlistEntries);
  const [serviceId, setServiceId] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLoggingOut, startLogoutTransition] = useTransition();

  const today = todayInTimezone(data.businessTimezone);
  const nextBooking = data.upcomingBookings[0] ?? null;
  const activeWaitlistEntries = entries.filter((e) => e.status === "waiting" || e.status === "offered");

  function handleJoinWaitlist() {
    setFormError(null);
    if (!serviceId || !preferredDate) {
      setFormError("Elige un servicio y un día.");
      return;
    }
    startTransition(async () => {
      const res = await joinWaitlistSelfAction(slug, serviceId, preferredDate);
      if (res.error) {
        setFormError(res.error);
        return;
      }
      const service = services.find((s) => s.id === serviceId);
      setEntries((prev) => [
        {
          id: res.entryId!,
          serviceName: service?.name ?? "",
          preferredDate,
          status: "waiting" as const,
          offeredStartTime: null,
          offeredEndTime: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setServiceId("");
      setPreferredDate("");
      setShowJoinForm(false);
    });
  }

  function handleLeaveWaitlist(entryId: string) {
    setRowError((prev) => ({ ...prev, [entryId]: "" }));
    startTransition(async () => {
      const res = await leaveWaitlistSelfAction(slug, entryId);
      if (res.error) {
        setRowError((prev) => ({ ...prev, [entryId]: res.error! }));
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    });
  }

  function handleLogout() {
    startLogoutTransition(async () => {
      await logoutAction(slug);
    });
  }

  const joinWaitlistForm = (
    <div className="rounded-2xl border border-dashed border-ink-200 p-4">
      {!showJoinForm ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowJoinForm(true)}>
          + Apuntarme a la lista de espera
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink-900">Apuntarme a la lista de espera</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Servicio</Label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
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
              <Label>Día que quieres</Label>
              <DatePicker value={preferredDate} onChange={setPreferredDate} todayStr={today} />
            </div>
          </div>
          <FieldError message={formError ?? undefined} />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={isPending} onClick={handleJoinWaitlist}>
              Apuntarme
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowJoinForm(false);
                setFormError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-950">Hola, {data.customerName}</h1>
          <p className="text-sm text-ink-500">{data.businessName}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="shrink-0 text-xs font-medium text-ink-400 hover:text-red-600"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="flex gap-2 border-b border-ink-100">
        {(["inicio", "proximas", "pasadas"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t ? "border-ink-900 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-600",
            )}
          >
            {t === "inicio" ? "Inicio" : t === "proximas" ? "Próximas" : "Pasadas"}
          </button>
        ))}
      </div>

      {tab === "inicio" && (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">Tu próxima cita</p>
            {nextBooking ? (
              <BookingRow booking={nextBooking} timezone={data.businessTimezone} />
            ) : (
              <Card className="border-dashed py-8 text-center text-sm text-ink-400">
                No tienes ninguna cita próxima.
              </Card>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">Tu lista de espera</p>
            {activeWaitlistEntries.length > 0 ? (
              <div className="space-y-2.5">
                {activeWaitlistEntries.map((entry) => {
                  const statusInfo = WAITLIST_STATUS_LABELS[entry.status];
                  return (
                    <div key={entry.id} className="rounded-xl border border-ink-100 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">{entry.serviceName}</p>
                          <p className="text-sm text-ink-500">Para el {formatDateOnly(entry.preferredDate)}</p>
                          {entry.status === "offered" && entry.offeredStartTime && (
                            <p className="mt-1 text-xs font-medium text-amber-700">
                              Oferta: {formatDateTime(entry.offeredStartTime, data.businessTimezone)}
                            </p>
                          )}
                          {rowError[entry.id] && (
                            <p className="mt-1 text-xs text-red-600">{rowError[entry.id]}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusInfo.className)}>
                            {statusInfo.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleLeaveWaitlist(entry.id)}
                            disabled={isPending}
                            className="text-xs font-medium text-ink-400 hover:text-red-600"
                          >
                            Quitarme
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mb-3 text-sm text-ink-400">No estás apuntado a ninguna lista de espera.</p>
            )}
            {services.length > 0 && <div className="mt-3">{joinWaitlistForm}</div>}
          </div>
        </div>
      )}

      {tab === "proximas" && (
        <div className="space-y-2.5">
          {data.upcomingBookings.length === 0 ? (
            <Card className="border-dashed py-8 text-center text-sm text-ink-400">
              No tienes citas próximas.
            </Card>
          ) : (
            data.upcomingBookings.map((booking) => (
              <BookingRow key={booking.id} booking={booking} timezone={data.businessTimezone} />
            ))
          )}
        </div>
      )}

      {tab === "pasadas" && (
        <div className="space-y-2.5">
          {data.pastBookings.length === 0 ? (
            <Card className="border-dashed py-8 text-center text-sm text-ink-400">
              Todavía no tienes citas pasadas.
            </Card>
          ) : (
            data.pastBookings.map((booking) => (
              <BookingRow key={booking.id} booking={booking} timezone={data.businessTimezone} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
