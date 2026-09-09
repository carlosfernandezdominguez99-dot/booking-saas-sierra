"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { updateEmployeeAction } from "@/app/dashboard/empleados/actions";

/**
 * Edición del nombre de un empleado desde Configuración, cuando el panel
 * está "puesto" en él (Fase 10) — mismo `updateEmployeeAction` que ya usa
 * `/dashboard/empleados`, solo que aquí solo se enseña el campo de
 * nombre. Al guardar refresca la página para que el círculo del selector
 * (arriba, en el layout) también recoja el cambio.
 */
export function EmployeeIdentityForm({ employeeId, initialName }: { employeeId: string; initialName: string }) {
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
      const result = await updateEmployeeAction(employeeId, { name: trimmed });
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
        <Label htmlFor="employee-identity-name">Nombre</Label>
        <Input id="employee-identity-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="button" size="sm" loading={isPending} onClick={handleSave}>
        Guardar
      </Button>
    </div>
  );
}
