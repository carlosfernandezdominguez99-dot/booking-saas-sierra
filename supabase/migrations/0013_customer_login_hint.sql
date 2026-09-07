-- =========================================================================
-- 0013_customer_login_hint.sql — cuando alguien intenta iniciar sesión con
-- un email que no tiene cuenta, `customer_login` ahora lo indica aparte
-- (`account_not_found`) para que la pantalla de "Mis citas" pueda avisar
-- "no tienes cuenta, regístrate" y saltar sola a la pestaña de registro,
-- en vez del mensaje genérico "email o contraseña incorrectos" que no
-- distinguía los dos casos (pedido explícito de Carlos: aquí prima la
-- comodidad de saber que hace falta registrarse frente a poder detectar
-- qué emails existen, que para una app de reservas no es información
-- sensible).
-- =========================================================================

drop function if exists public.customer_login(text, text);

create function public.customer_login(p_email text, p_password text)
returns table (session_token uuid, error text, account_not_found boolean)
language plpgsql
security definer
set search_path = public
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
