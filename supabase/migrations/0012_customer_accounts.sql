-- =========================================================================
-- 0012_customer_accounts.sql — sustituye el portal por enlace mágico
-- (Fase 7.2 / `0010_customer_portal.sql`) por una cuenta de cliente de
-- verdad (email + contraseña), pedido por Carlos porque mandar un enlace
-- por email para entrar era un engorro.
--
-- Cambio de diseño importante: la cuenta ya NO es "de un negocio" — es
-- una única cuenta de cliente que agrega TODAS las citas y listas de
-- espera de ese cliente en CUALQUIER negocio que use la app, emparejando
-- por email (en minúsculas). Como el email es obligatorio en toda reserva
-- desde la Fase 7.1, esto funciona sin tener que "reclamar" nada ni tocar
-- `create_public_booking`/`join_waitlist_public`: en cuanto alguien tiene
-- cuenta, cualquier reserva o entrada en lista de espera que ya tuviera
-- (o haga en el futuro, con o sin sesión iniciada) con ese mismo email
-- aparece automáticamente en su panel.
-- =========================================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- Fuera lo del enlace mágico por negocio (Fase 7.2): ya no hace falta
-- ninguna de estas funciones ni la tabla de tokens de un solo negocio.
-- -------------------------------------------------------------------------
drop function if exists public.request_customer_access(uuid, text);
drop function if exists public.get_customer_portal_data(uuid);
drop function if exists public.join_waitlist_self(uuid, uuid, date);
drop function if exists public.leave_waitlist_self(uuid, uuid);
drop table if exists public.customer_access_tokens;

-- -------------------------------------------------------------------------
-- customer_accounts / customer_sessions — cuenta real de cliente. Sin
-- políticas RLS propias a propósito (igual que el resto de tablas
-- "sensibles" de este proyecto): solo se leen/escriben a través de las
-- funciones `security definer` de abajo, nunca por acceso directo.
-- -------------------------------------------------------------------------
create table public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

-- Único por email sin distinguir mayúsculas/minúsculas — es la clave con la
-- que se agregan citas de distintos negocios, así que no puede haber dos
-- cuentas para el mismo email con distinta capitalización.
create unique index customer_accounts_email_unique on public.customer_accounts (lower(email));

alter table public.customer_accounts enable row level security;

create table public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_accounts (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create index idx_customer_sessions_token on public.customer_sessions (token);
alter table public.customer_sessions enable row level security;

-- -------------------------------------------------------------------------
-- customer_signup / customer_login / customer_logout
-- -------------------------------------------------------------------------
create function public.customer_signup(p_email text, p_password text, p_name text, p_phone text)
returns table (session_token uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_account_id uuid;
  v_token uuid;
begin
  if v_email = '' or p_password is null or length(p_password) < 6 then
    error := 'Introduce un email válido y una contraseña de al menos 6 caracteres.';
    return next;
    return;
  end if;

  if trim(coalesce(p_name, '')) = '' or trim(coalesce(p_phone, '')) = '' then
    error := 'Introduce tu nombre y tu teléfono.';
    return next;
    return;
  end if;

  if exists (select 1 from public.customer_accounts where lower(email) = v_email) then
    error := 'Ya existe una cuenta con ese email. Inicia sesión.';
    return next;
    return;
  end if;

  insert into public.customer_accounts (email, password_hash, name, phone)
  values (trim(p_email), crypt(p_password, gen_salt('bf')), trim(p_name), trim(p_phone))
  returning id into v_account_id;

  insert into public.customer_sessions (account_id)
  values (v_account_id)
  returning token into v_token;

  session_token := v_token;
  return next;
end;
$$;

revoke all on function public.customer_signup(text, text, text, text) from public;
grant execute on function public.customer_signup(text, text, text, text) to anon, authenticated;

create function public.customer_login(p_email text, p_password text)
returns table (session_token uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account record;
  v_token uuid;
begin
  select * into v_account from public.customer_accounts where lower(email) = lower(trim(p_email));

  -- Mismo mensaje genérico tanto si el email no existe como si la
  -- contraseña es incorrecta, para no filtrar qué emails están
  -- registrados.
  if not found or v_account.password_hash <> crypt(p_password, v_account.password_hash) then
    error := 'Email o contraseña incorrectos.';
    return next;
    return;
  end if;

  insert into public.customer_sessions (account_id)
  values (v_account.id)
  returning token into v_token;

  session_token := v_token;
  return next;
end;
$$;

revoke all on function public.customer_login(text, text) from public;
grant execute on function public.customer_login(text, text) to anon, authenticated;

create function public.customer_logout(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.customer_sessions where token = p_token;
end;
$$;

revoke all on function public.customer_logout(uuid) from public;
grant execute on function public.customer_logout(uuid) to anon, authenticated;

-- -------------------------------------------------------------------------
-- get_customer_account_data: el panel entero en una sola llamada — un
-- array `businesses`, uno por cada negocio donde este email tiene algún
-- cliente registrado, cada uno con sus propias citas próximas/pasadas y
-- entradas de lista de espera (mismo patrón de `jsonb_agg` anidado que ya
-- se usaba en `get_customer_portal_data`, ahora un nivel más).
-- -------------------------------------------------------------------------
create function public.get_customer_account_data(p_token uuid)
returns table (
  valid boolean,
  account_name text,
  account_email text,
  businesses jsonb
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
    valid := false;
    return next;
    return;
  end if;

  select * into v_account from public.customer_accounts where id = v_session.account_id;

  valid := true;
  account_name := v_account.name;
  account_email := v_account.email;

  select coalesce(jsonb_agg(biz order by biz ->> 'business_name'), '[]'::jsonb) into businesses
  from (
    select jsonb_build_object(
      'business_id', b.id,
      'business_name', b.name,
      'business_slug', b.slug,
      'business_timezone', b.timezone,
      'upcoming_bookings', (
        select coalesce(jsonb_agg(row_to_json(t) order by t.start_time asc), '[]'::jsonb)
        from (
          select bk.id, s.name as service_name, bk.start_time, bk.end_time, bk.status
          from public.bookings bk
          join public.services s on s.id = bk.service_id
          join public.customers c on c.id = bk.customer_id
          where bk.business_id = b.id
            and lower(c.email) = lower(v_account.email)
            and bk.status not in ('cancelled', 'no_show')
            and bk.start_time >= now()
          order by bk.start_time asc
          limit 50
        ) t
      ),
      'past_bookings', (
        select coalesce(jsonb_agg(row_to_json(t) order by t.start_time desc), '[]'::jsonb)
        from (
          select bk.id, s.name as service_name, bk.start_time, bk.end_time, bk.status
          from public.bookings bk
          join public.services s on s.id = bk.service_id
          join public.customers c on c.id = bk.customer_id
          where bk.business_id = b.id
            and lower(c.email) = lower(v_account.email)
            and (bk.start_time < now() or bk.status in ('cancelled', 'no_show'))
          order by bk.start_time desc
          limit 30
        ) t
      ),
      'waitlist_entries', (
        select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
        from (
          select we.id, s.name as service_name, we.preferred_date, we.status,
                 we.offered_start_time, we.offered_end_time, we.created_at
          from public.waitlist_entries we
          join public.services s on s.id = we.service_id
          join public.customers c on c.id = we.customer_id
          where we.business_id = b.id
            and lower(c.email) = lower(v_account.email)
          order by we.created_at desc
          limit 20
        ) t
      )
    ) as biz
    from public.businesses b
    where exists (
      select 1 from public.customers c2
      where c2.business_id = b.id and lower(c2.email) = lower(v_account.email)
    )
  ) x;

  return next;
end;
$$;

revoke all on function public.get_customer_account_data(uuid) from public;
grant execute on function public.get_customer_account_data(uuid) to anon, authenticated;

-- -------------------------------------------------------------------------
-- leave_waitlist_by_account: autoriza por email (no hay `account_id` en
-- `customers` — la cuenta es transversal a negocios, así que se
-- comprueba que el email de la entrada coincide con el de la cuenta, no
-- una relación directa por id).
-- -------------------------------------------------------------------------
create function public.leave_waitlist_by_account(p_token uuid, p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_account record;
  v_deleted int;
begin
  select * into v_session from public.customer_sessions where token = p_token and expires_at > now();
  if not found then
    return false;
  end if;

  select * into v_account from public.customer_accounts where id = v_session.account_id;

  delete from public.waitlist_entries we
  using public.customers c
  where we.id = p_entry_id
    and we.customer_id = c.id
    and lower(c.email) = lower(v_account.email)
    and we.status in ('waiting', 'offered');

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.leave_waitlist_by_account(uuid, uuid) from public;
grant execute on function public.leave_waitlist_by_account(uuid, uuid) to anon, authenticated;

-- -------------------------------------------------------------------------
-- join_waitlist_public: se mantiene para quien quiere apuntarse sin crear
-- cuenta (sigue sin ser obligatorio tener cuenta para reservar ni para
-- apuntarse a una lista de espera) — solo se le quita la parte que
-- generaba un token de `customer_access_tokens` (tabla eliminada arriba).
-- Si más tarde ese email se registra como cuenta, esta entrada aparecerá
-- igualmente en su panel (se empareja por email, no por el momento en que
-- se creó).
-- -------------------------------------------------------------------------
drop function if exists public.join_waitlist_public(uuid, uuid, date, text, text, text);

create function public.join_waitlist_public(
  p_business_id uuid,
  p_service_id uuid,
  p_preferred_date date,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text
)
returns table (entry_id uuid, customer_email text, error text)
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

  entry_id := v_new_id;
  customer_email := trim(p_customer_email);
  return next;
end;
$$;

revoke all on function public.join_waitlist_public(uuid, uuid, date, text, text, text) from public;
grant execute on function public.join_waitlist_public(uuid, uuid, date, text, text, text) to anon, authenticated;
