import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { Reveal } from "@/components/marketing/Reveal";

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
    title: "WhatsApp lo automatiza todo",
    description: "Recordatorios, confirmaciones, cambios y lista de espera gestionados solos, sin que tú muevas un dedo.",
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
    q: "¿Cómo funciona lo de WhatsApp exactamente?",
    a: "Configuras con cuánta antelación quieres avisar (por ejemplo 24h antes) y el sistema envía un recordatorio con botones de Confirmar, Cambiar o Cancelar. Si el cliente cambia o cancela, se reorganiza el hueco solo y se avisa a quien esté en lista de espera para ese día.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, la suscripción es mensual y sin permanencia.",
  },
];

export default function LandingPage() {
  return (
    <div className="dark bg-ink-950">
      <MarketingHeader />

      <main className="overflow-x-hidden">
        {/* Hero */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px] animate-glow-pulse" />
            <div className="absolute -right-24 top-40 h-72 w-72 rounded-full bg-brand-400/10 blur-[100px] animate-float" />
            <div className="absolute -left-24 top-96 h-72 w-72 rounded-full bg-brand-600/10 blur-[100px] animate-float-delayed" />
          </div>

          <Section className="relative pb-20 pt-24 sm:pt-32">
            <Reveal>
              <div className="mx-auto max-w-3xl text-center">
                <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
                  Ahora con recordatorios automáticos por WhatsApp
                </span>
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                  Reservas sencillas.
                  <br />
                  <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-brand-200 bg-clip-text text-transparent">
                    Negocios más organizados.
                  </span>
                </h1>
                <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
                  Da a tu negocio una página de reservas propia en minutos. Tus clientes reservan
                  solos, sin cuenta ni apps, y WhatsApp se encarga de confirmaciones, recordatorios
                  y cambios por ti.
                </p>
                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link href="/registro">
                    <Button size="lg">Probar gratis</Button>
                  </Link>
                  <a href="#como-funciona">
                    <Button size="lg" variant="outline">Ver cómo funciona</Button>
                  </a>
                </div>
                <p className="mt-4 text-sm text-white/30">
                  14 días gratis · sin tarjeta · cancela cuando quieras
                </p>
              </div>
            </Reveal>
          </Section>
        </div>

        {/* Cómo funciona */}
        <Section id="como-funciona" className="border-t border-white/10">
          <Reveal>
            <SectionHeading
              eyebrow="Cómo funciona"
              title="De cero a recibiendo reservas en tres pasos"
            />
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { step: "1", title: "Configura tu negocio", text: "Añade tus servicios, precios y horarios en un asistente guiado." },
              { step: "2", title: "Comparte tu enlace", text: "tudominio.com/negocio/tu-negocio, listo para tu Instagram, Google o WhatsApp." },
              { step: "3", title: "Recibe reservas", text: "Aparecen al instante en tu calendario, sin llamadas ni mensajes cruzados." },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 120}>
                <Card className="group text-center transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/30">
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-ink-950 shadow-[0_0_20px_-4px_theme(colors.brand.500)] transition-transform duration-300 group-hover:scale-110">
                    {item.step}
                  </div>
                  <h3 className="mb-2 font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-white/50">{item.text}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* Funcionalidades */}
        <Section id="funcionalidades" className="border-t border-white/10 bg-white/[0.02]">
          <Reveal>
            <SectionHeading eyebrow="Funcionalidades" title="Todo lo que necesitas, nada de lo que sobra" />
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 100}>
                <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/30">
                  <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-brand-400 to-brand-600 transition-transform duration-300 group-hover:scale-x-100" />
                  <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
                  <p className="text-sm text-white/50">{f.description}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* Para quién es */}
        <Section className="border-t border-white/10">
          <Reveal>
            <SectionHeading eyebrow="Para quién es" title="Pensado para negocios que trabajan con citas" />
          </Reveal>
          <Reveal delay={150}>
            <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3">
              {AUDIENCE.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:border-brand-500/40 hover:text-white"
                >
                  {a}
                </span>
              ))}
            </div>
          </Reveal>
        </Section>

        {/* WhatsApp y recordatorios */}
        <Section className="relative overflow-hidden border-t border-white/10 bg-white/[0.02]">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-brand-500/10 blur-[100px]"
          />
          <div className="relative grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-400">
                  WhatsApp y recordatorios
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Tu recepcionista automático, 24 horas al día
                </h2>
                <p className="mt-4 text-white/60">
                  Tú decides con cuánta antelación avisar (24h antes, por ejemplo) y a partir de ahí
                  WhatsApp lleva la conversación entera:
                </p>
                <ul className="mt-6 space-y-4">
                  {[
                    {
                      title: "Confirmación con un toque",
                      text: "El cliente pulsa “Confirmar” y la cita pasa a confirmada en tu panel al instante.",
                    },
                    {
                      title: "Cambios sin llamadas",
                      text: "Si pulsa “Cambiar”, el sistema le ofrece el próximo hueco libre — ese mismo día o el más cercano.",
                    },
                    {
                      title: "Huecos que nunca se pierden",
                      text: "Si cancela, el hueco se libera solo y se ofrece automáticamente a quien esté en lista de espera para ese día, por orden de llegada.",
                    },
                  ].map((item) => (
                    <li key={item.title} className="flex gap-3">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs text-brand-400">
                        ✓
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="text-sm text-white/50">{item.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <WhatsAppMock />
            </Reveal>
          </div>
        </Section>

        {/* Calendario */}
        <Section className="border-t border-white/10">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <Card>
                <div className="mb-4 flex items-center justify-between text-sm font-medium text-white/70">
                  <span>Hoy</span>
                  <span className="text-white/30">Día · Semana · Mes</span>
                </div>
                <div className="space-y-2">
                  {[
                    { time: "09:30", name: "Juan Pérez", service: "Corte de pelo", status: "Confirmada" },
                    { time: "11:00", name: "Ana Ruiz", service: "Corte + barba", status: "Pendiente" },
                    { time: "17:00", name: "Luis Gómez", service: "Arreglo de barba", status: "Confirmada" },
                  ].map((b) => (
                    <div
                      key={b.time}
                      className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm transition-colors hover:border-brand-500/30"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white">{b.time}</span>
                        <span className="text-white/50">{b.name} · {b.service}</span>
                      </div>
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">{b.status}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
            <Reveal delay={150}>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-400">Calendario</p>
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Toda tu agenda, de un vistazo
                </h2>
                <p className="mt-4 text-white/60">
                  Vistas de día, semana y mes con el estado real de cada cita. Crea reservas
                  manuales, edítalas o cancélalas sin salir del calendario.
                </p>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* Testimonios */}
        <Section className="border-t border-white/10 bg-white/[0.02]">
          <Reveal>
            <SectionHeading
              eyebrow="Opiniones"
              title="Lo que dicen los negocios que ya reservan así"
              description="Ejemplos ilustrativos del tipo de experiencia que buscamos ofrecer — se sustituirán por testimonios reales."
            />
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name + t.role} delay={i * 120}>
                <Card className="transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/30">
                  <p className="mb-2 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white/50">
                    Testimonio de muestra
                  </p>
                  <p className="text-sm text-white/70">&ldquo;{t.quote}&rdquo;</p>
                  <p className="mt-4 text-sm font-medium text-white">{t.name}</p>
                  <p className="text-xs text-white/30">{t.role}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* Precio */}
        <Section id="precio" className="border-t border-white/10">
          <Reveal>
            <SectionHeading eyebrow="Precio" title="Un único plan, sin sorpresas" />
          </Reveal>
          <Reveal delay={100}>
            <div className="relative mx-auto max-w-sm">
              <div
                aria-hidden
                className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 opacity-40 blur-lg"
              />
              <Card className="relative text-center">
                <p className="text-sm text-white/50">Todo incluido</p>
                <p className="mt-2 text-5xl font-semibold tracking-tight text-white">
                  5€<span className="text-lg font-medium text-white/40">/mes</span>
                </p>
                <p className="mt-2 text-sm text-white/50">14 días de prueba gratis, sin tarjeta</p>
                <ul className="mt-6 space-y-2 text-left text-sm text-white/70">
                  {[
                    "Página de reservas propia",
                    "Servicios y horarios ilimitados",
                    "Calendario y gestión de clientes",
                    "Recordatorios automáticos por WhatsApp",
                    "Reservas sin límite",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="text-brand-400">✓</span> {item}
                    </li>
                  ))}
                </ul>
                <Link href="/registro" className="mt-8 block">
                  <Button size="lg" className="w-full">Probar gratis 14 días</Button>
                </Link>
              </Card>
            </div>
          </Reveal>
        </Section>

        {/* FAQ */}
        <Section id="faq" className="border-t border-white/10 bg-white/[0.02]">
          <Reveal>
            <SectionHeading eyebrow="Preguntas frecuentes" title="Todo lo que quieras saber" />
          </Reveal>
          <Reveal delay={100}>
            <div className="mx-auto max-w-2xl divide-y divide-white/10">
              {FAQS.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                    {item.q}
                    <span className="ml-4 text-white/30 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-white/50">{item.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </Section>

        {/* CTA final */}
        <Section className="border-t border-white/10">
          <Reveal>
            <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-900 to-ink-950 p-10 text-center">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-500/20 blur-[90px]"
              />
              <div className="relative">
                <h2 className="text-3xl font-semibold tracking-tight text-white">
                  Empieza a recibir reservas hoy mismo
                </h2>
                <p className="mx-auto mt-3 max-w-md text-white/60">
                  Crea tu cuenta gratis, configura tu negocio en minutos y comparte tu enlace de reservas.
                </p>
                <Link href="/registro" className="mt-8 inline-block">
                  <Button size="lg">Probar gratis</Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </Section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function WhatsAppMock() {
  return (
    <div className="relative mx-auto max-w-sm">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[2rem] bg-brand-500/10 blur-2xl"
      />
      <Card className="relative overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-ink-950">
            Z
          </div>
          <div>
            <p className="text-sm font-medium text-white">ZoriaBooking</p>
            <p className="flex items-center gap-1.5 text-xs text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              en línea
            </p>
          </div>
        </div>

        <div className="space-y-3 px-4 py-5">
          <ChatBubble delay={0}>
            Hola María 👋 Te recordamos tu cita mañana a las 17:00 en Barbería Demo (Corte + barba).
            ¿Confirmas?
          </ChatBubble>

          <Reveal delay={300}>
            <div className="flex flex-wrap gap-2 pl-1">
              <QuickReply>✅ Confirmar</QuickReply>
              <QuickReply>🔄 Cambiar</QuickReply>
              <QuickReply>❌ Cancelar</QuickReply>
            </div>
          </Reveal>

          <Reveal delay={500}>
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2.5 text-sm text-ink-950">
                🔄 Cambiar
              </div>
            </div>
          </Reveal>

          <ChatBubble delay={700}>
            Claro. ¿Qué día te viene mejor? Te muestro los huecos libres.
          </ChatBubble>

          <Reveal delay={900}>
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2.5 text-sm text-ink-950">
                El viernes
              </div>
            </div>
          </Reveal>

          <ChatBubble delay={1100}>
            El viernes tienes hueco a las 10:00 y a las 16:30. Si no te encaja ninguno, te apunto en
            la lista de espera y te aviso en cuanto se libere algo antes.
          </ChatBubble>
        </div>
      </Card>
    </div>
  );
}

function ChatBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/[0.06] px-3.5 py-2.5 text-sm text-white/85">
        {children}
      </div>
    </Reveal>
  );
}

function QuickReply({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-300">
      {children}
    </span>
  );
}
