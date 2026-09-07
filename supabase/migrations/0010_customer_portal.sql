-- =========================================================================
-- 0010_customer_portal.sql — portal del cliente: acceso sin contraseña
-- por enlace de un solo uso (email), para ver sus citas pasadas/próximas
-- y su lista de espera, y para poder apuntarse/borrarse de la lista de
-- espera él mismo.
--
-- No cambia el principio de "el cliente final reserva sin crear cuenta":
-- sigue sin haber usuario/contraseña. El "enlace de acceso" es solo un
-- token de un solo negocio, válido 30 días, que se manda por email —
-- el mismo patrón que ya usa `respond_token` de la lista de espera
-- (Fase 7), pero pensado para reutilizarse durante varias visitas en vez
-- de una sola.
-- =========================================================================

create table public.customer_access_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create index idx_customer_access_tokens_customer on public.customer_access_tokens (customer_id);
create index idx_customer_access_tokens_token on public.customer_access_tokens (token);

alter table public.customer_access_tokens enable row level security;
-- Sin políticas para anon/authenticated a propósito: son enlaces
-- personales de un cliente, y solo se leen/crean a través de las
-- funciones `security definer` de abajo, nunca por acceso directo a la
-- tabla (ni siquiera los miembros del negocio necesitan verlos).

-- -------------------------------------------------------------------------
-- request_customer_access: pide un enlace de acceso nuevo para alguien
-- que YA es cliente de ese negocio (le suena su teléfono o su email).
-- Si no se encuentra a nadie, no devuelve filas — la Action de
-- TypeScript responde siempre el mismo mensaje genérico ("si ese contacto
-- está registrado, te llegará un email"), para no filtrar si un
-- teléfono/email concreto existe o no en el negocio.
-- -------------------------------------------------------------------------
create or replace function public.request_customer_access(p_business_id uuid, p_contact text)
returns table (customer_id uuid, customer_name text, customer_email text, token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer record;
  v_token uuid;
begin
  select * into v_customer
  from public.customers
  where business_id = p_business_id
    and (phone = trim(p_contact) or lower(email) = lower(trim(p_contact)))
  limit 1;

  if not found or v_customer.email is null then
    return; -- sin cliente encontrado, o sin email guardado: no hay dónde mandar el enlace
  end if;

  insert into public.customer_access_tokens (customer_id, business_id)
  values (v_customer.id, p_business_id)
  returning customer_access_tokens.token into v_token;

  customer_id := v_customer.id;
  customer_name := v_customer.name;
  customer_email := v_customer.email;
  token := v_token;
  return next;
end;
$$;

revoke all on function public.request_customer_access(uuid, text) from public;
grant execute on function public.request_customer_access(uuid, text) to anon, authenticated;

-- -------------------------------------------------------------------------
-- get_customer_portal_data: todo lo que necesita el panel del cliente en
-- una sola llamada (evita ir función por función desde el cliente `anon`).
-- -------------------------------------------------------------------------
create or replace function public.get_customer_portal_data(p_token uuid)
returns table (
  valid boolean,
  business_name text,
  business_slug text,
  business_timezone text,
  customer_name text,
  upcoming_bookings jsonb,
  past_bookings jsonb,
  waitlist_entries jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access record;
  v_business record;
  v_customer record;
begin
  select * into v_access from public.customer_access_tokens where token = p_token and expires_at > now();
  if not found then
    valid := false;
    return next;
    return;
  end if;

  select * into v_business from public.businesses where id = v_access.business_id;
  select * into v_customer from public.customers where id = v_access.customer_id;

  valid := true;
  business_name := v_business.name;
  business_slug := v_business.slug;
  business_timezone := v_business.timezone;
  customer_name := v_customer.name;

  select coalesce(jsonb_agg(row_to_json(t) order by t.start_time asc), '[]'::jsonb) into upcoming_bookings
  from (
    select b.id, s.name as service_name, b.start_time, b.end_time, b.status
    from public.bookings b
    join public.services s on s.id = b.service_id
    where b.customer_id = v_access.customer_id
      and b.status not in ('cancelled', 'no_show')
      and b.start_time >= now()
    order by b.start_time asc
    limit 50
  ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.start_time desc), '[]'::jsonb) into past_bookings
  from (
    select b.id, s.name as service_name, b.start_time, b.end_time, b.status
    from public.bookings b
    join public.services s on s.id = b.service_id
    where b.customer_id = v_access.customer_id
      and (b.start_time < now() or b.status in ('cancelled', 'no_show'))
    order by b.start_time desc
    limit 30
  ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb) into waitlist_entries
  from (
    select we.id, s.name as service_name, we.preferred_date, we.status,
           we.offered_start_time, we.offered_end_time, we.created_at
    from public.waitlist_entries we
    join public.services s on s.id = we.service_id
    where we.customer_id = v_access.customer_id
    order by we.created_at desc
    limit 20
  ) t;

  return next;
end;
$$;

revoke all on function public.get_customer_portal_data(uuid) from public;
grant execute on function public.get_customer_portal_data(uuid) to anon, authenticated;

-- -------------------------------------------------------------------------
-- join_waitlist_self / leave_waitlist_self: para un cliente que YA tiene
-- una sesión de portal válida (token de `customer_access_tokens`).
-- -------------------------------------------------------------------------
create or replace function public.join_waitlist_self(p_token uuid, p_service_id uuid, p_preferred_date date)
returns table (entry_id uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access record;
  v_service record;
  v_existing uuid;
  v_new_id uuid;
begin
  select * into v_access from public.customer_access_tokens where token = p_token and expires_at > now();
  if not found then
    error := 'No se pudo verificar tu acceso. Pide un nuevo enlace.';
    return next;
    return;
  end if;

  select * into v_service from public.services
  where id = p_service_id and business_id = v_access.business_id and active = true;
  if not found then
    error := 'Ese servicio ya no está disponible.';
    return next;
    return;
  end if;

  if p_preferred_date < current_date then
    error := 'Elige una fecha futura.';
    return next;
    return;
  end if;

  select id into v_existing
  from public.waitlist_entries
  where customer_id = v_access.customer_id
    and service_id = p_service_id
    and preferred_date = p_preferred_date
    and status in ('waiting', 'offered')
  limit 1;

  if found then
    error := 'Ya estás en la lista de espera para ese día y servicio.';
    return next;
    return;
  end if;

  insert into public.waitlist_entries (business_id, customer_id, service_id, preferred_date)
  values (v_access.business_id, v_access.customer_id, p_service_id, p_preferred_date)
  returning id into v_new_id;

  entry_id := v_new_id;
  return next;
end;
$$;

revoke all on function public.join_waitlist_self(uuid, uuid, date) from public;
grant execute on function public.join_waitlist_self(uuid, uuid, date) to anon, authenticated;

create or replace function public.leave_waitlist_self(p_token uuid, p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access record;
  v_deleted int;
begin
  select * into v_access from public.customer_access_tokens where token = p_token and expires_at > now();
  if not found then
    return false;
  end if;

  delete from public.waitlist_entries
  where id = p_entry_id
    and customer_id = v_access.customer_id
    and status in ('waiting', 'offered');

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.leave_waitlist_self(uuid, uuid) from public;
grant execute on function public.leave_waitlist_self(uuid, uuid) to anon, authenticated;

-- -------------------------------------------------------------------------
-- join_waitlist_public: para alguien que TODAVÍA no tiene sesión de
-- portal (primera vez, o no ha pedido un enlace) — la página pública
-- "Apuntarme a la lista de espera" pide nombre/teléfono/email como en la
-- reserva normal, crea (o actualiza) el cliente igual que
-- `create_public_booking`, y de paso genera ya un token de acceso para
-- poder mandarle el enlace del portal en el email de confirmación.
-- -------------------------------------------------------------------------
create or replace function public.join_waitlist_public(
  p_business_id uuid,
  p_service_id uuid,
  p_preferred_date date,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text
)
returns table (entry_id uuid, customer_email text, access_token uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business record;
  v_service record;
  v_customer_id uuid;
  v_existing uuid;
  v_new_id uuid;
  v_token uuid;
begin
  select * into v_business from public.businesses
  where id = p_business_id and subscription_status in ('trial', 'active');
  if not found then
    error := 'Este negocio no está disponible ahora mismo.';
    return next;
    return;
  end if;

  select * into v_service from public.services
  where id = p_service_id and business_id = p_business_id and active = true;
  if not found then
    error := 'Ese servicio ya no está disponible.';
    return next;
    return;
  end if;

  if p_preferred_date < current_date then
    error := 'Elige una fecha futura.';
    return next;
    return;
  end if;

  if trim(coalesce(p_customer_email, '')) = '' then
    error := 'Hace falta un email para poder avisarte si se libera un hueco.';
    return next;
    return;
  end if;

  insert into public.customers (business_id, name, phone, email)
  values (p_business_id, trim(p_customer_name), trim(p_customer_phone), trim(p_customer_email))
  on conflict (business_id, phone)
  do update set
    name = excluded.name,
    email = coalesce(excluded.email, public.customers.email),
    updated_at = now()
  returning id into v_customer_id;

  select id into v_existing
  from public.waitlist_entries
  where customer_id = v_customer_id
    and service_id = p_service_id
    and preferred_date = p_preferred_date
    and status in ('waiting', 'offered')
  limit 1;

  if found then
    error := 'Ya estás en la lista de espera para ese día y servicio.';
    return next;
    return;
  end if;

  insert into public.waitlist_entries (business_id, customer_id, service_id, preferred_date)
  values (p_business_id, v_customer_id, p_service_id, p_preferred_date)
  returning id into v_new_id;

  insert into public.customer_access_tokens (customer_id, business_id)
  values (v_customer_id, p_business_id)
  returning token into v_token;

  entry_id := v_new_id;
  customer_email := trim(p_customer_email);
  access_token := v_token;
  return next;
end;
$$;

revoke all on function public.join_waitlist_public(uuid, uuid, date, text, text, text) from public;
grant execute on function public.join_waitlist_public(uuid, uuid, date, text, text, text) to anon, authenticated;
