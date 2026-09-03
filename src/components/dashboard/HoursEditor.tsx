"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { WEEK_DAYS, type WeeklyHoursInput } from "@/lib/validations/business";
import { saveWeeklyHoursAction } from "@/app/dashboard/horarios/actions";

/**
 * Editor del horario semanal general del negocio. Se usa tanto en
 * `/dashboard/horarios` como en el paso 3 del asistente de onboarding.
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

  function updateDay(dayOfWeek: number, patch: Partial<WeeklyHoursInput[number]>) {
    setSuccess(false);
    setHours((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
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
            <div
              key={dayOfWeek}
              className="flex flex-col gap-2 rounded-xl border border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <label className="flex items-center gap-2 text-sm font-medium text-ink-800 sm:w-32">
                <input
                  type="checkbox"
                  checked={!day.closed}
                  onChange={(e) => updateDay(dayOfWeek, { closed: !e.target.checked })}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
                />
                {label}
              </label>

              {day.closed ? (
                <span className="text-sm text-ink-400">Cerrado</span>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={day.startTime}
                    onChange={(e) => updateDay(dayOfWeek, { startTime: e.target.value })}
                    className="h-9 rounded-lg border border-ink-200 px-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                  />
                  <span className="text-sm text-ink-400">a</span>
                  <input
                    type="time"
                    value={day.endTime}
                    onChange={(e) => updateDay(dayOfWeek, { endTime: e.target.value })}
                    className="h-9 rounded-lg border border-ink-200 px-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                  />
                </div>
              )}
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
