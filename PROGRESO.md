# Progreso del proyecto

## ✅ Fase 1 — Arquitectura + configuración + Supabase + autenticación

**Implementado:**

- Proyecto Next.js 14 (App Router) + TypeScript estricto + Tailwind CSS,
  estructura de carpetas completa (`app`, `components`, `lib`, `types`).
- Design system base: `Button`, `Input`, `Label`, `Card`, `Alert`, con
  paleta neutra + un único color de acento, radios suaves y sin
  gradientes/sombras pesadas.
- Landing pública completa (`/`) con todas las secciones pedidas: hero,
  cómo funciona, funcionalidades, para quién es, WhatsApp y recordatorios,
  calendario, testimonios (marcados explícitamente como placeholders),
  precio (5 €/mes + prueba de 14 días) y FAQ.
- Esquema de base de datos completo en `supabase/migrations/`:
  `profiles`, `businesses`, `business_members`, `services`, `employees`,
  `employee_services`, `business_hours`, `blocked_dates`,
  `booking_settings`, `customers`, `bookings`, `notifications`. UUIDs,
  `created_at`/`updated_at`, triggers de mantenimiento.
- Row Level Security en todas las tablas: aislamiento multi-tenant por
  `business_id` vía `business_members`, con políticas específicas de
  lectura pública (solo lo necesario) para la futura página de reservas.
- Constraint de exclusión (`bookings_no_overlap`) a nivel de base de datos
  para que nunca se solapen dos reservas activas del mismo recurso.
- Funciones `security definer` `get_available_slots` y
  `create_public_booking`: toda la lógica de disponibilidad vive en el
  backend, no en el cliente (preparado para la Fase 3).
- Autenticación con Supabase Auth: `/registro` (crea usuario + negocio en
  la misma operación, con slug único autogenerado) y `/login`, con
  Server Actions, validación con Zod y mensajes de error claros.
- Middleware de sesión + protección de `/dashboard`, `/onboarding` y
  `/admin`.
- Panel privado mínimo pero funcional: layout con sidebar (escritorio) y
  navegación inferior (móvil), página de inicio con contadores reales
  (citas de hoy, clientes, reservas totales) y una página de
  configuración que ya muestra el enlace público del negocio.
- Página pública `/negocio/[slug]` mínima pero real: lee el negocio y sus
  servicios activos respetando RLS (sin exponer nada de otros negocios).
- `whatsappService.ts` con `sendBookingConfirmation`,
  `sendBookingReminder` y `sendCancellationMessage` mockeadas (logs),
  sin ninguna integración falsa.
- `.env.example`, `README.md` con instrucciones completas, seed de
  demostración (`Barbería Demo`).

**Revisión hecha:**

- Repaso manual de cada política RLS (negocio, servicios, empleados,
  horarios, reservas, notificaciones) para confirmar que ningún dato de
  un negocio es alcanzable desde otro, ni por un usuario autenticado de
  otro negocio ni por el rol `anon`.
- Repaso del flujo registro → creación de negocio → onboarding →
  dashboard para confirmar que no queda ningún estado a medias (usuario
  sin negocio, negocio sin `booking_settings`, etc.) gracias a los
  triggers `add_owner_as_member` y `create_default_booking_settings`.

**⚠️ Pendiente de verificar por ti (no se pudo hacer en este entorno):**

- Este entorno de desarrollo no tiene acceso a `registry.npmjs.org`, así
  que **no se ha podido ejecutar `npm install`, `npm run build` ni
  levantar el servidor de desarrollo**. Necesito que ejecutes localmente:
  ```bash
  npm install
  npm run typecheck
  npm run build
  ```
  y me digas si aparece algún error, para corregirlo antes de seguir a la
  Fase 2.
- Tampoco he podido ejecutar las migraciones contra un proyecto Supabase
  real (no hay proyecto conectado desde aquí). Sigue los pasos 2-5 del
  README y confirma que `supabase db push` y el seed se ejecutan sin
  errores.
- Prueba manual sugerida: registrar una cuenta nueva en `/registro`,
  comprobar que aterrizas en `/onboarding/negocio`, y que
  `/dashboard/configuracion` muestra el enlace público correcto.

**No incluido todavía (a propósito, llega en fases posteriores):**

- Onboarding real paso a paso (Fase 2).
- Cálculo de disponibilidad conectado a la UI y flujo de reserva completo
  (Fase 3), aunque las funciones de base de datos ya existen.
- Calendario, gestión de reservas y clientes en el dashboard (Fase 4).
- Flujo completo de reserva pública con selección de fecha/hora (Fase 5).
- Manifest/iconos PWA (Fase 6).
- Envío real de WhatsApp (Fase 7) y Stripe (Fase 8).
- Rol de administrador de plataforma para `/admin` y tests automatizados
  (Fase 9).

---

## ✅ Fase 3 — Sistema de disponibilidad + reservas (motor, sin UI nueva)

Alcance decidido con Carlos: solo la capa de servicio, bien tipada,
apoyada en las funciones de base de datos que ya existían desde la Fase 1.
Ninguna pantalla nueva — las usarán la Fase 4 (calendario/panel) y la
Fase 5 (reserva pública).

**Implementado:**

- `src/lib/services/availabilityService.ts` — `getAvailableSlots()`,
  envoltorio tipado de `get_available_slots` (horario del día, incluida
  jornada partida, días bloqueados, antelación mín./máx., buffer y
  solapes — toda esa lógica ya vivía en Postgres).
- `src/lib/services/bookingService.ts`:
  - `createPublicBooking()` — envoltorio de `create_public_booking`
    (revalida el hueco en Postgres, crea/actualiza cliente y reserva).
  - `listBookings()` — lista reservas del negocio autenticado, con
    filtros de rango de fechas y estado (para el calendario de la Fase 4).
  - `cancelBooking()` — cancelación manual desde el panel (la cancelación
    por WhatsApp con lista de espera es la Fase 7).

**Verificado por Carlos (SQL Editor, con datos reales):** `get_available_slots`
devuelve huecos de 30 min cada 15 min entre las 07:00–18:00 UTC (= 09:00–20:00
hora de Madrid, conversión de zona horaria correcta) para un día laborable,
respetando la duración del servicio y el horario configurado. Motor
confirmado funcionando en producción.

**Corregido durante la fase:** el build de Vercel falló al añadir estos
dos archivos (`client.rpc(...)` no resolvía el overload de argumentos —
mismo tipo de fallo de inferencia de tipos que motivó los `as any` en
`.insert()`/`.update()`, ver `database.types.ts`). Se arregló envolviendo
la llamada como `(client.rpc as any)(...)`.

---

## ✅ Fase 4 — Dashboard: calendario, reservas, clientes y estadísticas

**Implementado:**

- `src/lib/services/customersService.ts` — `listCustomers()`.
- `src/lib/services/bookingService.ts` (ampliado) — `listBookings()`,
  `listBookingsWithDetails()` (une reserva + nombre de cliente + nombre de
  servicio con consultas planas, sin selects anidados) y `cancelBooking()`.
- `src/lib/utils/timezone.ts` (ampliado) — además de las utilidades de la
  Fase 3, ahora incluye `dateStringInTimezone`, `addMonthsToDateString`,
  `startOfMonth`, `startOfWeek` y `getMonthGridWeeks`, para poder agrupar
  reservas por día/semana/mes en la zona horaria del negocio.
- `/dashboard/reservas` — listado con pestañas Próximas / Pasadas /
  Canceladas y botón de cancelar reserva.
- `/dashboard/calendario` — vista de **Día** (agenda), **Semana** (7
  columnas con resumen por día) y **Mes** (cuadrícula con nº de reservas
  por día, clicable para ir directo a esa jornada), con navegación
  Anterior/Siguiente adaptada a la vista activa y un selector de fecha en
  popover (`CalendarPicker`) para saltar directamente a mes/año/día
  concretos.
- `/dashboard/clientes` — listado de clientes con nº de reservas y última
  visita, con buscador por nombre/teléfono.
- `/dashboard/inicio` — ahora muestra **todas** las reservas de hoy (antes
  mostraba solo las próximas 5), además de los contadores existentes.
- `/dashboard/estadisticas` (nueva sección, pedida por Carlos) —
  `src/lib/services/statsService.ts` calcula, agregando en memoria sobre
  todas las reservas/clientes del negocio (sin funciones SQL nuevas):
  clientes totales, reservas totales, ingresos totales y ticket medio
  (solo reservas confirmadas/completadas), tasa de cancelación, servicios
  más populares, cada cuánto vuelve un cliente a por cada servicio,
  ranking de clientes por nº de visitas, ranking de clientes más
  frecuentes (menor intervalo medio entre visitas) y reservas por día de
  la semana.
- Nuevo icono "chart" y entrada "Estadísticas" en la barra lateral
  (`nav-items.ts` / `Icon.tsx`).

**Decisiones de tipado:** en `/dashboard/reservas/page.tsx` se construye el
objeto de filtros con un `let` tipado explícitamente y ramas `if/else` en
vez de spreads condicionales (`...(cond && {...})`), porque ese patrón le
hace perder a TypeScript el tipo literal de `statuses`/`order` — ver el
comentario en el propio archivo.

**✅ Verificado por Carlos en producción**, incluidas las mejoras
posteriores de esta misma fase: paginación (clientes y reservas, 5/20/50
por página), corrección del caché de navegación de Next.js que dejaba
"pegada" la pestaña anterior en Reservas (`staleTimes.dynamic: 0` en
`next.config.mjs`), la función RPC `get_my_primary_business` para reducir
idas y vueltas a Supabase en cada página, `loading.tsx` del panel, y el
favicon con la Z del logo. **Fase 4 cerrada.**

---

## ✅ Fase 5 — Página pública de reservas

**Implementado:**

- `src/lib/services/publicBusinessService.ts` (nuevo) — `getPublicBusinessBySlug()`,
  extraído de `/negocio/[slug]` para compartirlo con la nueva página de
  reserva sin duplicar la consulta ni sus tipos.
- `/negocio/[slug]` — cada servicio ahora tiene un botón "Reservar" que
  lleva directo al asistente con ese servicio preseleccionado, más un
  enlace "Ver todos los huecos disponibles" al final.
- `/negocio/[slug]/reservar` (nueva) — el asistente de reserva en sí, sin
  necesidad de cuenta:
  1. **Servicio** (se salta este paso si ya viene de `?servicio=` o si el
     negocio solo tiene uno).
  2. **Fecha y hora** — tira de días horizontal (próximos 30 días) +
     huecos disponibles para el día elegido, calculados con el motor de
     la Fase 3 (`get_available_slots`, respeta jornada partida, buffer,
     antelación mínima/máxima y días bloqueados).
  3. **Tus datos** — nombre, teléfono, email opcional y comentario
     opcional.
  4. **Confirmación** — pantalla de éxito con los detalles de la cita.
- `src/components/public/BookingWizard.tsx` (nuevo) — todo el asistente
  vive en un componente de cliente; cambiar de día vuelve a pedir huecos
  con una Server Action (`getSlotsAction`), sin recargar la página.
- `src/app/negocio/[slug]/reservar/actions.ts` (nuevo) — `getSlotsAction`
  (envuelve `getAvailableSlots`) y `createPublicBookingAction` (envuelve
  `createPublicBooking`; valida los datos de contacto con Zod y, si tiene
  éxito, dispara `sendBookingConfirmation` del `whatsappService` mockeado
  — best-effort, un fallo ahí nunca deshace la reserva ya creada).
- `src/lib/validations/publicBooking.ts` (nuevo) — validación del
  formulario de contacto (nombre, teléfono, email/comentario opcionales).

**Seguridad:** todo pasa por el cliente `anon` de Supabase (sin sesión) —
exactamente como ya estaba pensado desde la Fase 1/3: `get_available_slots`
y `create_public_booking` son `security definer` con `execute` concedido a
`anon`, y son las únicas puertas de entrada a datos de reservas desde la
página pública. Si dos personas reservan el mismo hueco casi a la vez,
`create_public_booking` revalida el hueco en Postgres antes de crear la
reserva — quien llega segundo recibe "Ese horario ya no está disponible"
y el asistente le vuelve a la selección de hora con los huecos ya
actualizados, en vez de crear un solape.

**Límite conocido (aceptado para el MVP):** la tira de fechas siempre
muestra 30 días, sin comprobar el `max_notice_days` real configurado en
"Configuración de reservas" — si un negocio permite reservar con menos
antelación, esos días de más simplemente no muestran huecos (el motor los
descarta igualmente), no es un fallo, solo una franja que no hace falta
mostrar.

**✅ Verificado por Carlos**: build de Vercel limpio y reserva real de
principio a fin contra `/negocio/tu-slug` (elegir servicio, huecos, datos
de contacto y confirmación) funcionando correctamente. **Fase 5 cerrada.**

---

## ✅ Fase 6 — PWA + responsive + UX

**Implementado:**

- `src/app/manifest.ts` (nuevo) — convención de Next.js que genera
  `/manifest.webmanifest` y enlaza automáticamente el `<link rel="manifest">`,
  sin tocar `layout.tsx`: nombre, colores de marca (`#0c0c0e`),
  `start_url` directa a `/dashboard/inicio` y `display: "standalone"`.
- Iconos nuevos en `public/`: `icon-192.png` / `icon-512.png` (uso
  general, `purpose: "any"`) e `icon-192-maskable.png` /
  `icon-512-maskable.png` (con margen de seguridad alrededor del logo,
  `purpose: "maskable"`, para que Android no recorte la "Z" al aplicar
  formas de icono redondeadas/circulares).
- `public/sw.js` (nuevo) — service worker mínimo, a propósito **sin
  ninguna lógica de caché**: solo lo justo para que Chrome/Android
  considere la app instalable. No cachear nada es intencional — este es
  un panel de reservas donde la disponibilidad cambia constantemente, y
  cachear peticiones podría hacer que un negocio viera datos viejos.
- `src/components/ServiceWorkerRegister.tsx` (nuevo) — registra ese
  service worker desde el cliente al cargar cualquier página; montado una
  vez en `RootLayout`.
- `src/app/layout.tsx` — añadido `appleWebApp` (capable, barra de estado
  translúcida, título) porque Safari/iOS no lee el manifest para todo
  esto.
- Resultado: en Chrome/Android y Safari/iOS, "Añadir a pantalla de
  inicio" instala ZoriaBooking como una app con su propio icono, sin
  barra de navegador, arrancando directamente en el panel.

**Auditoría de responsive/UX (móvil, 375px de ancho) sobre la web en
producción:**

- Landing pública completa, `/login`, `/registro` y la página pública de
  negocio (`/negocio/[slug]`) revisadas de arriba a abajo en móvil: sin
  desbordamientos horizontales, botones y formularios a tamaño cómodo
  para el dedo, textos legibles.
- Investigada una sospecha de fallo real: en la sección "WhatsApp y
  recordatorios" de la landing, el simulador de chat (`WhatsAppMock`)
  parecía dejar un hueco en blanco al bajar rápido con scroll simulado.
  Confirmado que **no es un fallo**: esa sección usa el mismo componente
  `Reveal` (aparición con scroll) que el resto de la landing, y al bajar
  a velocidad normal aparece correctamente, con todas las burbujas del
  chat una a una. El hueco solo se veía al saltar directamente a esa
  posición sin scroll intermedio, algo que no ocurre navegando de forma
  normal.
- No se ha podido probar el panel (`/dashboard/...`) en el navegador en
  este entorno porque requiere iniciar sesión con tus credenciales — esa
  parte se ha revisado por código (mismas clases responsive que el resto
  del panel, ya usado y verificado por ti en las fases 3-5).

**✅ Fase 6 cerrada.**

---

## ✅ Fase 7 — Lista de espera y reoferta automática al cancelar

Todavía **no hay conexión real con WhatsApp** (hace falta que crees una
cuenta de WhatsApp Business Platform — Meta Cloud API o un proveedor como
Twilio — y me pases las credenciales; `whatsappService.ts` ya está
preparado para enchufarlas sin tocar el resto de la app). Mientras tanto,
todo el motor de negocio de la lista de espera ya funciona de verdad, y el
"Sí/No" de WhatsApp se simula con un enlace público de un solo uso.

**Implementado:**

- `supabase/migrations/0006_waitlist.sql` (nueva, **hay que ejecutarla en
  el SQL Editor** antes de usar esto) — tabla `waitlist_entries` (cada
  entrada es cliente + servicio + día que quiere, nunca solo el cliente,
  porque el hueco liberado tiene que encajar en duración con su servicio)
  y tres funciones:
  - `offer_waitlist_slot(...)` — interna: busca a la primera persona en
    espera ese día cuyo servicio quepa en un hueco dado, por orden de
    llegada (`created_at`), y le marca la oferta.
  - `offer_next_waitlist_candidate(p_booking_id)` — se llama justo tras
    cancelar una cita desde el panel.
  - `respond_to_waitlist_offer(p_token, p_accept)` — la puerta pública
    (`anon`): si acepta, revalida que el hueco sigue libre y crea la cita
    en el momento; si rechaza, ofrece automáticamente el mismo hueco a la
    siguiente persona que encaje (así se implementa el "salta a quien no
    encaje, sigue el orden de la lista" que pediste).
- `src/lib/services/waitlistService.ts` (nuevo) — `addToWaitlist()` (alta
  manual desde el panel, con su propio upsert de cliente por teléfono, ya
  que aún no hay alta manual de clientes en general), `listWaitlist()`,
  `deleteWaitlistEntry()`, `offerNextWaitlistCandidate()` y
  `respondToWaitlistOffer()`.
- `/dashboard/lista-espera` (nueva, enlazada desde el menú) — ver quién
  espera, su estado (Esperando / Oferta enviada / Aceptó / Rechazó /
  Caducó) y añadir a alguien a mano (por ejemplo, tras una llamada).
- `cancelBookingAction` (`/dashboard/reservas/actions.ts`) ahora, tras
  cancelar, busca a quien encaje en la lista de espera de ese día y le
  "avisa" (mock) — best-effort: si el aviso fallara, la cancelación ya
  hecha no se deshace.
- `/lista-espera/[token]` (nueva, pública, sin sesión) — la página que
  llevaría el enlace del mensaje de WhatsApp, con dos botones ("Sí, la
  quiero" / "No, gracias"). Al rechazar, encadena automáticamente la
  oferta a la siguiente persona en espera, exactamente igual que si lo
  hiciera la función de Postgres desde el panel.
- `whatsappService.ts` — nueva función `sendWaitlistOffer()`, mockeada
  igual que las demás (log en consola, `sent: false`), lista para
  sustituirse por la llamada real a la Graph API en cuanto tengas cuenta.

**Límite conocido (aceptado para el MVP):** la lista de espera no distingue
empleado — se apunta al negocio en general, no a una persona concreta, y la
cita que se crea al aceptar no lleva empleado asignado. Para negocios de un
único profesional esto no cambia nada; para negocios con varios empleados,
de momento no reserva con el mismo empleado que tenía la cita cancelada.

**Seguridad:** `respond_to_waitlist_offer` es la única puerta que tiene
`anon`, y solo puede tocar la fila que coincide con el `respond_token`
(un UUID aleatorio de un solo uso) — nunca puede listar ni adivinar otras
entradas de la lista de espera. Antes de crear la cita revalida que el
hueco sigue libre, por si acaso.

**Pendiente para más adelante (no bloquea seguir con la Fase 8):**

- Conectar WhatsApp de verdad (necesita que tú crees la cuenta —
  avísame cuando la tengas y lo enchufo).
- "Modificar cita por WhatsApp" (la otra mitad de las notas de producto
  de más abajo): de momento solo está resuelta la cancelación → lista de
  espera; reprogramar una cita ya existente por WhatsApp queda para
  cuando haya integración real, ya que sin botones de WhatsApp de verdad
  no tiene mucho sentido simular esa conversación completa.

---

## ✅ Fase 7.1 — Email como canal real de avisos (mientras no haya WhatsApp)

Pediste que, mientras no haya WhatsApp real, los avisos (confirmación,
cancelación, oferta de hueco libre) se manden por **email**, pidiéndolo
como dato obligatorio al reservar. Implementado:

- `src/lib/email/emailService.ts` (nuevo) — capa de email, mismo patrón
  que `whatsappService.ts`: usa la API HTTP de Resend directamente (sin
  SDK) y, si `RESEND_API_KEY` no está configurada, deja un log (mock) en
  vez de fingir un envío real. Funciones: `sendBookingConfirmationEmail`,
  `sendCancellationEmail`, `sendWaitlistOfferEmail`.
- **El email pasa a ser obligatorio** en el formulario público de reserva
  (`publicBookingContactSchema` / `BookingWizard.tsx`) — antes era
  opcional. Los clientes añadidos a mano desde el panel (lista de espera)
  siguen pudiendo dejarlo en blanco, ya que quien llama por teléfono puede
  no tenerlo a mano.
- `supabase/migrations/0007_waitlist_email.sql` (nueva, **hay que
  ejecutarla en el SQL Editor**) — las funciones de la lista de espera
  (`offer_waitlist_slot`, `offer_next_waitlist_candidate`,
  `respond_to_waitlist_offer`) ahora también devuelven el email del
  cliente, para poder avisarle por correo además del enlace mockeado de
  WhatsApp.
- Conectado en los tres puntos donde ya se avisaba (o debía avisarse):
  - Al confirmar una reserva pública → email de confirmación.
  - Al cancelar una cita desde el panel → email de cancelación al cliente
    (antes esto no se avisaba en ningún canal).
  - Al ofertar un hueco liberado a la lista de espera (tanto al cancelar
    como en la cadena de rechazos) → email con el enlace de
    aceptar/rechazar, si el cliente tiene email guardado.
  - Al aceptar una oferta desde el enlace público → email de confirmación
    de la nueva cita, igual que una reserva normal.
- Todos los envíos son best-effort (try/catch aparte): si el email
  fallara, la reserva/cancelación/oferta ya hecha no se deshace ni se
  muestra como error.

**Pendiente de tu lado para que los emails salgan de verdad:** crear una
cuenta gratuita en [resend.com](https://resend.com), coger la API key y
pasármela como variable de entorno `RESEND_API_KEY` en Vercel. Sin eso,
todo sigue funcionando igual que hasta ahora pero solo con logs (como
WhatsApp). Para poder enviar a cualquier destinatario (no solo a tu propio
email de la cuenta de Resend) hace falta además verificar un dominio
propio ahí — mientras tanto se puede probar con el remitente de pruebas
de Resend, pero solo llegará a la dirección con la que te registraste en
Resend.

---

## ✅ Fase 7.2 — Portal del cliente + corrección de hora en emails

**Corregido:** el email de "se ha liberado un hueco" mostraba la hora en
UTC en vez de en la zona horaria del negocio (`formatDateForEmail` tenía
`timeZone: "UTC"` fijo en `emailService.ts`) — por eso no coincidía con la
hora real de la cita ofertada. Ahora la zona horaria se pasa siempre desde
donde se envía el email (confirmación, cancelación y oferta de lista de
espera), incluida una columna nueva `business_timezone` en
`respond_to_waitlist_offer` para el flujo público de aceptar/rechazar, que
no tenía otra forma de saber la zona horaria del negocio.

**Calendario para añadir a alguien a la lista de espera:** el formulario
manual del panel (`/dashboard/lista-espera`) usaba un `<input type="date">`
nativo; ahora usa el mismo selector visual (`DatePicker`, mes en
cuadrícula con año y "Hoy") que ya se ve en `/dashboard/calendario`.

**Portal del cliente (nuevo):** pediste que el cliente final pudiera
apuntarse y borrarse él mismo de la lista de espera, y tener un panel con
sus citas. Sigue sin hacer falta crear cuenta ni contraseña — se accede
por un enlace personal de un solo negocio que llega por email y sirve
también de "sesión" (30 días):

- `/negocio/[slug]/mis-citas` — panel del cliente: pestaña **Inicio** (su
  próxima cita y su lista de espera si está apuntado), **Próximas** y
  **Pasadas**. Desde Inicio puede apuntarse a la lista de espera (mismo
  selector de fecha) y quitarse con un clic.
- Si no tiene sesión todavía, se le pide el teléfono o email con el que
  reservó y se le manda un enlace de acceso por correo (mensaje siempre
  igual, esté o no registrado ese contacto, para no filtrar información).
- `/negocio/[slug]/lista-espera` (nueva, pública) — para quien quiere
  apuntarse a la lista de espera SIN haber reservado antes; enlazada desde
  el propio asistente de reserva cuando un día no tiene huecos ("Apuntarme
  a la lista de espera →") y desde la página del negocio ("¿Ya reservaste
  antes? Ver mis citas").
- `supabase/migrations/0010_customer_portal.sql` (nueva, **hay que
  ejecutarla en el SQL Editor**) — tabla `customer_access_tokens` (sin
  políticas RLS propias, solo accesible a través de funciones `security
  definer`) y 5 funciones nuevas: `request_customer_access`,
  `get_customer_portal_data`, `join_waitlist_self`, `leave_waitlist_self`
  y `join_waitlist_public`.

**⚠️ Dos migraciones nuevas pendientes de ejecutar en el SQL Editor, en
este orden:** `0009_respond_offer_timezone.sql` y
`0010_customer_portal.sql`. Sin ellas, el panel y la página pública
seguirán funcionando, pero el arreglo de la hora en el email y el portal
del cliente darán error hasta que se ejecuten.

**⚠️ Pendiente de tu lado — 1 archivo viejo de Stripe a borrar a mano:**
`supabase/migrations/0008_stripe.sql` quedó obsoleto (la Fase 8, más abajo,
lo sustituye por `0011_stripe.sql` con los mismos datos pero repensado
desde cero) — bórralo, no lo ejecutes. **`src/lib/stripe/stripeService.ts`,
`src/app/api/stripe/webhook/route.ts` y `src/components/dashboard/SubscriptionCard.tsx`
NO se borran** — son nuevos, forman parte de la Fase 8 ya implementada,
no los restos que se pidió aparcar antes.

---

## ✅ Fase 7.3 — Cuenta de cliente de verdad (sustituye al enlace mágico)

Dijiste que el enlace por email de la Fase 7.2 era un rollo, y que
preferías un login normal (email + contraseña) donde, si reservas en dos
negocios distintos que usen la app, veas las citas de ambos en la misma
cuenta. Se ha sustituido el portal de la Fase 7.2 entero por esto —
**ejecuta `0012_customer_accounts.sql`, no `0010_customer_portal.sql`** si
todavía no habías ejecutado esta última (si ya la habías ejecutado, no
pasa nada: `0012` deshace esas tablas/funciones ella sola).

- `/mis-citas` (nueva, sustituye a `/negocio/[slug]/mis-citas`) — ya NO
  depende de un negocio concreto: es una cuenta global con email y
  contraseña de verdad. Al crearla o iniciar sesión, el panel agrega
  automáticamente las citas de **todos** los negocios donde haya un
  cliente con ese mismo email — sin ningún paso de "vincular cuentas": si
  ya reservaste antes con ese email en cualquier negocio (o reservas
  después, con o sin sesión iniciada), aparece solo. Contraseñas guardadas
  con hash (`pgcrypto`, `bcrypt`), nunca en texto plano.
- Pestañas Inicio (próxima cita + lista de espera activa, de cualquier
  negocio) / Próximas / Pasadas — cada fila indica de qué negocio es.
  Se puede quitar de una lista de espera con un clic; para apuntarse a
  una nueva, se sigue haciendo desde la página del negocio en cuestión
  (`/negocio/[slug]/lista-espera`), y aparecerá sola en el panel al
  siguiente inicio de sesión.
- `supabase/migrations/0012_customer_accounts.sql` (nueva, **hay que
  ejecutarla en el SQL Editor**) — elimina `customer_access_tokens` y las
  funciones del enlace mágico (`request_customer_access`,
  `get_customer_portal_data`, `join_waitlist_self`, `leave_waitlist_self`)
  y las sustituye por `customer_accounts` / `customer_sessions` y las
  funciones `customer_signup`, `customer_login`, `customer_logout`,
  `get_customer_account_data` y `leave_waitlist_by_account`. También
  actualiza `join_waitlist_public` (quita el token que ya no hace falta).
- El enlace "¿Ya reservaste antes? Ver mis citas" de la página de cada
  negocio ahora lleva a `/mis-citas` (antes iba a una ruta por negocio).
- El email de "apuntado a la lista de espera" ahora invita a crear una
  cuenta en `/mis-citas` con el mismo email, en vez de mandar un enlace de
  acceso de un solo negocio.

**Ajuste pedido después:** si alguien intenta iniciar sesión con un email
que no tiene cuenta, ahora se le avisa ("No tienes ninguna cuenta con ese
email") y la pantalla salta sola a la pestaña de "Crear cuenta" con ese
mismo email ya puesto, en vez del mensaje genérico de antes. A propósito
se distingue este caso del de "contraseña incorrecta" (que sí sigue dando
un mensaje aparte) — para una app de reservas no es información sensible
saber si un email tiene cuenta o no, así que prima la comodidad.
`supabase/migrations/0013_customer_login_hint.sql` (nueva, **hay que
ejecutarla en el SQL Editor**, después de `0012`).

**⚠️ Archivos que ya no existen y hay que borrar de tu carpeta** (los
sustituye todo lo de arriba):

- `src/app/negocio/[slug]/mis-citas/` (carpeta entera: `page.tsx`,
  `actions.ts` y `verificar/route.ts`)
- `src/components/public/RequestAccessForm.tsx`
- `src/components/public/CustomerPortal.tsx`
- `src/lib/services/customerSession.ts`
- `src/lib/services/customerPortalService.ts`

---

## ✅ Fase 8 — Suscripciones (Stripe)

Retomada ahora que el portal del cliente y el arreglo de emails ya están
verificados. Como con WhatsApp/email, se usa la API HTTP de Stripe
directamente (sin SDK) — la única diferencia es que aquí no tiene sentido
"mockear" un cobro: mientras no configures las variables de entorno, el
botón de pago simplemente avisa de que Stripe no está configurado, en vez
de simular nada.

**Implementado:**

- `supabase/migrations/0011_stripe.sql` (nueva, **hay que ejecutarla en el
  SQL Editor**) — añade `stripe_customer_id` y `stripe_subscription_id` a
  `businesses`.
- `src/lib/stripe/stripeService.ts` (nuevo) — `createCheckoutSession()`
  (Checkout Session en modo suscripción para el plan de 5 €/mes, reutiliza
  el cliente de Stripe si el negocio ya tenía uno), `createBillingPortalSession()`
  (portal de facturación: cambiar tarjeta, ver facturas, cancelar) y
  `verifyStripeSignature()` (verificación manual de la firma del webhook
  con `crypto`, sin SDK — HMAC-SHA256 sobre `timestamp.cuerpo`, comparación
  con `timingSafeEqual` y rechazo de eventos con más de 5 minutos).
- `src/app/api/stripe/webhook/route.ts` (nuevo) — recibe
  `checkout.session.completed` (activa la suscripción y guarda los IDs de
  Stripe), `customer.subscription.updated`/`.created` (sincroniza el
  estado: activa/en prueba → `active`, impago → `past_due`, cualquier otro
  → `cancelled`) y `customer.subscription.deleted` (→ `cancelled`). Usa el
  cliente `admin` (service role) porque esta petición no lleva sesión de
  ningún usuario, solo la firma de Stripe.
- `/dashboard/configuracion` — la tarjeta "Suscripción"
  (`SubscriptionCard.tsx`, nuevo) ahora es real: muestra el estado actual,
  y un botón que lleva a pagar (si no está activa) o a gestionar la
  suscripción en el portal de Stripe (si ya está activa).
- `startCheckoutAction` / `openBillingPortalAction`
  (`dashboard/configuracion/actions.ts`) — envuelven las dos funciones de
  arriba con el negocio de la sesión actual.

**⚠️ Pendiente de tu lado para activarlo de verdad:**

1. En el Dashboard de Stripe (modo prueba primero, para probar sin cobrar
   de verdad): crea un producto con un precio recurrente de 5 €/mes y
   copia su ID (`price_...`).
2. Copia tu clave secreta (`sk_test_...` en modo prueba).
3. Crea un endpoint de webhook apuntando a
   `https://tu-dominio-de-vercel/api/stripe/webhook`, suscrito a
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.created` y `customer.subscription.deleted`, y
   copia su "signing secret" (`whsec_...`).
4. Añade en Vercel: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` y
   `STRIPE_WEBHOOK_SECRET` (ver `.env.example`).
5. Ejecuta `0011_stripe.sql` en el SQL Editor de Supabase.

Sin esto, el botón "Pasar a plan de pago" da un error claro ("Stripe no
está configurado todavía...") en vez de fallar en silencio. Cuando quieras
probar con dinero real hace falta repetir 1-3 en modo real (`sk_live_...`)
y cambiar las variables de entorno.

---

## ⏳ Próximas fases

- [ ] Fase 9 — Testing + seguridad + revisión final

---

## 📝 Notas de producto para fases futuras

Requisitos que Carlos ha ido detallando, capturados aquí para no perderlos
aunque todavía no toque implementarlos (dependen de trabajo de fases
anteriores que aún no existe: disponibilidad real, reservas, etc.).

### Fase 7 — WhatsApp: modificar/crear cita y lista de espera

- Al crear o modificar una cita por WhatsApp, se debe mostrar al cliente un
  listado de huecos acorde a los **servicios que tiene dados de alta el
  negocio** (no una lista genérica).
- Al modificar una cita, el hueco ofrecido tiene que respetar la
  **duración del servicio**: no se puede encajar un servicio de 1h en un
  hueco libre de 30 min, por ejemplo.
- **Lista de espera**: cada entrada es `cliente + servicio` (no solo el
  cliente), precisamente porque el hueco que se libere tiene que encajar
  en duración con el servicio que esa persona quiere.
- Cuando se libera una cita (cancelación), se avisa **en orden** a la
  lista de espera — solo a las personas cuyo servicio encaja en tiempo con
  el hueco liberado — y se espera la respuesta del cliente (sí/no quiere
  esa cita) antes de pasar a la siguiente.
- Si la persona avisada **rechaza** el hueco: se pasa a ofrecerlo a la
  siguiente persona de la lista de espera cuyo servicio encaje en tiempo
  con ese hueco (respetando el orden de la lista, saltando a quien no
  encaje).
- Si la persona avisada **acepta** el hueco: se crea su cita, se elimina
  su entrada de la lista de espera y se reordena el resto de la lista.

---

## 🔧 Rendimiento del panel (tras reportar lentitud al navegar, especialmente en el calendario)

**Causa real:** cada página del panel pasa por `requireBusinessContext()`,
que hacía 3 idas y vueltas de red a Supabase seguidas (comprobar sesión +
buscar membresía + buscar negocio) antes incluso de empezar a pedir los
datos propios de la página. El calendario, además, suma sus propias
consultas (reservas + clientes + servicios). Sin ninguna pantalla de
carga intermedia, todo eso se notaba como una pantalla "congelada" en
cada clic.

**Arreglado:**

- `supabase/migrations/0005_primary_business_rpc.sql` (nueva, hay que
  ejecutarla en el SQL Editor) — función `get_my_primary_business()` que
  hace en una sola llamada lo que antes eran dos consultas secuenciadas.
  Usa `auth.uid()` internamente (nunca un id recibido por parámetro) para
  que, aunque sea `security definer`, un usuario nunca pueda leer el
  negocio de otro.
- `src/lib/services/businessService.ts` — `getPrimaryBusinessForUser()`
  ahora llama a esa función en vez de hacer las dos consultas.
- `src/app/dashboard/loading.tsx` (nueva) — pantalla de carga instantánea
  que Next.js muestra automáticamente en CUALQUIER página del panel
  mientras esa página resuelve sus datos, incluido cambiar de vista/fecha
  dentro del propio calendario. Antes no había ninguna, así que la espera
  se sentía como que la app se había quedado colgada.
- Reactivado el prefetch de los enlaces del menú (ver más abajo, ya
  corregido antes de esto).

**⚠️ Pendiente — IMPORTANTE, hacerlo antes de dar por bueno el deploy:**
ejecutar `0005_primary_business_rpc.sql` en el SQL Editor de Supabase
(igual que se hizo con el bucket de logos). El build de Vercel compilará
sin problema aunque no se ejecute, pero en cuanto alguien abra el panel en
producción, la llamada a `get_my_primary_business()` fallará en tiempo de
ejecución porque la función todavía no existe en la base de datos —
**el panel entero dejaría de funcionar** hasta ejecutar la migración.
