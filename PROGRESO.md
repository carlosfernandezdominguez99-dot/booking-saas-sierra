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

## ⏳ Próximas fases

- [ ] Fase 4 — Dashboard + calendario + clientes
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
