"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { ServicesManager } from "@/components/dashboard/ServicesManager";
import { HoursEditor } from "@/components/dashboard/HoursEditor";
import type { Database } from "@/types/database.types";
import type { BookingSettingsInput, WeeklyHoursInput } from "@/lib/validations/business";
import {
  finishOnboardingAction,
  saveBusinessProfileAction,
  saveOnboardingBookingSettingsAction,
} from "@/app/onboarding/negocio/actions";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

const STEP_TITLES = [
  "Cuéntanos algo más de tu negocio",
  "Añade tus servicios",
  "Define tu horario",
  "Configura las reservas",
  "¡Todo listo!",
];

export function OnboardingWizard({
  businessName,
  initialProfile,
  initialServices,
  initialWeeklyHours,
  initialBookingSettings,
  publicUrl,
}: {
  businessName: string;
  initialProfile: { description: string; address: string; city: string };
  initialServices: ServiceRow[];
  initialWeeklyHours: WeeklyHoursInput;
  initialBookingSettings: BookingSettingsInput;
  publicUrl: string;
}) {
  const [step, setStep] = useState(1);

  return (
    <div className="w-full max-w-lg">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
          Paso {step} de 5
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">
          {step === 1 ? `¡Cuenta creada, ${businessName}!` : STEP_TITLES[step - 1]}
        </h1>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        {step === 1 && (
          <ProfileStep
            initialProfile={initialProfile}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <div className="space-y-5">
            <ServicesManager initialServices={initialServices} />
            <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </div>
        )}
        {step === 3 && (
          <HoursEditor
            initialHours={initialWeeklyHours}
            submitLabel="Guardar y continuar"
            onSaved={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <SettingsStep initialSettings={initialBookingSettings} onNext={() => setStep(5)} />
        )}
        {step === 5 && <FinishStep publicUrl={publicUrl} />}
      </div>
    </div>
  );
}

function StepNav({ onBack, onNext }: { onBack?: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between">
      {onBack ? (
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Atrás
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" size="sm" onClick={onNext}>
        Continuar
      </Button>
    </div>
  );
}

function ProfileStep({
  initialProfile,
  onNext,
}: {
  initialProfile: { description: string; address: string; city: string };
  onNext: () => void;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleNext() {
    setError(null);
    startTransition(async () => {
      const result = await saveBusinessProfileAction(profile);
      if (result.error) {
        setError(result.error);
        return;
      }
      onNext();
    });
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      <div>
        <Label htmlFor="description">Descripción (opcional)</Label>
        <textarea
          id="description"
          rows={3}
          placeholder="Ej. Peluquería especializada en coloración, en el centro de Madrid."
          value={profile.description}
          onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))}
          className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
        />
      </div>

      <div>
        <Label htmlFor="address">Dirección (opcional)</Label>
        <Input
          id="address"
          placeholder="Calle Mayor 1"
          value={profile.address}
          onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="city">Ciudad (opcional)</Label>
        <Input
          id="city"
          placeholder="Madrid"
          value={profile.city}
          onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
        />
      </div>

      <Button type="button" className="w-full" loading={isPending} onClick={handleNext}>
        Continuar
      </Button>
    </div>
  );
}

function SettingsStep({
  initialSettings,
  onNext,
}: {
  initialSettings: BookingSettingsInput;
  onNext: () => void;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleNext() {
    setError(null);
    startTransition(async () => {
      const result = await saveOnboardingBookingSettingsAction(settings);
      if (result.error) {
        setError(result.error);
        return;
      }
      onNext();
    });
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      <div>
        <Label htmlFor="maxNoticeDays">¿Con cuántos días de antelación puede reservarse?</Label>
        <Input
          id="maxNoticeDays"
          type="number"
          min={1}
          max={365}
          value={settings.maxNoticeDays}
          onChange={(e) => setSettings((s) => ({ ...s, maxNoticeDays: Number(e.target.value) }))}
        />
      </div>

      <div>
        <Label htmlFor="bufferMinutes">Tiempo de descanso entre citas (minutos)</Label>
        <Input
          id="bufferMinutes"
          type="number"
          min={0}
          max={120}
          value={settings.bufferMinutes}
          onChange={(e) => setSettings((s) => ({ ...s, bufferMinutes: Number(e.target.value) }))}
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
        <input
          type="checkbox"
          checked={settings.allowCancellation}
          onChange={(e) => setSettings((s) => ({ ...s, allowCancellation: e.target.checked }))}
          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
        />
        Permitir que los clientes cancelen su cita
      </label>

      {settings.allowCancellation && (
        <div>
          <Label htmlFor="minCancellationHours">Horas mínimas de antelación para cancelar</Label>
          <Input
            id="minCancellationHours"
            type="number"
            min={0}
            max={168}
            value={settings.minCancellationHours}
            onChange={(e) =>
              setSettings((s) => ({ ...s, minCancellationHours: Number(e.target.value) }))
            }
          />
        </div>
      )}

      <Button type="button" className="w-full" loading={isPending} onClick={handleNext}>
        Continuar
      </Button>
    </div>
  );
}

function FinishStep({ publicUrl }: { publicUrl: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFinish() {
    setError(null);
    startTransition(async () => {
      const result = await finishOnboardingAction();
      // Si `finishOnboardingAction` tiene éxito, redirige y esta línea no
      // llega a ejecutarse; solo se alcanza si devuelve un error.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-5 text-center">
      {error && <Alert tone="error">{error}</Alert>}

      <p className="text-sm text-ink-600">
        Esta es la página donde tus clientes reservarán. Compártela donde quieras.
      </p>

      <div className="flex flex-col gap-3 rounded-xl border border-ink-100 bg-ink-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <code className="break-all text-sm text-ink-700">{publicUrl}</code>
        <div className="flex shrink-0 justify-center gap-2">
          <CopyLinkButton url={publicUrl} />
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <Button type="button" variant="ghost" size="sm">
              Ver página
            </Button>
          </a>
        </div>
      </div>

      <Button type="button" className="w-full" loading={isPending} onClick={handleFinish}>
        Ir al panel
      </Button>
    </div>
  );
}
