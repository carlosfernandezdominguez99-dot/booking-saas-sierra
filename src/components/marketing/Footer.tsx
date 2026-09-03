import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-ink-950 py-10">
      <div className="container-app flex flex-col items-center justify-between gap-4 text-sm text-white/40 sm:flex-row">
        <p>© {new Date().getFullYear()} ZoriaBooking. Todos los derechos reservados.</p>
        <div className="flex gap-6">
          <Link href="/login" className="transition-colors hover:text-white/80">Acceder</Link>
          <Link href="/registro" className="transition-colors hover:text-white/80">Crear cuenta</Link>
        </div>
      </div>
    </footer>
  );
}
