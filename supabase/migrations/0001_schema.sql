-- =========================================================================
-- 0001_schema.sql
-- Esquema base del SaaS de reservas: extensiones, tablas, índices,
-- constraint de no-solape y triggers de mantenimiento.
-- =========================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "btree_gist"; -- constraint de exclusión por rango de tiempo

-- -------------------------------------------------------------------------
-- Función auxiliar: mantiene updated_at al día en cualquier tabla.
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- profiles: extiende auth.users con datos propios de la app.
-- -------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea automáticamente el profile cuando se registra un usuario en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- businesses
-- -------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  phone text,
  address text,
  city text,
  business_type text,
  timezone text not null default 'Europe/Madrid',
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_businesses_slug on public.businesses (slug);

create trigger trg_businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- business_members: quién puede administrar cada negocio.
-- -------------------------------------------------------------------------
create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index idx_business_members_user on public.business_members (user_id);

-- Añade automáticamente al creador del negocio como miembro "owner".
create or replace function public.add_owner_as_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.business_members (business_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (business_id, user_id) do nothing;
  return new;
end;
$$;

create trigger trg_businesses_add_owner_member
  after insert on public.businesses
  for each row execute function public.add_owner_as_member();

-- -------------------------------------------------------------------------
-- services
-- -------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_services_business on public.services (business_id);

create trigger trg_services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- employees
-- -------------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_employees_business on public.employees (business_id);

create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

create table public.employee_services (
  employee_id uuid not null references public.employees (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (employee_id, service_id)
);

-- -------------------------------------------------------------------------
-- business_hours: horario semanal general o por empleado.
-- -------------------------------------------------------------------------
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint chk_business_hours_range check (end_time > start_time)
);

create index idx_business_hours_business on public.business_hours (business_id, day_of_week);

-- -------------------------------------------------------------------------
-- blocked_dates: vacaciones, festivos o días cerrados.
-- -------------------------------------------------------------------------
create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete cascade,
  date date not null,
  reason text,
  created_at timestamptz not null default now()
);

create index idx_blocked_dates_business on public.blocked_dates (business_id, date);

-- -------------------------------------------------------------------------
-- booking_settings: reglas de reserva por negocio (1 fila por negocio).
-- -------------------------------------------------------------------------
create table public.booking_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  min_notice_minutes integer not null default 60 check (min_notice_minutes >= 0),
  max_notice_days integer not null default 60 check (max_notice_days > 0),
  buffer_minutes integer not null default 0 check (buffer_minutes >= 0),
  allow_cancellation boolean not null default true,
  min_cancellation_hours integer not null default 2 check (min_cancellation_hours >= 0),
  updated_at timestamptz not null default now()
);

create trigger trg_booking_settings_updated_at
  before update on public.booking_settings
  for each row execute function public.set_updated_at();

-- Crea configuración de reservas por defecto al crear el negocio.
create or replace function public.create_default_booking_settings()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.booking_settings (business_id)
  values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

create trigger trg_businesses_default_settings
  after insert on public.businesses
  for each row execute function public.create_default_booking_settings();

-- -------------------------------------------------------------------------
-- customers: clientes finales de cada negocio (sin cuenta de usuario).
-- -------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, phone)
);

create index idx_customers_business on public.customers (business_id);

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- bookings
-- -------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  employee_id uuid references public.employees (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_bookings_range check (end_time > start_time),
  -- Columna generada usada por el constraint de exclusión de abajo.
  time_range tstzrange generated always as (tstzrange(start_time, end_time, '[)')) stored
);

create index idx_bookings_business_start on public.bookings (business_id, start_time);
create index idx_bookings_customer on public.bookings (customer_id);

create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- GARANTÍA A NIVEL DE BASE DE DATOS: nunca dos reservas activas se solapan
-- para el mismo negocio + mismo recurso (empleado, o "recurso general" si
-- employee_id es null). Esto protege frente a condiciones de carrera
-- aunque falle o se salte la validación de disponibilidad en la aplicación.
-- El propio EXCLUDE crea su índice GiST internamente.
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    business_id with =,
    coalesce(employee_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    time_range with &&
  )
  where (status not in ('cancelled', 'no_show'));

-- -------------------------------------------------------------------------
-- notifications: registro de envíos (email / whatsapp / push).
-- -------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'push')),
  type text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  payload jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_booking on public.notifications (booking_id);
