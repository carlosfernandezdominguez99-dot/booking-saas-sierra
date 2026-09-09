"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils/cn";
import { addDaysToDateString } from "@/lib/utils/timezone";
import { buildDirectionsUrl } from "@/lib/utils/maps";
import type { PublicBookingResult } from "@/lib/services/bookingService";
import {
  createAccountBookingAction,
  getSlotsAction,
  type SlotWithEmployee,
} from "@/app/negocio/[slug]/reservar/actions";

export interface PublicEmployeeLite {
  id: string;
  name: string;
  photo_url: string | null;
}

export interface PublicServiceLite {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  /** Vacío si el negocio no usa empleados, o si a este servicio no se le asignó ninguno. */
  employees: PublicEmployeeLite[];
}

/**
 * Selección de con quién reservar: `null` = todavía sin elegir (o negocio
 * sin ningún empleado real en este servicio, donde nunca se pide y se
 * reserva directamente con el gerente), `"any"` = "cualquiera disponible"
 * (incluye al gerente en la mezcla, Fase 9.2), `"manager"` = el propio
 * gerente elegido explícitamente entre varias opciones, o el id de un
 * empleado real concreto.
 */
type EmployeeSelection = string | "any" | "manager" | null;

type Step = "service" | "employee" | "datetime" | "contact" | "done";

const STEP_LABEL: Record<Step, string> = {
  service: "Servicio",
  employee: "Empleado",
  datetime: "Fecha y hora",
  contact: "Confirmar",
  done: "Confirmar",
};

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

export interface BookingAccountProfile {
  name: string;
  email: string;
  phone: string;
}

export function BookingWizard({
  slug,
  businessId,
  businessName,
  timezone,
  businessAddress,
  managerName,
  services,
  initialServiceId,
  initialDate,
  initialSlots,
  accountProfile,
  replaceBookingId,
}: {
  slug: string;
  businessId: string;
  businessName: string;
  timezone: string;
  /** Dirección del negocio (Fase 9.1) — si la hay, se enseña "Cómo llegar" en la confirmación. */
  businessAddress?: string | null;
  /** Nombre con el que el gerente aparece como opción "con quién" (Fase 9.2). */
  managerName: string;
  services: PublicServiceLite[];
  initialServiceId: string | null;
  initialDate: string;
  initialSlots: SlotWithEmployee[];
  /**
   * Nombre/email/teléfono de la cuenta con la que se ha iniciado sesión —
   * la página ya no deja llegar hasta aquí sin cuenta (Fase 7.4). Se usan
   * tal cual para reservar, sin volver a pedirlos: `createAccountBookingAction`
   * los toma de la cuenta en el servidor, así que esto es solo para
   * enseñárselos al cliente en el paso de confirmación.
   */
  accountProfile: BookingAccountProfile;
  /**
   * Si se llega aquí desde "Modificar" en "Mis citas", el id de la cita
   * que hay que cancelar en cuanto esta nueva se cree con éxito — ver
   * `createAccountBookingAction`.
   */
  replaceBookingId?: string | null;
}) {
  // `initialServiceId` ya viene resuelto desde el servidor (Página →
  // `?servicio=` si es válido, o el único servicio si solo hay uno) — así
  // los huecos iniciales (`initialSlots`) siempre corresponden al
  // servicio con el que arranca el asistente, sin duplicar esa lógica
  // aquí también. Igual con el empleado: el gerente (Fase 9.2) siempre
  // cuenta como un candidato más, así que con 1+ empleados reales
  // asignados hace falta preguntar (paso "employee", él o el gerente);
  // solo con 0 no hay nada que preguntar — se reserva directamente con el
  // gerente, como siempre.
  const initialService = services.find((s) => s.id === initialServiceId) ?? null;
  const initialEmployeeCount = initialService?.employees.length ?? 0;

  const [step, setStep] = useState<Step>(
    !initialServiceId ? "service" : initialEmployeeCount >= 1 ? "employee" : "datetime",
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialServiceId);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<EmployeeSelection>(null);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [slots, setSlots] = useState<SlotWithEmployee[]>(initialSlots);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [isLoadingSlots, startSlotsTransition] = useTransition();
  const [selectedSlot, setSelectedSlot] = useState<SlotWithEmployee | null>(null);

  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [bookingResult, setBookingResult] = useState<PublicBookingResult | null>(null);
  const [replaceWarning, setReplaceWarning] = useState<string | null>(null);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  // Nombre a mostrar para lo que se haya elegido en el paso "empleado"
  // (antes de saber todavía con quién concreto encajará "cualquiera
  // disponible"). `null` no debería enseñarse — solo pasa mientras el
  // paso "employee" está en pantalla y aún no se ha elegido nada.
  const selectedEmployeeName = useMemo(() => {
    if (selectedEmployeeId === "any") return "Cualquiera disponible";
    if (selectedEmployeeId === "manager") return managerName;
    if (typeof selectedEmployeeId === "string") {
      return selectedService?.employees.find((e) => e.id === selectedEmployeeId)?.name ?? "—";
    }
    return "—";
  }, [selectedService, selectedEmployeeId, managerName]);

  // Con quién se reservaría de verdad si se confirma el hueco elegido —
  // para enseñarlo en el paso de confirmación y en la pantalla final.
  // `slot.employeeId` viene `undefined` cuando el hueco es del propio
  // gerente (Fase 9.2), tanto si el servicio no usa empleados como si el
  // cliente lo eligió a él entre varias opciones.
  const selectedSlotEmployeeName = useMemo(() => {
    if (!selectedSlot) return null;
    if (!selectedSlot.employeeId) {
      // Solo se enseña "con [gerente]" cuando había alguien más entre quien
      // elegir — si el servicio no usa empleados en absoluto, se deja sin
      // nombre (comportamiento de siempre, sin ruido de más).
      return (selectedService?.employees.length ?? 0) >= 1 ? managerName : null;
    }
    return selectedService?.employees.find((e) => e.id === selectedSlot.employeeId)?.name ?? null;
  }, [selectedService, selectedSlot, managerName]);

  const stepsForIndicator = useMemo<Step[]>(() => {
    const employeeCount = selectedService?.employees.length ?? 0;
    return employeeCount >= 1 ? ["service", "employee", "datetime", "contact"] : ["service", "datetime", "contact"];
  }, [selectedService]);

  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysToDateString(initialDate, i)),
    [initialDate],
  );

  function loadSlots(serviceId: string, date: string, employeeSelection: EmployeeSelection) {
    setSlotsError(null);
    setSelectedSlot(null);
    startSlotsTransition(async () => {
      const service = services.find((s) => s.id === serviceId);
      const employees = service?.employees ?? [];
      // "Cualquiera disponible" mezcla los huecos de cada empleado real
      // CON los del propio gerente (`null` en la lista, Fase 9.2) — así
      // nunca se pierde su disponibilidad solo por haber añadido gente.
      // "manager" pide directamente sus huecos (`employeeId: null`);
      // cualquier otro string es el id de un empleado real concreto.
      const res = await getSlotsAction(
        employeeSelection === "any"
          ? { businessId, serviceId, date, anyOf: [null, ...employees.map((e) => e.id)] }
          : {
              businessId,
              serviceId,
              date,
              employeeId: employeeSelection === "manager" ? null : (employeeSelection ?? undefined),
            },
      );
      if (res.error) setSlotsError(res.error);
      setSlots(res.slots);
    });
  }

  // Ya se trajeron los huecos del día/servicio iniciales desde el
  // servidor (sin esta comprobación se pedirían otra vez de más al
  // montar el componente) — pero eso solo pasó cuando el servicio no
  // tiene ningún empleado real asignado (con 1+, la página deja el paso
  // "Elige con quién" para el cliente — él o el gerente — y no trae
  // huecos todavía). Mientras el servicio elegido tenga 1+ empleados y no
  // se haya elegido aún nadie, no hay nada que pedir. `useRef` en vez de
  // `useMemo` porque necesita una identidad mutable estable entre
  // renders — `useMemo` no lo garantiza, es solo una optimización.
  const consumedInitialSlotsRef = useRef(false);
  useEffect(() => {
    if (!selectedServiceId) return;
    const employees = services.find((s) => s.id === selectedServiceId)?.employees ?? [];
    if (employees.length >= 1 && selectedEmployeeId === null) return;

    if (!consumedInitialSlotsRef.current) {
      consumedInitialSlotsRef.current = true;
      if (selectedServiceId === initialServiceId && selectedDate === initialDate && employees.length === 0) {
        return;
      }
    }
    loadSlots(selectedServiceId, selectedDate, selectedEmployeeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId, selectedDate, selectedEmployeeId]);

  function handleSelectService(serviceId: string) {
    setSelectedServiceId(serviceId);
    const employees = services.find((s) => s.id === serviceId)?.employees ?? [];
    if (employees.length >= 1) {
      setSelectedEmployeeId(null);
      setStep("employee");
    } else {
      setSelectedEmployeeId(null);
      setStep("datetime");
    }
  }

  function handleSelectEmployee(employeeSelection: string | "any" | "manager") {
    setSelectedEmployeeId(employeeSelection);
    setStep("datetime");
  }

  function handleSelectSlot(slot: SlotWithEmployee) {
    setSelectedSlot(slot);
    setStep("contact");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;
    setFormError(null);

    startSubmitTransition(async () => {
      const res = await createAccountBookingAction({
        businessId,
        serviceId: selectedService.id,
        startTime: selectedSlot.slotStart,
        employeeId: selectedSlot.employeeId ?? null,
        comment,
        replaceBookingId,
      });

      if (res.error) {
        setFormError(res.error);
        // El hueco pudo dejar de estar disponible entre medias (alguien se
        // adelantó): se vuelve a la selección de fecha/hora con los
        // huecos recién pedidos, en vez de dejar al visitante reintentando
        // un hueco que ya no existe.
        setStep("datetime");
        loadSlots(selectedService.id, selectedDate, selectedEmployeeId);
        return;
      }

      if (res.result) {
        setBookingResult(res.result);
        setReplaceWarning(res.replaceWarning ?? null);
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
          {stepsForIndicator.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-4 bg-ink-200" />}
              <span
                className={cn(
                  "rounded-full px-2.5 py-1",
                  step === s ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-500",
                )}
              >
                {STEP_LABEL[s]}
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

      {step === "employee" && selectedService && (
        <div className="space-y-3">
          <Card className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-ink-900">{selectedService.name}</p>
              <p className="text-sm text-ink-500">
                {selectedService.duration_minutes} min · {formatPrice(selectedService.price_cents)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep("service")}
              className="shrink-0 text-sm font-medium text-brand-600 hover:underline"
            >
              Cambiar
            </button>
          </Card>

          <p className="text-sm font-medium text-ink-700">¿Con quién quieres la cita?</p>

          <button type="button" onClick={() => handleSelectEmployee("any")} className="block w-full text-left">
            <Card className="flex items-center gap-3 transition-colors hover:border-ink-300">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-500">
                ?
              </div>
              <div>
                <p className="font-medium text-ink-900">Cualquiera disponible</p>
                <p className="text-xs text-ink-500">Te asignamos a quien tenga hueco antes</p>
              </div>
            </Card>
          </button>

          <button type="button" onClick={() => handleSelectEmployee("manager")} className="block w-full text-left">
            <Card className="flex items-center gap-3 transition-colors hover:border-ink-300">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-600">
                {managerName.charAt(0).toUpperCase()}
              </div>
              <p className="font-medium text-ink-900">{managerName}</p>
            </Card>
          </button>

          {selectedService.employees.map((employee) => (
            <button
              key={employee.id}
              type="button"
              onClick={() => handleSelectEmployee(employee.id)}
              className="block w-full text-left"
            >
              <Card className="flex items-center gap-3 transition-colors hover:border-ink-300">
                {employee.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={employee.photo_url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-600">
                    {employee.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="font-medium text-ink-900">{employee.name}</p>
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

          {selectedService.employees.length >= 1 && (
            <Card className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Con</p>
                <p className="font-medium text-ink-900">{selectedEmployeeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep("employee")}
                className="shrink-0 text-sm font-medium text-brand-600 hover:underline"
              >
                Cambiar
              </button>
            </Card>
          )}

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
              <div className="py-6 text-center text-sm text-ink-400">
                <p>No hay huecos disponibles ese día — prueba con otra fecha.</p>
                <Link
                  href={`/negocio/${slug}/lista-espera?servicio=${selectedService.id}`}
                  className="mt-2 inline-block font-medium text-brand-600 hover:underline"
                >
                  Apuntarme a la lista de espera →
                </Link>
              </div>
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
            <p className="font-medium text-ink-900">
              {selectedService.name}
              {selectedSlotEmployeeName ? ` con ${selectedSlotEmployeeName}` : ""}
            </p>
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
            <Card className="space-y-1 bg-ink-50">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Reservas como</p>
              <p className="font-medium text-ink-900">{accountProfile.name}</p>
              <p className="text-sm text-ink-500">
                {accountProfile.email} · {accountProfile.phone}
              </p>
            </Card>
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
              {bookingResult.serviceName}
              {selectedSlotEmployeeName ? ` con ${selectedSlotEmployeeName}` : ""} en {businessName}
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
            Te hemos enviado un email de confirmación con los detalles de tu cita.
          </p>
          {replaceWarning && (
            <Alert tone="error" className="text-left">
              {replaceWarning}
            </Alert>
          )}
          {businessAddress && (
            <a
              href={buildDirectionsUrl(businessAddress)}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-xl bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
            >
              Cómo llegar
            </a>
          )}
          <Link href={`/negocio/${slug}`} className="block text-sm font-medium text-brand-600 hover:underline">
            Volver a la página de {businessName}
          </Link>
        </Card>
      )}
    </div>
  );
}
