# ZoriaBooking

Sistema de reservas online para pequeños negocios (peluquerías, barberías,
centros de estética, fisioterapia, academias, autoescuelas, entrenadores
personales...). Los negocios se registran, configuran servicios y
horarios, y reciben reservas de sus clientes a través de una página
pública sin necesidad de que estos creen cuenta ni instalen nada.

Construido con Next.js (App Router) + TypeScript + Tailwind CSS +
Supabase (Postgres, Auth, RLS), pensado desde el diseño para servir en el
futuro a una app móvil con React Native + Expo sin cambiar el backend.

## Estado del proyecto

Ver `PROGRESO.md` para el detalle fase a fase. Ahora mismo: **Fase 1
completada** (arquitectura, Supabase, autenticación). El resto de
funcionalidades (onboarding, disponibilidad/reservas, calendario, página
pública de reservas, PWA, WhatsApp, Stripe...) se van añadiendo en fases
posteriores.

## Stack

- Next.js 14 (App Router, Server Actions)
- React 18 + TypeScript estricto
- Tailwind CSS
- Supabase (Postgres + Auth + Row Level Security)
- Preparado para PWA, WhatsApp Business Platform y Stripe (aún no activos)

## 1. Instalar dependencias

Requiere Node.js 18.18+ y npm.

```bash
npm install
```

## 2. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Instala el [Supabase CLI](https://supabase.com/docs/guides/cli) si no lo
   tienes:
   ```bash
   npm install -g supabase
   ```
3. Vincula el proyecto local con tu proyecto de Supabase:
   ```bash
   supabase login
   supabase link --project-ref <tu-project-ref>
   ```

## 3. Variables de entorno

Copia el archivo de ejemplo y rellena los valores desde
**Project Settings → API** en el dashboard de Supabase:

```bash
cp .env.example .env.local
```

Variables imprescindibles para el MVP:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor; **nunca** la expongas con `NEXT_PUBLIC_`)
- `NEXT_PUBLIC_SITE_URL` (p. ej. `http://localhost:3000` en desarrollo)

Las variables de WhatsApp y Stripe se dejan vacías hasta sus fases
correspondientes (Fase 7 y Fase 8).

> En el dashboard de Supabase, en **Authentication → Providers → Email**,
> puedes desactivar "Confirm email" durante el desarrollo para poder
> probar el registro sin tener que confirmar el correo cada vez.

## 4. Ejecutar migraciones

Las migraciones viven en `supabase/migrations/` y crean el esquema
completo (tablas, índices, constraint de no-solape de reservas, RLS y
funciones de disponibilidad/reserva pública).

```bash
supabase db push
```

(o `supabase db reset` si prefieres partir de una base local limpia; esto
también ejecuta las migraciones desde cero).

## 5. Ejecutar el seed de demostración

`supabase/seed.sql` crea "Barbería Demo" con servicios, horario y un par
de reservas de ejemplo. Como los negocios pertenecen siempre a un usuario
real de Supabase Auth, primero necesitas un usuario:

1. Arranca la app (paso 6) y regístrate una vez en `/registro`.
2. Copia el UUID de ese usuario desde **Authentication → Users** en el
   dashboard de Supabase.
3. Abre `supabase/seed.sql` y sustituye `demo_owner_id` por ese UUID.
4. Ejecuta el seed:
   ```bash
   supabase db execute -f supabase/seed.sql
   ```
   (o pega el contenido del archivo en el SQL Editor del dashboard).

## 6. Ejecutar el proyecto en desarrollo

```bash
npm run dev
```

Abre `http://localhost:3000`.

Otros comandos útiles:

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript sin emitir
npm run build      # build de producción
```

## 7. Deploy en Vercel

1. Sube el repositorio a GitHub.
2. Importa el repositorio en [Vercel](https://vercel.com/new).
3. Añade las mismas variables de entorno de `.env.local` en
   **Project Settings → Environment Variables** de Vercel (usa las claves
   de tu proyecto de Supabase de producción, no las de desarrollo si son
   distintas).
4. Despliega. Vercel detecta Next.js automáticamente; no hace falta
   configuración adicional.

## Estructura del proyecto

```
src/
  app/
    (marketing)/        Landing pública ("/")
    (auth)/              /login, /registro
    dashboard/           Panel privado del negocio (protegido)
    onboarding/          Asistente de configuración (protegido)
    negocio/[slug]/      Página pública de reservas de cada negocio
    admin/               Zona administrativa interna (básica)
  components/
    ui/                  Design system propio (Button, Input, Card...)
    marketing/           Componentes de la landing
    dashboard/           Sidebar, navegación móvil, etc.
  lib/
    supabase/            Clientes de Supabase (browser, server, admin, middleware)
    services/            Lógica de negocio (nunca se accede a Supabase directamente desde la UI)
    validations/         Esquemas Zod
    whatsapp/            whatsappService.ts (mock hasta la Fase 7)
  types/
    database.types.ts    Tipos generados/mantenidos a mano del esquema de Supabase
supabase/
  migrations/            Esquema SQL + RLS + funciones de disponibilidad/reserva
  seed.sql               Datos de demostración
```

## Seguridad y multi-tenant

- Row Level Security activo en todas las tablas de negocio; el
  aislamiento entre negocios se hace en la base de datos, no confiando en
  el frontend.
- La página pública de reservas nunca lee directamente las tablas
  sensibles (`bookings`, `business_hours`, `customers`...); consulta
  disponibilidad y crea reservas exclusivamente a través de las funciones
  `get_available_slots` y `create_public_booking` (`security definer`),
  que devuelven solo lo estrictamente necesario.
- Un constraint de exclusión a nivel de base de datos (`bookings_no_overlap`)
  impide que dos reservas activas se solapen para el mismo negocio y
  recurso, incluso ante condiciones de carrera.

## Nota sobre el entorno de desarrollo usado para generar este código

Este proyecto se generó en un entorno sin acceso a `registry.npmjs.org`,
por lo que las dependencias no se han podido instalar ni el build
verificar en ese entorno. Ejecuta `npm install` y `npm run build`
localmente (o en CI/Vercel, donde sí hay acceso a npm) antes de dar por
válida cualquier fase.
