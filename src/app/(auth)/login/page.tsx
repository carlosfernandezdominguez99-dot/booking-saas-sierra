import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/15 blur-[100px] animate-glow-pulse" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="ZoriaBooking" className="h-12 w-12" />
            <span className="text-sm font-semibold tracking-tight text-white">
              Zoria<span className="text-brand-400">Booking</span>
            </span>
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            Bienvenido de nuevo
          </h1>
          <p className="mt-1 text-sm text-white/50">Accede al panel de tu negocio.</p>
        </div>

        <Card>
          <Suspense>
            <LoginForm />
          </Suspense>
        </Card>

        <p className="mt-6 text-center text-sm text-white/40">
          ¿Aún no tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-white hover:underline">
            Pruébalo gratis
          </Link>
        </p>
      </div>
    </main>
  );
}
