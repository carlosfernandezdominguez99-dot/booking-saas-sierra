-- =========================================================================
-- 0002_rls.sql
-- Row Level Security: aislamiento multi-tenant estricto por business_id.
--
-- Regla general del proyecto: NINGÚN dato de negocio se sirve confiando
-- solo en el frontend. Todo pasa por estas políticas.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Helper: ¿pertenece el usuario autenticado actual al negocio `biz_id`?
-- security definer + search_path fijo para evitar recursión de RLS al
-- consultar business_members desde otras policies.
-- -------------------------------------------------------------------------
create or replace function public.is_business_member(biz_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = biz_id
      and bm.user_id = auth.uid()
  );
$$;

create or replace function public.is_business_owner(biz_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = biz_id
      and bm.user_id = auth.uid()
      and bm.role = 'owner'
  );
$$;

-- =========================================================================
-- profiles
-- =========================================================================
alter table public.profiles enable row level security;

create policy "profiles: leer el propio perfil"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: actualizar el propio perfil"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- =========================================================================
-- businesses
-- =========================================================================
alter table public.businesses enable row level security;

create policy "businesses: miembros ven su negocio"
  on public.businesses for select
  using (public.is_business_member(id));

-- Lectura pública (anon + authenticated) para la página de reservas:
-- solo negocios con suscripción activa/en prueba.
create policy "businesses: lectura pública de negocios activos"
  on public.businesses for select
  to anon, authenticated
  using (subscription_status in ('trial', 'active'));

create policy "businesses: el propietario crea su negocio"
  on public.businesses for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "businesses: el propietario actualiza su negocio"
  on public.businesses for update
  using (public.is_business_owner(id))
  with check (public.is_business_owner(id));

-- =========================================================================
-- business_members
-- =========================================================================
alter table public.business_members enable row level security;

create policy "business_members: miembros ven el equipo de su negocio"
  on public.business_members for select
  using (public.is_business_member(business_id));

create policy "business_members: el propietario gestiona miembros"
  on public.business_members for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- =========================================================================
-- services
-- =========================================================================
alter table public.services enable row level security;

create policy "services: miembros gestionan sus servicios"
  on public.services for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy "services: lectura pública de servicios activos"
  on public.services for select
  to anon, authenticated
  using (
    active = true
    and exists (
      select 1 from public.businesses b
      where b.id = services.business_id
        and b.subscription_status in ('trial', 'active')
    )
  );

-- =========================================================================
-- employees
-- =========================================================================
alter table public.employees enable row level security;

create policy "employees: miembros gestionan sus empleados"
  on public.employees for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy "employees: lectura pública de empleados activos"
  on public.employees for select
  to anon, authenticated
  using (
    active = true
    and exists (
      select 1 from public.businesses b
      where b.id = employees.business_id
        and b.subscription_status in ('trial', 'active')
    )
  );

-- =========================================================================
-- employee_services
-- =========================================================================
alter table public.employee_services enable row level security;

create policy "employee_services: miembros gestionan asignaciones"
  on public.employee_services for all
  using (
    exists (
      select 1 from public.employees e
      where e.id = employee_services.employee_id
        and public.is_business_member(e.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.employees e
      where e.id = employee_services.employee_id
        and public.is_business_member(e.business_id)
    )
  );

create policy "employee_services: lectura pública"
  on public.employee_services for select
  to anon, authenticated
  using (true);

-- =========================================================================
-- business_hours / blocked_dates / booking_settings / customers / bookings
-- notifications
--
-- Estas tablas NUNCA se exponen directamente a `anon`. La página pública
-- de reservas consulta disponibilidad y crea reservas exclusivamente a
-- través de funciones `security definer` (ver 0003_booking_functions.sql),
-- que devuelven solo la información estrictamente necesaria.
-- =========================================================================
alter table public.business_hours enable row level security;

create policy "business_hours: miembros gestionan su horario"
  on public.business_hours for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

alter table public.blocked_dates enable row level security;

create policy "blocked_dates: miembros gestionan sus días bloqueados"
  on public.blocked_dates for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

alter table public.booking_settings enable row level security;

create policy "booking_settings: miembros gestionan su configuración"
  on public.booking_settings for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

alter table public.customers enable row level security;

create policy "customers: miembros gestionan sus clientes"
  on public.customers for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

alter table public.bookings enable row level security;

create policy "bookings: miembros gestionan sus reservas"
  on public.bookings for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

alter table public.notifications enable row level security;

create policy "notifications: miembros ven sus notificaciones"
  on public.notifications for select
  using (public.is_business_member(business_id));
