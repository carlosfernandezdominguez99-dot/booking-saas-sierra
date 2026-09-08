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

export function CustomerAuthForm({
  initialMode = "login",
  redirectTo,
  bare = false,
  title = "Mis citas",
  description = "Una cuenta para ver tus citas en cualquier negocio que use ZoriaBooking.",
}: {
  /** Pestaña con la que arranca el formulario. Por defecto "login". */
  initialMode?: Mode;
  /**
   * A dónde ir tras un login/registro correcto. Si no se da, se recarga la
   * página actual (comportamiento de siempre en `/mis-citas`, donde el
   * Server Component ya sabe pintar el panel una vez hay cookie). Se usa
   * `redirectTo` cuando este formulario aparece incrustado en otra página
   * (p. ej. el aviso de "inicia sesión para reservar") y hay que volver
   * justo a donde estaba el visitante, no solo recargar.
   */
  redirectTo?: string;
  /**
   * Sin la tarjeta ni el encabezado propios — para cuando ya los pone la
   * página que lo incrusta (p. ej. el selector "Soy negocio"/"Soy cliente"
   * de `/login` y `/registro`).
   */
  bare?: boolean;
  title?: string;
  description?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function goToDestination() {
    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }
    window.location.reload();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      if (mode === "login") {
        const res = await loginAction({ email, password });
        if (res.error) {
          if (res.accountNotFound) {
            // Pedido explícito: si intenta entrar y no tiene cuenta, se le
            // avisa y se pasa solo a la pestaña de registro (con el email
            // ya puesto) en vez de dejarle un mensaje genérico de error.
            setMode("signup");
            setNotice("No tienes ninguna cuenta con ese email — regístrate abajo.");
            return;
          }
          setError(res.error);
          return;
        }
        goToDestination();
        return;
      }

      const res = await signupAction({ email, password, name, phone });
      if (res.error) {
        setError(res.error);
        return;
      }
      // Éxito: la Server Action ya puso la cookie y revalidó la ruta, así
      // que basta con recargar (o ir a `redirectTo`) para que se pinte el
      // siguiente paso ya con sesión.
      goToDestination();
    });
  }

  const body = (
    <>
      <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
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
          Iniciar sesión
        </button>
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

        {notice && <Alert tone="info">{notice}</Alert>}
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
    </>
  );

  if (bare) {
    return <div className="space-y-5">{body}</div>;
  }

  return (
    <Card className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-ink-950">{title}</h1>
        <p className="mt-1 text-sm text-ink-500">{description}</p>
      </div>
      {body}
    </Card>
  );
}
