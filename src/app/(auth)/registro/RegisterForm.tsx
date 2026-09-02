"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Input, FieldError } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { BUSINESS_TYPES } from "@/lib/validations/auth";
import { registerAction, type RegisterFormState } from "./actions";

const initialState: RegisterFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" loading={pending}>
      Crear cuenta
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="fullName">Tu nombre</Label>
        <Input id="fullName" name="fullName" autoComplete="name" placeholder="Ej. María García" />
        <FieldError message={fieldErrors.fullName} />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" />
        <FieldError message={fieldErrors.email} />
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
        <FieldError message={fieldErrors.password} />
      </div>

      <div className="border-t border-ink-100 pt-5">
        <p className="mb-4 text-sm font-medium text-ink-700">Tu negocio</p>

        <div className="space-y-5">
          <div>
            <Label htmlFor="businessName">Nombre del negocio</Label>
            <Input id="businessName" name="businessName" placeholder="Ej. Barbería Demo" />
            <FieldError message={fieldErrors.businessName} />
          </div>

          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+34 600 000 000" />
            <FieldError message={fieldErrors.phone} />
          </div>

          <div>
            <Label htmlFor="businessType">Tipo de negocio</Label>
            <select
              id="businessType"
              name="businessType"
              defaultValue=""
              className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
            >
              <option value="" disabled>Selecciona una opción</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <FieldError message={fieldErrors.businessType} />
          </div>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
