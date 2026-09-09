"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/utils/cn";
import { loginForInviteAction, signupForInviteAction } from "./actions";

type Mode = "signup" | "login";

export function AcceptInviteForm({
  token,
  email,
  employeeName,
}: {
  token: string;
  email: string;
  employeeName: string;
}) {
  const [mode, setMode] = useState<Mode>("signup");
  const [fullName, setFullName] = useState(employeeName);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const res =
          mode === "signup"
            ? await signupForInviteAction(token, email, fullName, password)
            : await loginForInviteAction(token, email, password);

        if (res.needsEmailConfirmation) {
          setNotice(
            "Te hemos enviado un email para confirmar tu cuenta. Confírmalo y vuelve a abrir este mismo enlace de invitación para iniciar sesión.",
          );
          return;
        }
        if (res.error) {
          setError(res.error);
        }
        // Si no hay error, la Server Action ya redirige al panel.
      } catch {
        setError("Algo ha ido mal. Inténtalo de nuevo en unos segundos.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setNotice(null);
          }}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            mode === "signup" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500",
          )}
        >
          Crear cuenta
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
            setNotice(null);
          }}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            mode === "login" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500",
          )}
        >
          Ya tengo cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} disabled />
        </div>

        {mode === "signup" && (
          <div>
            <Label>Tu nombre</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" required />
          </div>
        )}

        <div>
          <Label>Contraseña</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Al menos 8 caracteres" : "Tu contraseña"}
            required
          />
        </div>

        {notice && <Alert tone="info">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" className="w-full" loading={isPending}>
          {mode === "signup" ? "Crear cuenta y unirme" : "Entrar y unirme"}
        </Button>
      </form>
    </div>
  );
}
