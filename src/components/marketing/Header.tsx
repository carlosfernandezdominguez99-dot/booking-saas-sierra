import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";

/**
 * Se comprueba la sesión aquí (Server Component async) para que alguien ya
 * logueado que llega a la landing vea "Ir al panel" en vez de "Iniciar
 * sesión" / "Probar gratis" — si no, parece que la sesión se ha cerrado
 * aunque siga activa. Es solo una mejora visual: no reemplaza ninguna
 * comprobación de seguridad (esas siguen en el middleware y en
 * `requireBusinessContext`).
 */
export async function MarketingHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/70 backdrop-blur-md">
      <div className="container-app flex h-16 items-center justify-between">
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-white">
          Zoria<span className="text-brand-400">Booking</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex">
          <a href="#como-funciona" className="transition-colors hover:text-white">Cómo funciona</a>
          <a href="#funcionalidades" className="transition-colors hover:text-white">Funcionalidades</a>
          <a href="#precio" className="transition-colors hover:text-white">Precio</a>
          <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard/inicio">
              <Button variant="primary" size="sm">Ir al panel</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Iniciar sesión</Button>
              </Link>
              <Link href="/registro">
                <Button variant="primary" size="sm">Probar gratis</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
