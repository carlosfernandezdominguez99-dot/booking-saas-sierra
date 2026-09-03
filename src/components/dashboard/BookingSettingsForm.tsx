"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import type { BookingSettingsInput } from "@/lib/validations/business";
import { saveBookingSettingsAction } from "@/app/dashboard/configuracion/actions";

export function BookingSettingsForm({ initialSettings }: { initialSettings: BookingSettingsInput }) {
  const [settings, setSettings] = useState(initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function patch(fields: Partial<BookingSettingsInput>) {
    setSuccess(false);
    setSettings((s) => ({ ...s, ...fields }));
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await saveBookingSettingsAction(settings);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {success && <Alert tone="success">Configuración guardada.</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cfg-maxNoticeDays">Antelación máxima para reservar (días)</Label>
          <Input
            id="cfg-maxNoticeDays"
            type="number"
            min={1}
            max={365}
            value={settings.maxNoticeDays}
            onChange={(e) => patch({ maxNoticeDays: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="cfg-minNoticeMinutes">Antelación mínima para reservar (minutos)</Label>
          <Input
            id="cfg-minNoticeMinutes"
            type="number"
            min={0}
            max={10080}
            value={settings.minNoticeMinutes}
            onChange={(e) => patch({ minNoticeMinutes: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="cfg-bufferMinutes">Descanso entre citas (minutos)</Label>
          <Input
            id="cfg-bufferMinutes"
            type="number"
            min={0}
            max={120}
            value={settings.bufferMinutes}
            onChange={(e) => patch({ bufferMinutes: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="cfg-minCancellationHours">Horas mínimas de antelación para cancelar</Label>
          <Input
            id="cfg-minCancellationHours"
            type="number"
            min={0}
            max={168}
            disabled={!settings.allowCancellation}
            value={settings.minCancellationHours}
            onChange={(e) => patch({ minCancellationHours: Number(e.target.value) })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
        <input
          type="checkbox"
          checked={settings.allowCancellation}
          onChange={(e) => patch({ allowCancellation: e.target.checked })}
          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
        />
        Permitir que los clientes cancelen su cita
      </label>

      <Button type="button" size="sm" loading={isPending} onClick={handleSave}>
        Guardar
      </Button>
    </div>
  );
}
