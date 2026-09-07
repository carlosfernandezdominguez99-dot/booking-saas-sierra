"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input, FieldError } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils/cn";
import { signupAction, loginAction } from "@/app/mis-citas/actions";

type Mode = "login" | "signup";

export function CustomerAuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res =
        mode === "login"
          ? await loginAction({ email, password })
          : await signupAction({ email, password, name, phone });

      if (res.error) {
        setError(res.error);
        return;
      }
      // Éxito: la Server Action ya puso la cookie y revalidó la ruta, así
      // que basta con recargar para que el Server Component pinte el panel.
      window.location.reload();
    });
  }

  return (
    <Card className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-ink-950">Mis citas</h1>
        <p className="mt-1 text-sm text-ink-500">
          Una cuenta para ver tus citas en cualquier negocio que use ZoriaBooking.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            mode === "login" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500",
          )}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            mode === "signup" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500",
          )}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "signup" && (
          <>
            <div>
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" required />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Tu teléfono"
                required
              />
            </div>
          </>
        )}
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
          />
        </div>
        <div>
          <Label>Contraseña</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Al menos 6 caracteres" : "Tu contraseña"}
            required
          />
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" className="w-full" loading={isPending}>
          {mode === "login" ? "Entrar" : "Crear cuenta"}
        </Button>
      </form>

      {mode === "signup" && (
        <p className="text-center text-xs text-ink-400">
          Usa el mismo email con el que reservaste antes y verás ahí también esas citas.
        </p>
      )}
    </Card>
  );
}
