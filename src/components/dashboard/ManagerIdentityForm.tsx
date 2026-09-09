"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { updateManagerNameAction } from "@/app/dashboard/configuracion/actions";

/**
 * Edición del alias del gerente desde Configuración (Fase 11) — mismo
 * patrón que `EmployeeIdentityForm`, pero para el propio propietario: así
 * puede aparecer con su alias, como "un empleado más", en el selector de
 * círculos de arriba y en el paso público "¿con quién?".
 */
export function ManagerIdentityForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    setError(null);
    setSuccess(false);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Introduce un nombre.");
      return;
    }
    startTransition(async () => {
      const result = await updateManagerNameAction(trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      {success && <Alert tone="success">Guardado.</Alert>}
      <div>
        <Label htmlFor="manager-identity-name">Tu alias</Label>
        <Input id="manager-identity-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="button" size="sm" loading={isPending} onClick={handleSave}>
        Guardar
      </Button>
    </div>
  );
}
