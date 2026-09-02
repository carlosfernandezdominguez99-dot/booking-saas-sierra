import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";

/**
 * Zona administrativa interna — versión mínima.
 *
 * Pendiente de diseño: un rol de "platform admin" explícito (hoy no existe
 * en el esquema) para no depender solo de estar autenticado. Se añadirá
 * junto con la Fase 9 (seguridad) antes de exponer esto de verdad. Por
 * ahora solo confirma que la ruta está protegida por sesión.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink-950">
        Administración interna
      </h1>
      <Card className="border-dashed py-16 text-center">
        <CardTitle>Pendiente de rol de administrador</CardTitle>
        <CardDescription>
          El listado de negocios, usuarios, reservas y estado de suscripción se añadirá aquí una
          vez definamos quién puede entrar a esta zona (no cualquier usuario autenticado).
        </CardDescription>
      </Card>
    </main>
  );
}
