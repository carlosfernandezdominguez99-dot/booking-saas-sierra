import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { Section, SectionHeading } from "@/components/marketing/Section";

const FEATURES = [
  {
    title: "Página de reservas propia",
    description:
      "Cada negocio tiene su enlace: tudominio.com/negocio/tu-negocio. Compártelo por Instagram, WhatsApp o Google.",
  },
  {
    title: "Sin cuentas para tus clientes",
    description: "Reservan con su nombre y teléfono en menos de un minuto, sin registrarse ni instalar nada.",
  },
  {
    title: "Disponibilidad siempre correcta",
    description: "El sistema calcula los huecos libres según tu horario, tus servicios y las reservas ya existentes.",
  },
  {
    title: "Calendario claro",
    description: "Vistas de día, semana y mes con el estado de cada cita: pendiente, confirmada, cancelada o completada.",
  },
  {
    title: "Clientes organizados",
    description: "Se guardan automáticamente con su historial de reservas, sin hojas de cálculo ni agendas de papel.",
  },
  {
    title: "Preparado para WhatsApp",
    description: "Confirmaciones y recordatorios automáticos por WhatsApp (próximamente).",
  },
];

const AUDIENCE = [
  "Peluquerías",
  "Barberías",
  "Centros de estética",
  "Fisioterapia",
  "Academias",
  "Autoescuelas",
  "Entrenadores personales",
  "Y cualquier negocio que trabaje con citas",
];

const TESTIMONIALS = [
  {
    quote: "Desde que uso el enlace de reservas, mis clientas ya no me escriben a las 11 de la noche para pedir cita.",
    name: "Nombre de ejemplo",
    role: "Peluquería · testimonio de muestra",
  },
  {
    quote: "Configurar los horarios y servicios me llevó diez minutos. El resto lo lleva solo.",
    name: "Nombre de ejemplo",
    role: "Barbería · testimonio de muestra",
  },
  {
    quote: "Ver todas las citas del día de un vistazo me ha cambiado la forma de organizar la semana.",
    name: "Nombre de ejemplo",
    role: "Centro de estética · testimonio de muestra",
  },
];

const FAQS = [
  {
    q: "¿Mis clientes necesitan crear una cuenta para reservar?",
    a: "No. Solo introducen su nombre y teléfono. No hace falta contraseña ni instalar ninguna app.",
  },
  {
    q: "¿Puedo probarlo antes de pagar?",
    a: "Sí, tienes 14 días de prueba gratuita con todas las funciones activas, sin necesidad de tarjeta.",
  },
  {
    q: "¿Qué pasa si dos clientes intentan reservar la misma hora?",
    a: "El sistema comprueba la disponibilidad en el servidor en el momento de confirmar, por lo que nunca se duplican dos citas en el mismo hueco.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, la suscripción es mensual y sin permanencia.",
  },
];

export default function LandingPage() {
  return (
    <>
      <MarketingHeader />

      <main>
        {/* Hero */}
        <Section className="pb-16 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-ink-950 sm:text-6xl">
              Reservas sencillas.
              <br />
              Negocios más organizados.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-ink-500">
              Da a tu negocio una página de reservas propia en minutos. Tus clientes reservan
              solos, sin cuenta ni apps, y tú lo gestionas todo desde un panel simple.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/registro">
                <Button size="lg">Probar gratis</Button>
              </Link>
              <a href="#como-funciona">
                <Button size="lg" variant="outline">Ver cómo funciona</Button>
              </a>
            </div>
            <p className="mt-4 text-sm text-ink-400">
              14 días gratis · sin tarjeta · cancela cuando quieras
            </p>
          </div>
        </Section>

        {/* Cómo funciona */}
        <Section id="como-funciona" className="border-t border-ink-100">
          <SectionHeading
            eyebrow="Cómo funciona"
            title="De cero a recibiendo reservas en tres pasos"
          />
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { step: "1", title: "Configura tu negocio", text: "Añade tus servicios, precios y horarios en un asistente guiado." },
              { step: "2", title: "Comparte tu enlace", text: "tudominio.com/negocio/tu-negocio, listo para tu Instagram, Google o WhatsApp." },
              { step: "3", title: "Recibe reservas", text: "Aparecen al instante en tu calendario, sin llamadas ni mensajes cruzados." },
            ].map((item) => (
              <Card key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-sm font-semibold text-white">
                  {item.step}
                </div>
                <h3 className="mb-2 font-semibold text-ink-900">{item.title}</h3>
                <p className="text-sm text-ink-500">{item.text}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* Funcionalidades */}
        <Section id="funcionalidades" className="border-t border-ink-100 bg-ink-50/50">
          <SectionHeading eyebrow="Funcionalidades" title="Todo lo que necesitas, nada de lo que sobra" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <h3 className="mb-2 font-semibold text-ink-900">{f.title}</h3>
                <p className="text-sm text-ink-500">{f.description}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* Para quién es */}
        <Section className="border-t border-ink-100">
          <SectionHeading eyebrow="Para quién es" title="Pensado para negocios que trabajan con citas" />
          <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3">
            {AUDIENCE.map((a) => (
              <span
                key={a}
                className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm text-ink-700"
              >
                {a}
              </span>
            ))}
          </div>
        </Section>

        {/* WhatsApp y recordatorios */}
        <Section className="border-t border-ink-100 bg-ink-50/50">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-600">
                WhatsApp y recordatorios
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
                Menos ausencias, sin esfuerzo
              </h2>
              <p className="mt-4 text-ink-500">
                Confirmaciones automáticas al reservar y recordatorios antes de la cita, para que
                tus clientes no se olviden y tú pierdas menos huecos. (Integración con WhatsApp
                Business en despliegue progresivo.)
              </p>
            </div>
            <Card className="bg-ink-950 text-white">
              <p className="text-xs uppercase tracking-wide text-ink-400">WhatsApp</p>
              <div className="mt-4 space-y-3">
                <div className="max-w-xs rounded-2xl rounded-tl-sm bg-ink-800 p-3 text-sm">
                  Hola María, tu reserva en Barbería Demo está confirmada: Corte + barba, mañana a las 17:00.
                </div>
                <div className="max-w-xs rounded-2xl rounded-tl-sm bg-ink-800 p-3 text-sm">
                  Recordatorio: tu cita es en 2 horas 👋
                </div>
              </div>
            </Card>
          </div>
        </Section>

        {/* Calendario */}
        <Section className="border-t border-ink-100">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center justify-between text-sm font-medium text-ink-700">
                <span>Hoy</span>
                <span className="text-ink-400">Día · Semana · Mes</span>
              </div>
              <div className="space-y-2">
                {[
                  { time: "09:30", name: "Juan Pérez", service: "Corte de pelo", status: "Confirmada" },
                  { time: "11:00", name: "Ana Ruiz", service: "Corte + barba", status: "Pendiente" },
                  { time: "17:00", name: "Luis Gómez", service: "Arreglo de barba", status: "Confirmada" },
                ].map((b) => (
                  <div key={b.time} className="flex items-center justify-between rounded-xl border border-ink-100 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-ink-900">{b.time}</span>
                      <span className="text-ink-500">{b.name} · {b.service}</span>
                    </div>
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs text-ink-600">{b.status}</span>
                  </div>
                ))}
              </div>
            </Card>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-600">Calendario</p>
              <h2 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
                Toda tu agenda, de un vistazo
              </h2>
              <p className="mt-4 text-ink-500">
                Vistas de día, semana y mes con el estado real de cada cita. Crea reservas
                manuales, edítalas o cancélalas sin salir del calendario.
              </p>
            </div>
          </div>
        </Section>

        {/* Testimonios */}
        <Section className="border-t border-ink-100 bg-ink-50/50">
          <SectionHeading
            eyebrow="Opiniones"
            title="Lo que dicen los negocios que ya reservan así"
            description="Ejemplos ilustrativos del tipo de experiencia que buscamos ofrecer — se sustituirán por testimonios reales."
          />
          <div className="grid gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name + t.role}>
                <p className="mb-2 inline-block rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                  Testimonio de muestra
                </p>
                <p className="text-sm text-ink-700">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-4 text-sm font-medium text-ink-900">{t.name}</p>
                <p className="text-xs text-ink-400">{t.role}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* Precio */}
        <Section id="precio" className="border-t border-ink-100">
          <SectionHeading eyebrow="Precio" title="Un único plan, sin sorpresas" />
          <Card className="mx-auto max-w-sm text-center">
            <p className="text-sm text-ink-500">Todo incluido</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight text-ink-950">
              5€<span className="text-lg font-medium text-ink-400">/mes</span>
            </p>
            <p className="mt-2 text-sm text-ink-500">14 días de prueba gratis, sin tarjeta</p>
            <ul className="mt-6 space-y-2 text-left text-sm text-ink-600">
              {[
                "Página de reservas propia",
                "Servicios y horarios ilimitados",
                "Calendario y gestión de clientes",
                "Reservas sin límite",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-brand-500">✓</span> {item}
                </li>
              ))}
            </ul>
            <Link href="/registro" className="mt-8 block">
              <Button size="lg" className="w-full">Probar gratis 14 días</Button>
            </Link>
          </Card>
        </Section>

        {/* FAQ */}
        <Section id="faq" className="border-t border-ink-100 bg-ink-50/50">
          <SectionHeading eyebrow="Preguntas frecuentes" title="Todo lo que quieras saber" />
          <div className="mx-auto max-w-2xl divide-y divide-ink-100">
            {FAQS.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink-900">
                  {item.q}
                  <span className="ml-4 text-ink-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-ink-500">{item.a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* CTA final */}
        <Section className="border-t border-ink-100">
          <Card className="mx-auto max-w-3xl bg-ink-950 text-center text-white">
            <h2 className="text-3xl font-semibold tracking-tight">
              Empieza a recibir reservas hoy mismo
            </h2>
            <p className="mx-auto mt-3 max-w-md text-ink-300">
              Crea tu cuenta gratis, configura tu negocio en minutos y comparte tu enlace de reservas.
            </p>
            <Link href="/registro" className="mt-8 inline-block">
              <Button size="lg" variant="secondary">Probar gratis</Button>
            </Link>
          </Card>
        </Section>
      </main>

      <MarketingFooter />
    </>
  );
}
