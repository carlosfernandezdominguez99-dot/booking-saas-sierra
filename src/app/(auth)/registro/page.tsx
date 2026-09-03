import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Crea tu cuenta" };

export default function RegistroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50/50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-ink-900">
            Zoria<span className="text-brand-500">Booking</span>
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-950">
            Crea tu cuenta
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            14 días de prueba gratis. Sin tarjeta.
          </p>
        </div>

        <Card>
          <RegisterForm />
        </Card>

        <p className="mt-6 text-center text-sm text-ink-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-ink-900 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
