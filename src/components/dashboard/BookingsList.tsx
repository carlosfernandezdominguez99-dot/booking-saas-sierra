"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { BookingWithDetails } from "@/lib/services/bookingService";
import { cancelBookingAction } from "@/app/dashboard/reservas/actions";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No presentado",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-ink-100 text-ink-500",
  completed: "bg-brand-50 text-brand-700",
  no_show: "bg-red-50 text-red-600",
};

function formatDateTime(iso: string, timezone: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("es-ES", { timeZone: timezone, day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("es-ES", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

interface BookingRowState extends BookingWithDetails {
  cancelError?: string;
}

export function BookingsList({
  bookings,
  timezone,
  emptyMessage = "No hay reservas que mostrar.",
  showCancel = false,
}: {
  bookings: BookingWithDetails[];
  timezone: string;
  emptyMessage?: string;
  showCancel?: boolean;
}) {
  const [rows, setRows] = useState<BookingRowState[]>(bookings);
  const [isPending, startTransition] = useTransition();

  function handleCancel(bookingId: string) {
    setRows((prev) => prev.map((r) => (r.id === bookingId ? { ...r, cancelError: undefined } : r)));

    startTransition(async () => {
      const result = await cancelBookingAction(bookingId);
      setRows((prev) =>
        prev.map((r) =>
          r.id === bookingId
            ? result.error
              ? { ...r, cancelError: result.error }
              : { ...r, status: "cancelled" }
            : r,
        ),
      );
    });
  }

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-400">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-ink-100">
      {rows.map((booking) => {
        const { date, time } = formatDateTime(booking.startTime, timezone);
        const canCancel = showCancel && (booking.status === "pending" || booking.status === "confirmed");

        return (
          <li key={booking.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-4">
              <div className="w-16 shrink-0 text-center">
                <p className="text-xs font-medium uppercase text-ink-400">{date}</p>
                <p className="text-sm font-semibold text-ink-900">{time}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-900">{booking.customerName}</p>
                <p className="text-xs text-ink-500">
                  {booking.serviceName} · {booking.durationMinutes} min · {formatPrice(booking.priceCents)}
                </p>
                <p className="text-xs text-ink-400">{booking.customerPhone}</p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_CLASSES[booking.status] ?? "bg-ink-100 text-ink-500"
                }`}
              >
                {STATUS_LABEL[booking.status] ?? booking.status}
              </span>
              {canCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={isPending}
                  onClick={() => handleCancel(booking.id)}
                >
                  Cancelar
                </Button>
              )}
              {booking.cancelError && <p className="text-xs text-red-600">{booking.cancelError}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
