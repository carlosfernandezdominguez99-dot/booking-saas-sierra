-- =========================================================================
-- 0016_account_business_logo.sql — añade el logo del negocio a lo que
-- devuelve `get_customer_account_data`, para la nueva pestaña "Negocios"
-- del panel de "Mis citas" (lista de los negocios donde el cliente ya ha
-- reservado o se ha apuntado a lista de espera, con su logo y enlace a su
-- página pública).
--
-- Mismo `RETURNS TABLE` de siempre (solo cambia una clave dentro del jsonb
-- `businesses`) — por eso basta con `create or replace function`, sin
-- `drop` primero.
-- =========================================================================

create or replace function public.get_customer_account_data(p_token uuid)
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
      'business_logo_url', b.logo_url,
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
