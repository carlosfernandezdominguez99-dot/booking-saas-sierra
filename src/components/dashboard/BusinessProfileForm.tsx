"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { saveBusinessProfileAction } from "@/app/dashboard/configuracion/actions";

type Profile = { description: string; address: string; city: string; managerDisplayName: string };

export function BusinessProfileForm({
  initialProfile,
  hideManagerNameField,
}: {
  initialProfile: Profile;
  /**
   * Fase 11: cuando hay empleados, el alias del gerente se edita desde su
   * propia tarjeta ("Tu perfil como gerente", junto a su foto) en vez de
   * aquí — se sigue guardando igual (viaja con el resto del perfil), solo
   * se oculta este campo para no tener dos sitios editando lo mismo.
   */
  hideManagerNameField?: boolean;
}) {
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
          <Input
            id="profile-address"
            required
            value={profile.address}
            onChange={(e) => patch({ address: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="profile-city">Ciudad</Label>
          <Input id="profile-city" value={profile.city} onChange={(e) => patch({ city: e.target.value })} />
        </div>
      </div>

      {!hideManagerNameField && (
        <div>
          <Label htmlFor="profile-manager-name">Tu nombre como encargado</Label>
          <Input
            id="profile-manager-name"
            required
            value={profile.managerDisplayName}
            onChange={(e) => patch({ managerDisplayName: e.target.value })}
          />
          <p className="mt-1 text-xs text-ink-400">
            Así te ve el cliente al elegir &quot;con quién&quot; si el negocio también tiene empleados.
          </p>
        </div>
      )}

      <Button type="button" size="sm" loading={isPending} onClick={handleSave}>
        Guardar
      </Button>
    </div>
  );
}
