"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { leaveWaitlistAction, logoutAction } from "@/app/mis-citas/actions";
import type {
  AccountBooking,
  AccountWaitlistEntry,
  CustomerAccountData,
} from "@/lib/services/customerAccountService";

type Tab = "inicio" | "proximas" | "pasadas" | "negocios";

const BOOKING_STATUS_LABELS: Record<AccountBooking["status"], { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmada", className: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelada", className: "bg-ink-100 text-ink-400" },
  completed: { label: "Completada", className: "bg-ink-100 text-ink-500" },
  no_show: { label: "No se presentó", className: "bg-ink-100 text-ink-400" },
};

const WAITLIST_STATUS_LABELS: Record<AccountWaitlistEntry["status"], { label: string; className: string }> = {
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

interface FlatBooking extends AccountBooking {
  businessName: string;
  timezone: string;
}

interface FlatWaitlistEntry extends AccountWaitlistEntry {
  businessName: string;
  timezone: string;
}

function BookingRow({ booking }: { booking: FlatBooking }) {
  const statusInfo = BOOKING_STATUS_LABELS[booking.status];
  return (
    <div className="rounded-xl border border-ink-100 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-ink-400">{booking.businessName}</p>
          <p className="truncate font-medium text-ink-900">{booking.serviceName}</p>
          <p className="text-sm text-ink-500">{formatDateTime(booking.startTime, booking.timezone)}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", statusInfo.className)}>
          {statusInfo.label}
        </span>
      </div>
    </div>
  );
}

export function CustomerAccountDashboard({ data }: { data: CustomerAccountData }) {
  const [tab, setTab] = useState<Tab>("inicio");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [isLoggingOut, startLogoutTransition] = useTransition();

  const { upcoming, past, waitlist } = useMemo(() => {
    const upcoming: FlatBooking[] = [];
    const past: FlatBooking[] = [];
    const waitlist: FlatWaitlistEntry[] = [];

    for (const business of data.businesses) {
      for (const b of business.upcomingBookings) {
        upcoming.push({ ...b, businessName: business.businessName, timezone: business.businessTimezone });
      }
      for (const b of business.pastBookings) {
        past.push({ ...b, businessName: business.businessName, timezone: business.businessTimezone });
      }
      for (const w of business.waitlistEntries) {
        waitlist.push({ ...w, businessName: business.businessName, timezone: business.businessTimezone });
      }
    }

    upcoming.sort((a, b) => a.startTime.localeCompare(b.startTime));
    past.sort((a, b) => b.startTime.localeCompare(a.startTime));
    waitlist.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { upcoming, past, waitlist };
  }, [data]);

  const activeWaitlist = waitlist.filter((w) => !dismissedIds.has(w.id) && (w.status === "waiting" || w.status === "offered"));
  const nextBooking = upcoming[0] ?? null;

  function handleLeaveWaitlist(entryId: string) {
    setRowError((prev) => ({ ...prev, [entryId]: "" }));
    startTransition(async () => {
      const res = await leaveWaitlistAction(entryId);
      if (res.error) {
        setRowError((prev) => ({ ...prev, [entryId]: res.error! }));
        return;
      }
      setDismissedIds((prev) => new Set(prev).add(entryId));
    });
  }

  function handleLogout() {
    startLogoutTransition(async () => {
      await logoutAction();
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-950">Hola, {data.accountName}</h1>
          <p className="text-sm text-ink-500">{data.accountEmail}</p>
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

      <div className="flex gap-2 overflow-x-auto border-b border-ink-100">
        {(["inicio", "proximas", "pasadas", "negocios"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t ? "border-ink-900 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-600",
            )}
          >
            {t === "inicio" ? "Inicio" : t === "proximas" ? "Próximas" : t === "pasadas" ? "Pasadas" : "Negocios"}
          </button>
        ))}
      </div>

      {data.businesses.length === 0 && (
        <Card className="border-dashed py-8 text-center text-sm text-ink-400">
          Todavía no tienes ninguna reserva con este email en ningún negocio.
        </Card>
      )}

      {tab === "inicio" && data.businesses.length > 0 && (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">Tu próxima cita</p>
            {nextBooking ? (
              <BookingRow booking={nextBooking} />
            ) : (
              <Card className="border-dashed py-8 text-center text-sm text-ink-400">
                No tienes ninguna cita próxima.
              </Card>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">Tu lista de espera</p>
            {activeWaitlist.length > 0 ? (
              <div className="space-y-2.5">
                {activeWaitlist.map((entry) => {
                  const statusInfo = WAITLIST_STATUS_LABELS[entry.status];
                  return (
                    <div key={entry.id} className="rounded-xl border border-ink-100 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium uppercase tracking-wide text-ink-400">
                            {entry.businessName}
                          </p>
                          <p className="truncate font-medium text-ink-900">{entry.serviceName}</p>
                          <p className="text-sm text-ink-500">Para el {formatDateOnly(entry.preferredDate)}</p>
                          {entry.status === "offered" && entry.offeredStartTime && (
                            <p className="mt-1 text-xs font-medium text-amber-700">
                              Oferta: {formatDateTime(entry.offeredStartTime, entry.timezone)}
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
              <p className="text-sm text-ink-400">
                No estás apuntado a ninguna lista de espera. Puedes apuntarte desde la página de cada negocio.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "proximas" && (
        <div className="space-y-2.5">
          {upcoming.length === 0 ? (
            <Card className="border-dashed py-8 text-center text-sm text-ink-400">No tienes citas próximas.</Card>
          ) : (
            upcoming.map((booking) => <BookingRow key={`${booking.businessName}-${booking.id}`} booking={booking} />)
          )}
        </div>
      )}

      {tab === "pasadas" && (
        <div className="space-y-2.5">
          {past.length === 0 ? (
            <Card className="border-dashed py-8 text-center text-sm text-ink-400">Todavía no tienes citas pasadas.</Card>
          ) : (
            past.map((booking) => <BookingRow key={`${booking.businessName}-${booking.id}`} booking={booking} />)
          )}
        </div>
      )}

      {tab === "negocios" && data.businesses.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.businesses.map((business) => {
            const totalCitas = business.upcomingBookings.length + business.pastBookings.length;
            return (
              <Link
                key={business.businessId}
                href={`/negocio/${business.businessSlug}`}
                className="block"
              >
                <Card className="flex items-center gap-3 transition-colors hover:border-ink-300">
                  {business.businessLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={business.businessLogoUrl}
                      alt={business.businessName}
                      className="h-11 w-11 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-sm font-semibold text-white">
                      {business.businessName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{business.businessName}</p>
                    <p className="text-xs text-ink-400">
                      {totalCitas > 0 ? `${totalCitas} cita${totalCitas === 1 ? "" : "s"}` : "Sin citas todavía"}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
