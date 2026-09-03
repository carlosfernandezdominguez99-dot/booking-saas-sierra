"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { WEEK_DAYS, type WeeklyHoursInput } from "@/lib/validations/business";
import { saveWeeklyHoursAction } from "@/app/dashboard/horarios/actions";

const MAX_RANGES_PER_DAY = 3;

/**
 * Editor del horario semanal general del negocio, con soporte para
 * jornada partida (varios tramos por día, p. ej. mañana y tarde). Se usa
 * tanto en `/dashboard/horarios` como en el paso 3 del asistente de
 * onboarding.
 *
 * `onSaved` es opcional: el asistente lo usa para avanzar al siguiente
 * paso tras un guardado correcto; la página de horarios no lo necesita.
 */
export function HoursEditor({
  initialHours,
  onSaved,
  submitLabel = "Guardar horario",
}: {
  initialHours: WeeklyHoursInput;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const [hours, setHours] = useState(initialHours);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateDay(dayOfWeek: number, updater: (day: WeeklyHoursInput[number]) => WeeklyHoursInput[number]) {
    setSuccess(false);
    setHours((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? updater(d) : d)));
  }

  function toggleOpen(dayOfWeek: number, open: boolean) {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      closed: !open,
      ranges: open && day.ranges.length === 0 ? [{ startTime: "09:00", endTime: "20:00" }] : day.ranges,
    }));
  }

  function updateRange(dayOfWeek: number, index: number, patch: Partial<{ startTime: string; endTime: string }>) {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      ranges: day.ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  }

  function addRange(dayOfWeek: number) {
    updateDay(dayOfWeek, (day) => {
      const last = day.ranges[day.ranges.length - 1];
      return {
        ...day,
        ranges: [...day.ranges, { startTime: last?.endTime ?? "09:00", endTime: "20:00" }],
      };
    });
  }

  function removeRange(dayOfWeek: number, index: number) {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      ranges: day.ranges.filter((_, i) => i !== index),
    }));
  }

  function handleSave() {
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await saveWeeklyHoursAction(hours);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      onSaved?.();
    });
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      {success && <Alert tone="success">Horario guardado.</Alert>}

      <div className="space-y-2">
        {WEEK_DAYS.map(({ dayOfWeek, label }) => {
          const day = hours.find((d) => d.dayOfWeek === dayOfWeek)!;
          return (
            <div key={dayOfWeek} className="rounded-xl border border-ink-100 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-ink-800 sm:w-32">
                  <input
                    type="checkbox"
                    checked={!day.closed}
                    onChange={(e) => toggleOpen(dayOfWeek, e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
                  />
                  {label}
                </label>

                {day.closed ? (
                  <span className="text-sm text-ink-400">Cerrado</span>
                ) : (
                  <div className="flex flex-1 flex-col gap-2">
                    {day.ranges.map((range, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          value={range.startTime}
                          onChange={(e) => updateRange(dayOfWeek, index, { startTime: e.target.value })}
                          className="h-9 rounded-lg border border-ink-200 px-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                        />
                        <span className="text-sm text-ink-400">a</span>
                        <input
                          type="time"
                          value={range.endTime}
                          onChange={(e) => updateRange(dayOfWeek, index, { endTime: e.target.value })}
                          className="h-9 rounded-lg border border-ink-200 px-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                        />
                        {day.ranges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRange(dayOfWeek, index)}
                            className="text-xs font-medium text-ink-400 hover:text-red-600"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    ))}

                    {day.ranges.length < MAX_RANGES_PER_DAY && (
                      <button
                        type="button"
                        onClick={() => addRange(dayOfWeek)}
                        className="self-start text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        + Añadir tramo (jornada partida)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button type="button" loading={isPending} onClick={handleSave}>
        {submitLabel}
      </Button>
    </div>
  );
}
