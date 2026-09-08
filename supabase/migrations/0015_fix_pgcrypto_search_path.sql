-- =========================================================================
-- 0015_fix_pgcrypto_search_path.sql — arregla el fallo real al registrarse
-- (y, aunque no se había notado, también al comprobar la contraseña en el
-- login): en Supabase, la extensión `pgcrypto` (que da `crypt()` y
-- `gen_salt()`) se instala por defecto en el esquema `extensions`, no en
-- `public`. Las funciones de `0012_customer_accounts.sql` y
-- `0013_customer_login_hint.sql` tienen `set search_path = public` a
-- secas, así que Postgres no encontraba `crypt()`/`gen_salt()` dentro de
-- ellas y la llamada fallaba con un error real de Postgres (no uno de los
-- mensajes controlados que devuelven esas funciones) — eso era el "No se
-- pudo crear la cuenta" genérico.
--
-- Arreglo: añadir `extensions` al `search_path` de las dos funciones que
-- usan crypt()/gen_salt(). No hace falta tocar dónde está instalada la
-- extensión — moverla podría chocar con cómo la gestiona Supabase por su
-- cuenta.
-- =========================================================================

create or replace function public.customer_signup(p_email text, p_password text, p_name text, p_phone text)
returns table (session_token uuid, error text)
language plpgsql
security definer
set search_path = public, extensions
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

create or replace function public.customer_login(p_email text, p_password text)
returns table (session_token uuid, error text, account_not_found boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_account record;
  v_token uuid;
begin
  select * into v_account from public.customer_accounts where lower(email) = lower(trim(p_email));

  if not found then
    account_not_found := true;
    error := 'No existe ninguna cuenta con ese email.';
    return next;
    return;
  end if;

  if v_account.password_hash <> crypt(p_password, v_account.password_hash) then
    account_not_found := false;
    error := 'Contraseña incorrecta.';
    return next;
    return;
  end if;

  insert into public.customer_sessions (account_id)
  values (v_account.id)
  returning token into v_token;

  session_token := v_token;
  account_not_found := false;
  return next;
end;
$$;

revoke all on function public.customer_login(text, text) from public;
grant execute on function public.customer_login(text, text) to anon, authenticated;
