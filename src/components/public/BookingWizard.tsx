"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, FieldError } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { addDaysToDateString } from "@/lib/utils/timezone";
import type { AvailableSlot } from "@/lib/services/availabilityService";
import type { PublicBookingResult } from "@/lib/services/bookingService";
import { createPublicBookingAction, getSlotsAction } from "@/app/negocio/[slug]/reservar/actions";

export interface PublicServiceLite {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
}

type Step = "service" | "datetime" | "contact" | "done";

const DAYS_AHEAD = 30;

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function formatSlotTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
}

function formatDateLong(dateStr: string, timezone: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function BookingWizard({
  slug,
  businessId,
  businessName,
  timezone,
  services,
  initialServiceId,
  initialDate,
  initialSlots,
}: {
  slug: string;
  businessId: string;
  businessName: string;
  timezone: string;
  services: PublicServiceLite[];
  initialServiceId: string | null;
  initialDate: string;
  initialSlots: AvailableSlot[];
}) {
  // `initialServiceId` ya viene resuelto desde el servidor (Página →
  // `?servicio=` si es válido, o el único servicio si solo hay uno) — así
  // los huecos iniciales (`initialSlots`) siempre corresponden al
  // servicio con el que arranca el asistente, sin duplicar esa lógica
  // aquí también.
  const [step, setStep] = useState<Step>(initialServiceId ? "datetime" : "service");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialServiceId);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [slots, setSlots] = useState<AvailableSlot[]>(initialSlots);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [isLoadingSlots, startSlotsTransition] = useTransition();
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [bookingResult, setBookingResult] = useState<PublicBookingResult | null>(null);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysToDateString(initialDate, i)),
    [initialDate],
  );

  function loadSlots(serviceId: string, date: string) {
    setSlotsError(null);
    setSelectedSlot(null);
    startSlotsTransition(async () => {
      const res = await getSlotsAction({ businessId, serviceId, date });
      if (res.error) setSlotsError(res.error);
      setSlots(res.slots);
    });
  }

  // Ya se trajeron los huecos del día/servicio iniciales desde el
  // servidor (sin esta comprobación se pedirían otra vez de más al
  // montar el componente). `useRef` en vez de `useMemo` porque necesita
  // una identidad mutable estable entre renders — `useMemo` no lo
  // garantiza, es solo una optimización.
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!selectedServiceId) return;
    if (!didInitRef.current) {
      didInitRef.current = true;
      if (selectedServiceId === initialServiceId && selectedDate === initialDate) return;
    }
    loadSlots(selectedServiceId, selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId, selectedDate]);

  function handleSelectService(serviceId: string) {
    setSelectedServiceId(serviceId);
    setStep("datetime");
  }

  function handleSelectSlot(slot: AvailableSlot) {
    setSelectedSlot(slot);
    setStep("contact");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;
    setFormError(null);
    setFieldErrors({});

    startSubmitTransition(async () => {
      const res = await createPublicBookingAction({
        businessId,
        serviceId: selectedService.id,
        startTime: selectedSlot.slotStart,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        comment,
      });

      if (res.error) {
        setFormError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        // El hueco pudo dejar de estar disponible entre medias (alguien se
        // adelantó): se vuelve a la selección de fecha/hora con los
        // huecos recién pedidos, en vez de dejar al visitante reintentando
        // un hueco que ya no existe.
        if (!res.fieldErrors) {
          setStep("datetime");
          loadSlots(selectedService.id, selectedDate);
        }
        return;
      }

      if (res.result) {
        setBookingResult(res.result);
        setStep("done");
      }
    });
  }

  if (services.length === 0) {
    return (
      <Card className="border-dashed py-12 text-center text-sm text-ink-400">
        Este negocio todavía no tiene servicios disponibles para reservar.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {step !== "done" && (
        <ol className="flex items-center justify-center gap-2 text-xs font-medium text-ink-400">
          {(["service", "datetime", "contact"] as Step[]).map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-4 bg-ink-200" />}
              <span
                className={cn(
                  "rounded-full px-2.5 py-1",
                  step === s ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-500",
                )}
              >
                {s === "service" ? "Servicio" : s === "datetime" ? "Fecha y hora" : "Tus datos"}
              </span>
            </li>
          ))}
        </ol>
      )}

      {step === "service" && (
        <div className="space-y-3">
          {services.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => handleSelectService(service.id)}
              className="block w-full text-left"
            >
              <Card className="flex items-center justify-between gap-4 transition-colors hover:border-ink-300">
                <div>
                  <p className="font-medium text-ink-900">{service.name}</p>
                  <p className="text-sm text-ink-500">{service.duration_minutes} min</p>
                </div>
                <p className="shrink-0 font-semibold text-ink-900">{formatPrice(service.price_cents)}</p>
              </Card>
            </button>
          ))}
        </div>
      )}

      {step === "datetime" && selectedService && (
        <div className="space-y-5">
          <Card className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-ink-900">{selectedService.name}</p>
              <p className="text-sm text-ink-500">
                {selectedService.duration_minutes} min · {formatPrice(selectedService.price_cents)}
              </p>
            </div>
            {services.length > 1 && (
              <button
                type="button"
                onClick={() => setStep("service")}
                className="shrink-0 text-sm font-medium text-brand-600 hover:underline"
              >
                Cambiar
              </button>
            )}
          </Card>

          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">Elige un día</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.map((day) => {
                const isSelected = day === selectedDate;
                const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString("es-ES", {
                  timeZone: "UTC",
                  weekday: "short",
                });
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-sm transition-colors",
                      isSelected
                        ? "border-ink-900 bg-ink-900 text-white"
                        : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
                    )}
                  >
                    <span className="text-[11px] uppercase text-current opacity-70">{weekday}</span>
                    <span className="font-semibold">{Number(day.slice(8, 10))}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">
              {formatDateLong(selectedDate, timezone)}
            </p>

            {isLoadingSlots ? (
              <p className="py-6 text-center text-sm text-ink-400">Buscando huecos disponibles…</p>
            ) : slotsError ? (
              <p className="py-6 text-center text-sm text-red-600">{slotsError}</p>
            ) : slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">
                No hay huecos disponibles ese día — prueba con otra fecha.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={slot.slotStart}
                    type="button"
                    onClick={() => handleSelectSlot(slot)}
                    className="rounded-xl border border-ink-200 bg-white py-2 text-sm font-medium text-ink-800 transition-colors hover:border-ink-900 hover:bg-ink-900 hover:text-white"
                  >
                    {formatSlotTime(slot.slotStart, timezone)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === "contact" && selectedService && selectedSlot && (
        <div className="space-y-5">
          <Card className="space-y-1">
            <p className="font-medium text-ink-900">{selectedService.name}</p>
            <p className="text-sm text-ink-500 capitalize">
              {formatDateLong(selectedDate, timezone)} · {formatSlotTime(selectedSlot.slotStart, timezone)}
            </p>
            <button
              type="button"
              onClick={() => setStep("datetime")}
              className="pt-1 text-sm font-medium text-brand-600 hover:underline"
            >
              Cambiar fecha u hora
            </button>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={fieldErrors.customerName}
                required
              />
              <FieldError message={fieldErrors.customerName} />
            </div>
            <div>
              <Input
                type="tel"
                placeholder="Tu teléfono"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={fieldErrors.customerPhone}
                required
              />
              <FieldError message={fieldErrors.customerPhone} />
            </div>
            <div>
              <Input
                type="email"
                placeholder="Email (opcional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.customerEmail}
              />
              <FieldError message={fieldErrors.customerEmail} />
            </div>
            <div>
              <textarea
                placeholder="¿Algo que debamos saber? (opcional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Confirmar reserva
            </Button>
          </form>
        </div>
      )}

      {step === "done" && bookingResult && (
        <Card className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
            ✓
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink-950">¡Reserva confirmada!</h2>
            <p className="mt-1 text-sm text-ink-500">
              {bookingResult.serviceName} en {businessName}
            </p>
            <p className="text-sm font-medium capitalize text-ink-900">
              {new Date(bookingResult.startTime).toLocaleDateString("es-ES", {
                timeZone: timezone,
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              · {formatSlotTime(bookingResult.startTime, timezone)}
            </p>
          </div>
          <p className="text-xs text-ink-400">
            Te avisaremos por WhatsApp con los detalles de tu cita.
          </p>
          <Link href={`/negocio/${slug}`} className="inline-block text-sm font-medium text-brand-600 hover:underline">
            Volver a la página de {businessName}
          </Link>
        </Card>
      )}
    </div>
  );
}
