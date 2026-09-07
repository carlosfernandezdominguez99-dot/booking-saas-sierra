"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { addMonthsToDateString, getMonthGridWeeks, startOfMonth } from "@/lib/utils/timezone";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Selector de fecha en popover con grid de mes — mismo aspecto y manejo de
 * mes/año que `CalendarPicker` (la cabecera de `/dashboard/calendario`),
 * factorizado aquí para poder reutilizarlo en cualquier formulario que
 * pida "elige un día" (alta manual en la lista de espera desde el panel,
 * y el propio cliente apuntándose desde la página pública) en vez de un
 * `<input type="date">` nativo — que se ve y se comporta de forma muy
 * distinta según navegador/móvil, y no encaja con el resto de la app.
 *
 * A diferencia de `CalendarPicker` (que navega con `router.push` al
 * elegir un día), este recibe `value`/`onChange` como un campo de
 * formulario normal.
 */
export function DatePicker({
  value,
  onChange,
  todayStr,
  minDate,
  placeholder = "Elegir fecha",
}: {
  value: string;
  onChange: (date: string) => void;
  todayStr: string;
  /** Los días anteriores a esta fecha salen deshabilitados. Por defecto, hoy. */
  minDate?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(value || todayStr));

  const effectiveMin = minDate ?? todayStr;
  const weeks = getMonthGridWeeks(cursor);
  const [cursorYear, cursorMonth] = cursor.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(cursorYear, cursorMonth - 1, 1)).toLocaleDateString("es-ES", {
    month: "long",
    timeZone: "UTC",
  });
  const currentMonthPrefix = cursor.slice(0, 7);

  const todayYear = Number(todayStr.slice(0, 4));
  const yearOptions = [todayYear, todayYear + 1, todayYear + 2];

  function toggle() {
    setCursor(startOfMonth(value || todayStr));
    setOpen((o) => !o);
  }

  function pick(d: string) {
    if (d < effectiveMin) return;
    onChange(d);
    setOpen(false);
  }

  const displayLabel = value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString("es-ES", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : placeholder;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex h-11 w-full items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 transition-colors hover:bg-ink-50"
      >
        <span aria-hidden>📅</span>
        <span className={cn(!value && "text-ink-400")}>{displayLabel}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-ink-100 bg-white p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setCursor(addMonthsToDateString(cursor, -1))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100"
                aria-label="Mes anterior"
              >
                ‹
              </button>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium capitalize text-ink-900">{monthLabel}</p>
                <select
                  value={cursorYear}
                  onChange={(e) => setCursor(`${e.target.value}-${cursor.slice(5, 7)}-01`)}
                  className="rounded-md border border-ink-200 bg-white py-0.5 text-xs text-ink-700"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setCursor(addMonthsToDateString(cursor, 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100"
                aria-label="Mes siguiente"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium text-ink-400">
              {WEEKDAY_LABELS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weeks.flat().map((d) => {
                const inMonth = d.slice(0, 7) === currentMonthPrefix;
                const isToday = d === todayStr;
                const isSelected = d === value;
                const isDisabled = d < effectiveMin;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => pick(d)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md text-xs transition-colors",
                      isDisabled
                        ? "cursor-not-allowed text-ink-200"
                        : cn(
                            inMonth ? "text-ink-700" : "text-ink-300",
                            isSelected
                              ? "bg-ink-900 text-white hover:bg-ink-800"
                              : isToday
                                ? "bg-brand-50 font-semibold text-brand-700 hover:bg-brand-100"
                                : "hover:bg-ink-100",
                          ),
                    )}
                  >
                    {Number(d.slice(8, 10))}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => pick(todayStr)}
              disabled={todayStr < effectiveMin}
              className="mt-2 w-full rounded-lg py-1.5 text-center text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent"
            >
              Hoy
            </button>
          </div>
        </>
      )}
    </div>
  );
}
