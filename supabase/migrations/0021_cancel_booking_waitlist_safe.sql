-- =========================================================================
-- 0021_cancel_booking_waitlist_safe.sql — arregla "No se pudo cancelar la
-- reserva. Inténtalo de nuevo." al cancelar desde "Mis citas".
--
-- Causa: `cancel_booking_by_account` (0017/0018) cancela la reserva y,
-- EN LA MISMA TRANSACCIÓN, intenta reofertar el hueco a quien esté en
-- lista de espera (`offer_waitlist_slot`). Si esa reoferta lanza
-- cualquier excepción, Postgres deshace TODA la función — incluida la
-- cancelación que ya se había hecho — y Supabase le devuelve un error
-- genérico al cliente, que es exactamente el mensaje que ve el usuario.
--
-- Cuando cancela el propio gerente desde el panel, este mismo paso vive en
-- una llamada aparte desde la aplicación, envuelta en un best-effort (ver
-- `dashboard/reservas/actions.ts`) — un fallo ahí nunca deshace la
-- cancelación. Aquí faltaba ese mismo aislamiento a nivel de base de
-- datos, porque las dos cosas pasan dentro de la misma función. Esta
-- migración añade ese aislamiento (un bloque `begin/exception` alrededor
-- SOLO de la reoferta): cancelar una cita ya no puede fallar por culpa de
-- la lista de espera, pase lo que pase ahí.
-- =========================================================================

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
  v_has_offer boolean := false;
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

  -- Best-effort a propósito (ver la nota larga de arriba): cualquier fallo
  -- aquí se ignora y la cancelación de arriba se queda hecha igual.
  begin
    select * into v_offer
    from public.offer_waitlist_slot(
      v_booking.business_id,
      (v_booking.start_time at time zone v_business.timezone)::date,
      v_booking.start_time,
      v_booking.end_time,
      p_employee_id => v_booking.employee_id
    )
    limit 1;
    v_has_offer := found;
  exception when others then
    v_has_offer := false;
  end;

  if v_has_offer then
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
