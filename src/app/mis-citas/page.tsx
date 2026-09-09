import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCustomerSessionToken } from "@/lib/services/customerAuthSession";
import { getCustomerAccountData } from "@/lib/services/customerAccountService";
import { CustomerAuthForm } from "@/components/public/CustomerAuthForm";
import { CustomerAccountDashboard } from "@/components/public/CustomerAccountDashboard";

export const metadata: Metadata = { title: "Mis citas" };

// Cuenta de cliente (Fase 7.3) — global, no de un negocio en concreto:
// agrega las citas y listas de espera de CUALQUIER negocio de la app que
// tenga un cliente con el mismo email que esta cuenta (ver
// `get_customer_account_data`, que empareja por email, no por un enlace
// mágico como en la versión anterior).
export default async function MisCitasPage() {
  const token = await getCustomerSessionToken();

  let accountData = null;
  if (token) {
    try {
      const supabase = await createClient();
      accountData = await getCustomerAccountData(supabase, token);
    } catch {
      // Si la consulta falla por lo que sea, se enseña el formulario de
      // login/registro en vez de tirar toda la página abajo — igual que
      // en `/negocio/[slug]/reservar` y `/lista-espera`.
      accountData = null;
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-8rem] h-80 w-80 -translate-x-1/2 rounded-full bg-brand-200/40 blur-[110px]" />
      </div>

      <div className={`container-app relative py-12 ${accountData ? "max-w-xl" : "max-w-md"}`}>
        <Link href="/" className="mb-8 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="ZoriaBooking" className="h-10 w-10" />
          <span className="text-sm font-semibold tracking-tight text-ink-900">
            Zoria<span className="text-brand-600">Booking</span>
          </span>
        </Link>

        {accountData ? (
          <CustomerAccountDashboard data={accountData} />
        ) : (
          <>
            <CustomerAuthForm />
            {/*
              Sin esto, alguien que cierra sesión aquí (o llega directo a
              esta URL) se queda sin forma de volver al selector "Soy
              negocio"/"Soy cliente" de `/login` — este formulario es solo
              el de cliente.
            */}
            <p className="mt-4 text-center text-sm text-ink-400">
              ¿Eres el negocio?{" "}
              <Link href="/login" className="font-medium text-brand-600 hover:underline">
                Inicia sesión aquí
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
