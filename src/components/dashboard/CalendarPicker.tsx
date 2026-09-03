"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { addMonthsToDateString, getMonthGridWeeks, startOfMonth } from "@/lib/utils/timezone";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Selector de fecha en forma de popover: permite saltar de mes en mes (o de
 * golpe a un año concreto con el <select>) y elegir un día concreto, que
 * navega directamente a la vista de día de ese `date`. Es un componente de
 * cliente porque necesita estado local para el mes que se está mostrando en
 * el popover (independiente de la URL hasta que se elige un día).
 */
export function CalendarPicker({ selectedDate, todayStr }: { selectedDate: string; todayStr: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(selectedDate));

  const weeks = getMonthGridWeeks(cursor);
  const [cursorYear, cursorMonth] = cursor.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(cursorYear, cursorMonth - 1, 1)).toLocaleDateString("es-ES", {
    month: "long",
    timeZone: "UTC",
  });
  const currentMonthPrefix = cursor.slice(0, 7);

  const yearOptions: number[] = [];
  const todayYear = Number(todayStr.slice(0, 4));
  for (let y = todayYear - 5; y <= todayYear + 5; y++) yearOptions.push(y);

  function toggle() {
    setCursor(startOfMonth(selectedDate));
    setOpen((o) => !o);
  }

  function goToDate(d: string) {
    setOpen(false);
    router.push(`/dashboard/calendario?view=day&date=${d}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
      >
        📅 Elegir fecha
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-ink-100 bg-white p-3 shadow-lg">
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
                const isSelected = d === selectedDate;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => goToDate(d)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md text-xs transition-colors",
                      inMonth ? "text-ink-700" : "text-ink-300",
                      isSelected
                        ? "bg-ink-900 text-white hover:bg-ink-800"
                        : isToday
                          ? "bg-brand-50 font-semibold text-brand-700 hover:bg-brand-100"
                          : "hover:bg-ink-100",
                    )}
                  >
                    {Number(d.slice(8, 10))}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => goToDate(todayStr)}
              className="mt-2 w-full rounded-lg py-1.5 text-center text-xs font-medium text-brand-600 hover:bg-brand-50"
            >
              Hoy
            </button>
          </div>
        </>
      )}
    </div>
  );
}
