"use client";

import { Suspense, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { CustomerAuthForm } from "@/components/public/CustomerAuthForm";
import { LoginForm } from "./LoginForm";

type AccountType = "negocio" | "cliente";

/**
 * Pedido explícito de Carlos: al iniciar sesión hay que elegir si eres el
 * negocio (login normal con Supabase Auth, `LoginForm`) o un cliente (la
 * cuenta de `/mis-citas`) — cada uno lleva a un sitio distinto tras entrar.
 * Este selector solo decide QUÉ formulario se pinta; cada uno gestiona su
 * propio envío y redirección.
 */
export function AccountTypeLogin() {
  const [accountType, setAccountType] = useState<AccountType>("negocio");

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
        <button
          type="button"
          onClick={() => setAccountType("negocio")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            accountType === "negocio" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500",
          )}
        >
          Soy un negocio
        </button>
        <button
          type="button"
          onClick={() => setAccountType("cliente")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            accountType === "cliente" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500",
          )}
        >
          Soy cliente
        </button>
      </div>

      {accountType === "negocio" ? (
        <Suspense>
          <LoginForm />
        </Suspense>
      ) : (
        <CustomerAuthForm bare initialMode="login" redirectTo="/mis-citas" />
      )}
    </div>
  );
}
