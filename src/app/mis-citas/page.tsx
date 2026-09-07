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
    const supabase = await createClient();
    accountData = await getCustomerAccountData(supabase, token);
  }

  return (
    <main className="min-h-screen bg-surface">
      <div className={`container-app py-12 ${accountData ? "max-w-xl" : "max-w-md"}`}>
        {accountData ? <CustomerAccountDashboard data={accountData} /> : <CustomerAuthForm />}
      </div>
    </main>
  );
}
