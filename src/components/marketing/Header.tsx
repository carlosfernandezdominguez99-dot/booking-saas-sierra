import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function MarketingHeader() {
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
          <Link href="/login">
            <Button variant="ghost" size="sm">Iniciar sesión</Button>
          </Link>
          <Link href="/registro">
            <Button variant="primary" size="sm">Probar gratis</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
