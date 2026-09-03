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

**⚠️ Pendiente de confirmar por Carlos:** que el build de Vercel con todos
estos archivos termina sin errores, y una prueba manual de las tres vistas
del calendario, el selector de fecha y la nueva sección de estadísticas
con datos reales.

---

## ⏳ Próximas fases

- [ ] Fase 5 — Página pública de reservas
- [ ] Fase 6 — PWA + responsive + UX
- [ ] Fase 7 — Preparación WhatsApp
- [ ] Fase 8 — Suscripciones/Stripe preparado
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
