-- =========================================================================
-- 0017_customer_cancel_booking.sql — permite que el propio cliente cancele
-- una cita desde "Mis citas", respetando la política de cancelación de
-- CADA negocio (`booking_settings.allow_cancellation` /
-- `min_cancellation_hours` — ya existían, configurables desde el panel del
-- negocio; no se inventa un plazo fijo).
--
-- También añade esos dos datos, y `service_id`, a lo que ya devolvía
-- `get_customer_account_data`, para que el frontend sepa cuándo puede
-- enseñar los botones "Cancelar"/"Modificar" sin tener que preguntar al
-- servidor primero.
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
      'allow_cancellation', coalesce(bs.allow_cancellation, true),
      'min_cancellation_hours', coalesce(bs.min_cancellation_hours, 0),
      'upcoming_bookings', (
        select coalesce(jsonb_agg(row_to_json(t) order by t.start_time asc), '[]'::jsonb)
        from (
          select bk.id, bk.service_id, s.name as service_name, bk.start_time, bk.end_time, bk.status
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
          select bk.id, bk.service_id, s.name as service_name, bk.start_time, bk.end_time, bk.status
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
    left join public.booking_settings bs on bs.business_id = b.id
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
-- cancel_booking_by_account: cancela una reserva del propio cliente.
-- Autoriza por email (igual que el resto de funciones de cuenta), no por
-- `is_business_member` — por eso NO puede llamar directamente a
-- `offer_next_waitlist_candidate` (esa función exige ser miembro del
-- negocio). En su lugar repite la misma llamada de bajo nivel que esa
-- función usa por dentro (`offer_waitlist_slot`, que no exige nada — está
-- pensada para que solo la llamen otras funciones ya autorizadas), así el
-- hueco que se libera también avisa a quien esté esperando, igual que
-- cuando cancela el propio negocio desde su panel.
-- -------------------------------------------------------------------------
create function public.cancel_booking_by_account(p_token uuid, p_booking_id uuid)
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

  select bk.id, bk.business_id, bk.service_id, bk.start_time, bk.end_time, bk.status,
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
    v_booking.end_time
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

revoke all on function public.cancel_booking_by_account(uuid, uuid) from public;
grant execute on function public.cancel_booking_by_account(uuid, uuid) to anon, authenticated;
