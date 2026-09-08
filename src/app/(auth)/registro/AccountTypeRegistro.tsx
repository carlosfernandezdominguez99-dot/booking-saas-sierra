"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { CustomerAuthForm } from "@/components/public/CustomerAuthForm";
import { RegisterForm } from "./RegisterForm";

type AccountType = "negocio" | "cliente";

/** Mismo selector que en `/login` (ver `AccountTypeLogin.tsx`) pero para el registro. */
export function AccountTypeRegistro() {
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
        <RegisterForm />
      ) : (
        <CustomerAuthForm bare initialMode="signup" redirectTo="/mis-citas" />
      )}
    </div>
  );
}
