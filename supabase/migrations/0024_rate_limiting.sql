-- =========================================================================
-- 0024_rate_limiting.sql — límite de peticiones por IP en los endpoints
-- públicos más expuestos a abuso (login, registro, reservar, reseñas,
-- lista de espera, invitaciones).
--
-- Respaldado en Postgres, no en memoria del proceso: en Vercel cada
-- petición puede caer en una instancia serverless distinta, así que un
-- contador guardado solo en memoria no protegería nada de verdad — una
-- tabla compartida sí.
-- =========================================================================

create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_hits_bucket_time on public.rate_limit_hits (bucket_key, created_at);

alter table public.rate_limit_hits enable row level security;
-- Sin ninguna policy a propósito: ni `anon` ni `authenticated` tocan esta
-- tabla directamente, solo a través de la función `security definer` de
-- abajo (mismo patrón que `bookings`/`business_hours`).

-- -------------------------------------------------------------------------
-- check_rate_limit: dice si esta petición cuenta número `bucket_key` (p.
-- ej. "login:1.2.3.4") puede pasar, dado un máximo de peticiones en una
-- ventana de tiempo. Limpia de paso las marcas ya caducadas DE ESE MISMO
-- bucket — así la tabla no crece sin límite sin necesitar un cron aparte
-- de limpieza (el borrado es barato: usa el mismo índice que la consulta).
-- -------------------------------------------------------------------------
create function public.check_rate_limit(p_bucket_key text, p_max_requests int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.rate_limit_hits
  where bucket_key = p_bucket_key
    and created_at < now() - (p_window_seconds || ' seconds')::interval;

  select count(*) into v_count
  from public.rate_limit_hits
  where bucket_key = p_bucket_key;

  if v_count >= p_max_requests then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket_key) values (p_bucket_key);
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;
