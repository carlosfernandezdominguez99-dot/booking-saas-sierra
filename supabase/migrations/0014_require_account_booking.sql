-- =========================================================================
-- 0014_require_account_booking.sql — a partir de ahora hace falta tener
-- cuenta (login en `/mis-citas`, o el selector "Soy cliente" de
-- `/login`/`/registro`) para reservar o apuntarse a una lista de espera.
-- Pedido explícito de Carlos: ya que se inicia sesión, se rellenan solos
-- nombre/email/teléfono (no hay que volver a escribirlos cada vez), y así
-- también se evita que se reserve sin registrarse.
--
-- Importante: esto NO reimplementa la lógica de reservar (revalidar el
-- hueco, evitar solapes, etc.) — las funciones nuevas de aquí simplemente
-- resuelven quién es la cuenta a partir del token de sesión y LLAMAN a
-- `create_public_booking`/`join_waitlist_public` (que siguen existiendo
-- tal cual) con esos datos. Lo único que cambia es que ya no se puede
-- llegar a ellas sin pasar antes por una cuenta válida: se les quita el
-- permiso de ejecución a `anon`/`authenticated` al final de este archivo,
-- así que ahora solo son alcanzables desde dentro de estas funciones
-- nuevas (una función `security definer` puede llamar a otra sin que el
-- rol que conectó tenga permiso directo sobre ella).
-- =========================================================================

create or replace function public.get_customer_account_profile(p_token uuid)
returns table (valid boolean, name text, email text, phone text)
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
  name := v_account.name;
  email := v_account.email;
  phone := v_account.phone;
  return next;
end;
$$;

revoke all on function public.get_customer_account_profile(uuid) from public;
grant execute on function public.get_customer_account_profile(uuid) to anon, authenticated;

create or replace function public.create_account_booking(
  p_token uuid,
  p_business_id uuid,
  p_service_id uuid,
  p_start_time timestamptz,
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
      v_account.name, v_account.phone, null, v_account.email, p_comment
    );
end;
$$;

revoke all on function public.create_account_booking(uuid, uuid, uuid, timestamptz, text) from public;
grant execute on function public.create_account_booking(uuid, uuid, uuid, timestamptz, text) to anon, authenticated;

create or replace function public.join_waitlist_by_account(
  p_token uuid,
  p_business_id uuid,
  p_service_id uuid,
  p_preferred_date date
)
returns table (entry_id uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_account record;
  v_result record;
begin
  select * into v_session from public.customer_sessions where token = p_token and expires_at > now();
  if not found then
    error := 'Tu sesión ha caducado. Vuelve a iniciar sesión.';
    return next;
    return;
  end if;

  select * into v_account from public.customer_accounts where id = v_session.account_id;

  select * into v_result
  from public.join_waitlist_public(p_business_id, p_service_id, p_preferred_date, v_account.name, v_account.phone, v_account.email)
  limit 1;

  entry_id := v_result.entry_id;
  error := v_result.error;
  return next;
end;
$$;

revoke all on function public.join_waitlist_by_account(uuid, uuid, uuid, date) from public;
grant execute on function public.join_waitlist_by_account(uuid, uuid, uuid, date) to anon, authenticated;

-- -------------------------------------------------------------------------
-- El cierre real: sin esto, cualquiera podría seguir llamando a estas dos
-- funciones directamente con la clave `anon` pública (la misma que usa el
-- propio sitio), sin pasar por ninguna cuenta, sin importar lo que
-- restrinja la interfaz.
-- -------------------------------------------------------------------------
revoke execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, uuid, text, text) from anon, authenticated;
revoke execute on function public.join_waitlist_public(uuid, uuid, date, text, text, text) from anon, authenticated;
