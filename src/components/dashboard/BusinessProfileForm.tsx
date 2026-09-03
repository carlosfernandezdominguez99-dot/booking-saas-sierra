"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { saveBusinessProfileAction } from "@/app/dashboard/configuracion/actions";

type Profile = { description: string; address: string; city: string };

export function BusinessProfileForm({ initialProfile }: { initialProfile: Profile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function patch(fields: Partial<Profile>) {
    setSuccess(false);
    setProfile((p) => ({ ...p, ...fields }));
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await saveBusinessProfileAction(profile);
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
      {success && <Alert tone="success">Datos guardados.</Alert>}

      <div>
        <Label htmlFor="profile-description">Descripción</Label>
        <textarea
          id="profile-description"
          rows={3}
          value={profile.description}
          onChange={(e) => patch({ description: e.target.value })}
          className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="profile-address">Dirección</Label>
          <Input id="profile-address" value={profile.address} onChange={(e) => patch({ address: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="profile-city">Ciudad</Label>
          <Input id="profile-city" value={profile.city} onChange={(e) => patch({ city: e.target.value })} />
        </div>
      </div>

      <Button type="button" size="sm" loading={isPending} onClick={handleSave}>
        Guardar
      </Button>
    </div>
  );
}
