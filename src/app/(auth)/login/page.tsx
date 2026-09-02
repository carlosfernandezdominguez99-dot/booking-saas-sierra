import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50/50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-ink-900">
            Booking<span className="text-brand-500">SaaS</span>
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-950">
            Bienvenido de nuevo
          </h1>
          <p className="mt-1 text-sm text-ink-500">Accede al panel de tu negocio.</p>
        </div>

        <Card>
          <Suspense>
            <LoginForm />
          </Suspense>
        </Card>

        <p className="mt-6 text-center text-sm text-ink-500">
          ¿Aún no tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-ink-900 hover:underline">
            Pruébalo gratis
          </Link>
        </p>
      </div>
    </main>
  );
}
