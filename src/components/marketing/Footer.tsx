import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-ink-100 py-10">
      <div className="container-app flex flex-col items-center justify-between gap-4 text-sm text-ink-500 sm:flex-row">
        <p>© {new Date().getFullYear()} ZoriaBooking. Todos los derechos reservados.</p>
        <div className="flex gap-6">
          <Link href="/login" className="hover:text-ink-800">Acceder</Link>
          <Link href="/registro" className="hover:text-ink-800">Crear cuenta</Link>
        </div>
      </div>
    </footer>
  );
}
