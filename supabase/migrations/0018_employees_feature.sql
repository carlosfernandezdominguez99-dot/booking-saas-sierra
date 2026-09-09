-- =========================================================================
-- 0018_employees_feature.sql — Empleados con acceso propio.
--
-- La tabla `employees` (y `employee_services`, `business_hours.employee_id`,
-- `blocked_dates.employee_id`, `bookings.employee_id`, el propio
-- `get_available_slots`/`create_public_booking` con `p_employee_id`, y el
-- exclude constraint `bookings_no_overlap` agrupando por empleado) ya
-- existían desde `0001_schema.sql`/`0002_rls.sql`/`0003_booking_functions.sql`
-- — la arquitectura se dejó preparada a propósito para esta fase. Lo que
-- faltaba y añade esta migración:
--
--   1. Que un empleado pueda tener su PROPIO login (`business_members`
--      gana `employee_id`, con invitación por email).
--   2. Que ese login solo vea/gestione SU agenda y SU horario (RLS antes
--      trataba a cualquier miembro — owner o staff — por igual; ahora
--      `staff` queda limitado a lo suyo, `owner` sigue viendo todo).
--   3. Reservar "con cualquiera disponible" y que el empleado que se
--      libera al cancelar una cita se le siga ofreciendo correctamente a
--      la lista de espera (antes esa reoferta siempre creaba la cita
--      resultante con `employee_id` nulo, lo que — ahora que puede haber
--      citas con empleado de verdad al mismo tiempo — podía acabar
--      solapando a un empleado consigo mismo; el exclude constraint no lo
--      detecta porque agrupa por `coalesce(employee_id, zero-uuid)` y una
--      fila con `employee_id` nulo cae en un grupo aparte).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. business_members: enlaza el login con el empleado que representa.
-- -------------------------------------------------------------------------
alter table public.business_members
  add column employee_id uuid references public.employees (id) on delete set null;

alter table public.business_members
  add constraint chk_business_members_staff_employee
  check (role <> 'staff' or employee_id is not null);

-- Helper de RLS: empleado (si lo hay) con el que el usuario autenticado
-- actual pertenece a ESE negocio. `security definer` por el mismo motivo
-- que `is_business_member`: evita recursión de RLS al consultar
-- `business_members` desde otras policies.
create or replace function public.my_employee_id(biz_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select bm.employee_id
  from public.business_members bm
  where bm.business_id = biz_id
    and bm.user_id = auth.uid()
  limit 1;
$$;

-- -------------------------------------------------------------------------
-- 2. get_my_primary_business: ahora también dice qué empleado es (si lo
-- es) el usuario, para que el panel sepa si tiene que enseñar la vista de
-- "toda la agenda" (owner) o solo "la mía" (staff) sin otra consulta más.
-- Cambia la forma de lo que devuelve → hace falta borrarla y crearla de
-- nuevo (un `create or replace` no puede cambiar las columnas de salida).
-- -------------------------------------------------------------------------
drop function if exists public.get_my_primary_business();

create function public.get_my_primary_business()
returns table (
  role text,
  employee_id uuid,
  employee_name text,
  id uuid,
  owner_id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  phone text,
  address text,
  city text,
  business_type text,
  timezone text,
  subscription_status text,
  trial_ends_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    bm.role,
    bm.employee_id,
    e.name as employee_name,
    b.id,
    b.owner_id,
    b.name,
    b.slug,
    b.description,
    b.logo_url,
    b.phone,
    b.address,
    b.city,
    b.business_type,
    b.timezone,
    b.subscription_status,
    b.trial_ends_at,
    b.onboarding_completed_at,
    b.created_at,
    b.updated_at
  from public.business_members bm
  join public.businesses b on b.id = bm.business_id
  left join public.employees e on e.id = bm.employee_id
  where bm.user_id = auth.uid()
  order by bm.created_at asc
  limit 1;
$$;

revoke all on function public.get_my_primary_business() from public;
grant execute on function public.get_my_primary_business() to authenticated;

-- -------------------------------------------------------------------------
-- 3. employee_invites: invitación de un solo uso por email. Solo el
-- propietario del negocio las gestiona (crear/revocar); el propio enlace
-- público pasa por las dos funciones `security definer` de más abajo, que
-- exponen solo lo estrictamente necesario a través del token — igual que
-- `waitlist_entries.respond_token` o `customer_sessions`.
-- -------------------------------------------------------------------------
create table public.employee_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index idx_employee_invites_business on public.employee_invites (business_id);
create index idx_employee_invites_employee on public.employee_invites (employee_id);

alter table public.employee_invites enable row level security;

create policy "employee_invites: el propietario gestiona sus invitaciones"
  on public.employee_invites for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- Lee una invitación por token, sin sesión — para enseñar "Te han
-- invitado a unirte a X como Y" antes incluso de que la persona tenga
-- cuenta o haya iniciado sesión.
create or replace function public.get_employee_invite(p_token uuid)
returns table (valid boolean, business_name text, employee_name text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  select * into v_invite
  from public.employee_invites
  where token = p_token and status = 'pending' and expires_at > now();

  if not found then
    valid := false;
    return next;
    return;
  end if;

  valid := true;
  select b.name into business_name from public.businesses b where b.id = v_invite.business_id;
  select e.name into employee_name from public.employees e where e.id = v_invite.employee_id;
  email := v_invite.email;
  return next;
end;
$$;

revoke all on function public.get_employee_invite(uuid) from public;
grant execute on function public.get_employee_invite(uuid) to anon, authenticated;

-- Acepta la invitación: ata la cuenta YA AUTENTICADA (`auth.uid()`, nunca
-- un id recibido por parámetro) al negocio como `staff` de ese empleado.
-- Se puede llamar tanto tras registrarse de cero como tras iniciar sesión
-- con una cuenta ya existente.
create or replace function public.accept_employee_invite(p_token uuid)
returns table (ok boolean, error text, business_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_business record;
begin
  if auth.uid() is null then
    ok := false;
    error := 'Tienes que iniciar sesión primero.';
    return next;
    return;
  end if;

  select * into v_invite
  from public.employee_invites
  where token = p_token and status = 'pending' and expires_at > now();

  if not found then
    ok := false;
    error := 'Esta invitación ya no es válida (caducada, revocada, o ya se usó).';
    return next;
    return;
  end if;

  insert into public.business_members (business_id, user_id, role, employee_id)
  values (v_invite.business_id, auth.uid(), 'staff', v_invite.employee_id)
  on conflict (business_id, user_id)
  do update set role = 'staff', employee_id = v_invite.employee_id;

  update public.employee_invites set status = 'accepted', accepted_at = now() where id = v_invite.id;

  select * into v_business from public.businesses where id = v_invite.business_id;
  ok := true;
  business_slug := v_business.slug;
  return next;
end;
$$;

revoke all on function public.accept_employee_invite(uuid) from public;
grant execute on function public.accept_employee_invite(uuid) to authenticated;

-- -------------------------------------------------------------------------
-- 4. RLS: hasta ahora CUALQUIER miembro (owner o staff, daba igual) tenía
-- acceso total a servicios, empleados, horarios, reservas... A partir de
-- aquí: el propietario sigue viendo/gestionando todo; un empleado con
-- acceso propio (`staff`) solo puede LEER lo general (para tener
-- contexto) y gestionar (horario, reservas) lo que es estrictamente SUYO.
-- -------------------------------------------------------------------------

-- services: cualquier miembro las lee (hace falta para saber qué hace
-- cada uno), solo el propietario las crea/edita/borra.
drop policy "services: miembros gestionan sus servicios" on public.services;

create policy "services: miembros leen sus servicios"
  on public.services for select
  using (public.is_business_member(business_id));

create policy "services: el propietario gestiona sus servicios"
  on public.services for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- employees: igual — cualquier miembro ve al equipo, solo el propietario
-- da de alta/edita/da de baja empleados.
drop policy "employees: miembros gestionan sus empleados" on public.employees;

create policy "employees: miembros leen sus empleados"
  on public.employees for select
  using (public.is_business_member(business_id));

create policy "employees: el propietario gestiona sus empleados"
  on public.employees for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- employee_services: igual.
drop policy "employee_services: miembros gestionan asignaciones" on public.employee_services;

create policy "employee_services: miembros leen asignaciones"
  on public.employee_services for select
  using (
    exists (
      select 1 from public.employees e
      where e.id = employee_services.employee_id
        and public.is_business_member(e.business_id)
    )
  );

create policy "employee_services: el propietario gestiona asignaciones"
  on public.employee_services for all
  using (
    exists (
      select 1 from public.employees e
      where e.id = employee_services.employee_id
        and public.is_business_owner(e.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.employees e
      where e.id = employee_services.employee_id
        and public.is_business_owner(e.business_id)
    )
  );

-- business_hours: cualquier miembro lee (contexto); el propietario
-- gestiona cualquier fila (general o de cualquier empleado); un empleado
-- con acceso propio solo gestiona SUS PROPIAS filas (`employee_id` =
-- el suyo, nunca las generales del negocio ni las de un compañero).
drop policy "business_hours: miembros gestionan su horario" on public.business_hours;

create policy "business_hours: miembros leen horarios"
  on public.business_hours for select
  using (public.is_business_member(business_id));

create policy "business_hours: el propietario gestiona cualquier horario"
  on public.business_hours for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create policy "business_hours: empleados gestionan su propio horario"
  on public.business_hours for all
  using (employee_id is not null and employee_id = public.my_employee_id(business_id))
  with check (employee_id is not null and employee_id = public.my_employee_id(business_id));

-- blocked_dates: mismo patrón que business_hours (aunque todavía no haya
-- pantalla en el panel para esto), por coherencia y para cuando la haya.
drop policy "blocked_dates: miembros gestionan sus días bloqueados" on public.blocked_dates;

create policy "blocked_dates: miembros leen días bloqueados"
  on public.blocked_dates for select
  using (public.is_business_member(business_id));

create policy "blocked_dates: el propietario gestiona cualquier día bloqueado"
  on public.blocked_dates for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create policy "blocked_dates: empleados gestionan sus propios días bloqueados"
  on public.blocked_dates for all
  using (employee_id is not null and employee_id = public.my_employee_id(business_id))
  with check (employee_id is not null and employee_id = public.my_employee_id(business_id));

-- booking_settings: solo el propietario decide la política de
-- cancelación/antelación del negocio; el resto de miembros solo la lee.
drop policy "booking_settings: miembros gestionan su configuración" on public.booking_settings;

create policy "booking_settings: miembros leen su configuración"
  on public.booking_settings for select
  using (public.is_business_member(business_id));

create policy "booking_settings: el propietario gestiona su configuración"
  on public.booking_settings for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- bookings: el propietario ve/gestiona TODAS las reservas del negocio; un
-- empleado con acceso propio solo las suyas (`bookings.employee_id` =
-- el suyo). Una reserva sin empleado asignado (negocio que no usa
-- empleados) solo la ve el propietario, como hasta ahora.
drop policy "bookings: miembros gestionan sus reservas" on public.bookings;

create policy "bookings: el propietario gestiona todas las reservas"
  on public.bookings for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create policy "bookings: empleados gestionan sus propias reservas"
  on public.bookings for all
  using (employee_id is not null and employee_id = public.my_employee_id(business_id))
  with check (employee_id is not null and employee_id = public.my_employee_id(business_id));

-- -------------------------------------------------------------------------
-- 5. create_account_booking: gana `p_employee_id` — hasta ahora siempre
-- reservaba sin empleado asignado (`null`), aunque el negocio tuviera.
-- Cambia la lista de parámetros → hace falta borrarla y crearla de nuevo.
-- -------------------------------------------------------------------------
drop function if exists public.create_account_booking(uuid, uuid, uuid, timestamptz, text);

create function public.create_account_booking(
  p_token uuid,
  p_business_id uuid,
  p_service_id uuid,
  p_start_time timestamptz,
  p_employee_id uuid default null,
  p_comment text default null
)
returns table (
  booking_id uuid,
  business_name text,
  service_name text,
  price_cents integer,
  start_time timestamptz,
  end_time timestamptz,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_account record;
begin
  select * into v_session from public.customer_sessions where token = p_token and expires_at > now();
  if not found then
    raise exception 'Tu sesión ha caducado. Vuelve a iniciar sesión.' using errcode = '22023';
  end if;

  select * into v_account from public.customer_accounts where id = v_session.account_id;

  return query
    select * from public.create_public_booking(
      p_business_id, p_service_id, p_start_time,
      v_account.name, v_account.phone, p_employee_id, v_account.email, p_comment
    );
end;
$$;

revoke all on function public.create_account_booking(uuid, uuid, uuid, timestamptz, uuid, text) from public;
grant execute on function public.create_account_booking(uuid, uuid, uuid, timestamptz, uuid, text) to anon, authenticated;

-- -------------------------------------------------------------------------
-- 6. Lista de espera: la reoferta al cancelar tiene que conservar el
-- EMPLEADO cuyo hueco se libera, para que la cita resultante (si alguien
-- la acepta) quede asignada a ese mismo empleado — si no, quedaría sin
-- empleado y podría solaparse con otra cita de ese empleado a la misma
-- hora (el exclude constraint no lo pilla: agrupa `coalesce(employee_id,
-- '000...')`, así que una fila sin empleado nunca choca con una que sí lo
-- tiene, aunque sean la misma hora).
-- -------------------------------------------------------------------------
alter table public.waitlist_entries
  add column offered_employee_id uuid references public.employees (id) on delete set null;

-- Cambia la lista de parámetros (nuevo `p_employee_id` al final) → hace
-- falta borrarla y crearla de nuevo. Sigue sin grant a
-- `authenticated`/`anon` a propósito (ver el comentario original en
-- `0006_waitlist.sql`).
drop function if exists public.offer_waitlist_slot(uuid, date, timestamptz, timestamptz, uuid);

create function public.offer_waitlist_slot(
  p_business_id uuid,
  p_preferred_date date,
  p_slot_start timestamptz,
  p_slot_end timestamptz,
  p_exclude_entry_id uuid default null,
  p_employee_id uuid default null
)
returns table (
  entry_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  service_name text,
  offered_start_time timestamptz,
  offered_end_time timestamptz,
  respond_token uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_minutes integer := extract(epoch from (p_slot_end - p_slot_start)) / 60;
  v_candidate record;
  v_candidate_end timestamptz;
begin
  select we.id, we.service_id, s.duration_minutes, we.respond_token, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, s.name as service_name
  into v_candidate
  from public.waitlist_entries we
  join public.services s on s.id = we.service_id
  join public.customers c on c.id = we.customer_id
  where we.business_id = p_business_id
    and we.preferred_date = p_preferred_date
    and we.status = 'waiting'
    and s.duration_minutes <= v_slot_minutes
    and (p_exclude_entry_id is null or we.id <> p_exclude_entry_id)
  order by we.created_at asc
  limit 1;

  if not found then
    return; -- nadie en espera que encaje en este hueco
  end if;

  v_candidate_end := p_slot_start + make_interval(mins => v_candidate.duration_minutes);

  update public.waitlist_entries
  set status = 'offered',
      offered_start_time = p_slot_start,
      offered_end_time = v_candidate_end,
      offered_at = now(),
      offered_employee_id = p_employee_id
  where id = v_candidate.id;

  entry_id := v_candidate.id;
  customer_name := v_candidate.customer_name;
  customer_phone := v_candidate.customer_phone;
  customer_email := v_candidate.customer_email;
  service_name := v_candidate.service_name;
  offered_start_time := p_slot_start;
  offered_end_time := v_candidate_end;
  respond_token := v_candidate.respond_token;
  return next;
end;
$$;

revoke all on function public.offer_waitlist_slot(uuid, date, timestamptz, timestamptz, uuid, uuid) from public;

-- offer_next_waitlist_candidate: mismos parámetros/salida de siempre —
-- solo cambia por dentro para pasar el empleado de la reserva cancelada.
create or replace function public.offer_next_waitlist_candidate(p_booking_id uuid)
returns table (
  entry_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  service_name text,
  offered_start_time timestamptz,
  offered_end_time timestamptz,
  respond_token uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_business record;
  v_date date;
begin
  select * into v_booking from public.bookings where id = p_booking_id and status = 'cancelled';
  if not found then
    return;
  end if;

  if not public.is_business_member(v_booking.business_id) then
    return;
  end if;

  select * into v_business from public.businesses where id = v_booking.business_id;
  v_date := (v_booking.start_time at time zone v_business.timezone)::date;

  return query
    select * from public.offer_waitlist_slot(
      v_booking.business_id, v_date, v_booking.start_time, v_booking.end_time,
      p_employee_id => v_booking.employee_id
    );
end;
$$;

-- respond_to_waitlist_offer: mismos parámetros/salida de siempre — al
-- rechazar, reoferta conservando el empleado; al aceptar, comprueba el
-- solape y crea la cita con el empleado correcto (antes siempre `null`).
create or replace function public.respond_to_waitlist_offer(p_token uuid, p_accept boolean)
returns table (
  result text,
  booking_id uuid,
  business_name text,
  business_timezone text,
  service_name text,
  start_time timestamptz,
  end_time timestamptz,
  -- Datos de quien responde: hacen falta para poder enviarle un email de
  -- confirmación cuando acepta.
  customer_name text,
  customer_email text,
  next_entry_id uuid,
  next_customer_name text,
  next_customer_phone text,
  next_customer_email text,
  next_service_name text,
  next_offered_start_time timestamptz,
  next_offered_end_time timestamptz,
  next_respond_token uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
  v_business record;
  v_service record;
  v_customer record;
  v_still_available boolean;
  v_new_booking_id uuid;
  v_next record;
  v_date date;
begin
  select * into v_entry from public.waitlist_entries where respond_token = p_token;
  if not found then
    result := 'not_found';
    return next;
    return;
  end if;

  if v_entry.status <> 'offered' then
    result := 'not_found';
    return next;
    return;
  end if;

  select * into v_business from public.businesses where id = v_entry.business_id;
  select * into v_service from public.services where id = v_entry.service_id;
  select * into v_customer from public.customers where id = v_entry.customer_id;
  v_date := (v_entry.offered_start_time at time zone v_business.timezone)::date;

  business_name := v_business.name;
  business_timezone := v_business.timezone;
  customer_name := v_customer.name;
  customer_email := v_customer.email;

  if not p_accept then
    update public.waitlist_entries set status = 'rejected' where id = v_entry.id;

    select * into v_next
    from public.offer_waitlist_slot(
      v_entry.business_id, v_date, v_entry.offered_start_time, v_entry.offered_end_time,
      v_entry.id, v_entry.offered_employee_id
    );

    result := 'rejected';
    if found then
      next_entry_id := v_next.entry_id;
      next_customer_name := v_next.customer_name;
      next_customer_phone := v_next.customer_phone;
      next_customer_email := v_next.customer_email;
      next_service_name := v_next.service_name;
      next_offered_start_time := v_next.offered_start_time;
      next_offered_end_time := v_next.offered_end_time;
      next_respond_token := v_next.respond_token;
    end if;
    return next;
    return;
  end if;

  -- Aceptación: revalida que el hueco sigue libre para ESE empleado en
  -- concreto (o para el "recurso general" si `offered_employee_id` es
  -- nulo, negocio sin empleados) antes de crear la cita.
  select not exists (
    select 1 from public.bookings b
    where b.business_id = v_entry.business_id
      and b.employee_id is not distinct from v_entry.offered_employee_id
      and b.status not in ('cancelled', 'no_show')
      and tstzrange(b.start_time, b.end_time, '[)') && tstzrange(v_entry.offered_start_time, v_entry.offered_end_time, '[)')
  ) into v_still_available;

  if not v_still_available then
    update public.waitlist_entries set status = 'expired' where id = v_entry.id;
    result := 'expired';
    return next;
    return;
  end if;

  insert into public.bookings (business_id, service_id, employee_id, customer_id, start_time, end_time, status)
  values (v_entry.business_id, v_entry.service_id, v_entry.offered_employee_id, v_entry.customer_id, v_entry.offered_start_time, v_entry.offered_end_time, 'confirmed')
  returning id into v_new_booking_id;

  update public.waitlist_entries set status = 'accepted' where id = v_entry.id;

  result := 'accepted';
  booking_id := v_new_booking_id;
  business_name := v_business.name;
  service_name := v_service.name;
  start_time := v_entry.offered_start_time;
  end_time := v_entry.offered_end_time;
  return next;
end;
$$;

-- cancel_booking_by_account (0017): mismos parámetros/salida de siempre —
-- solo cambia por dentro para pasar el empleado de la reserva cancelada
-- a `offer_waitlist_slot`, igual que `offer_next_waitlist_candidate`.
create or replace function public.cancel_booking_by_account(p_token uuid, p_booking_id uuid)
returns table (
  ok boolean,
  error text,
  business_id uuid,
  business_slug text,
  business_name text,
  business_timezone text,
  service_name text,
  start_time timestamptz,
  end_time timestamptz,
  customer_name text,
  customer_email text,
  customer_phone text,
  next_entry_id uuid,
  next_customer_name text,
  next_customer_phone text,
  next_customer_email text,
  next_service_name text,
  next_offered_start_time timestamptz,
  next_offered_end_time timestamptz,
  next_respond_token uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_account record;
  v_booking record;
  v_business record;
  v_settings record;
  v_offer record;
begin
  select * into v_session from public.customer_sessions where token = p_token and expires_at > now();
  if not found then
    ok := false;
    error := 'Tu sesión ha caducado. Vuelve a iniciar sesión.';
    return next;
    return;
  end if;

  select * into v_account from public.customer_accounts where id = v_session.account_id;

  select bk.id, bk.business_id, bk.service_id, bk.employee_id, bk.start_time, bk.end_time, bk.status,
         s.name as service_name, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
  into v_booking
  from public.bookings bk
  join public.services s on s.id = bk.service_id
  join public.customers c on c.id = bk.customer_id
  where bk.id = p_booking_id
    and lower(c.email) = lower(v_account.email);

  if not found then
    ok := false;
    error := 'No se encontró esa reserva.';
    return next;
    return;
  end if;

  if v_booking.status = 'cancelled' then
    ok := false;
    error := 'Esa reserva ya estaba cancelada.';
    return next;
    return;
  end if;

  select * into v_business from public.businesses where id = v_booking.business_id;
  select * into v_settings from public.booking_settings where business_id = v_booking.business_id;

  if v_settings.allow_cancellation is false then
    ok := false;
    error := 'Este negocio no permite cancelar citas por aquí. Contacta directamente con ellos.';
    return next;
    return;
  end if;

  if v_booking.start_time < now() + make_interval(hours => coalesce(v_settings.min_cancellation_hours, 0)) then
    ok := false;
    error := format(
      'Ya no se puede cancelar: hace falta avisar con al menos %s horas de antelación.',
      coalesce(v_settings.min_cancellation_hours, 0)
    );
    return next;
    return;
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id;

  ok := true;
  business_id := v_booking.business_id;
  business_slug := v_business.slug;
  business_name := v_business.name;
  business_timezone := v_business.timezone;
  service_name := v_booking.service_name;
  start_time := v_booking.start_time;
  end_time := v_booking.end_time;
  customer_name := v_booking.customer_name;
  customer_email := v_booking.customer_email;
  customer_phone := v_booking.customer_phone;

  select * into v_offer
  from public.offer_waitlist_slot(
    v_booking.business_id,
    (v_booking.start_time at time zone v_business.timezone)::date,
    v_booking.start_time,
    v_booking.end_time,
    p_employee_id => v_booking.employee_id
  )
  limit 1;

  if found then
    next_entry_id := v_offer.entry_id;
    next_customer_name := v_offer.customer_name;
    next_customer_phone := v_offer.customer_phone;
    next_customer_email := v_offer.customer_email;
    next_service_name := v_offer.service_name;
    next_offered_start_time := v_offer.offered_start_time;
    next_offered_end_time := v_offer.offered_end_time;
    next_respond_token := v_offer.respond_token;
  end if;

  return next;
end;
$$;
