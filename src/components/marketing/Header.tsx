import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/80 bg-surface/80 backdrop-blur-md">
      <div className="container-app flex h-16 items-center justify-between">
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink-900">
          Booking<span className="text-brand-500">SaaS</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-ink-600 md:flex">
          <a href="#como-funciona" className="hover:text-ink-900">Cómo funciona</a>
          <a href="#funcionalidades" className="hover:text-ink-900">Funcionalidades</a>
          <a href="#precio" className="hover:text-ink-900">Precio</a>
          <a href="#faq" className="hover:text-ink-900">FAQ</a>
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
