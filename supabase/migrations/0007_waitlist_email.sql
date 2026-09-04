-- =========================================================================
-- 0007_waitlist_email.sql — añade el email del cliente a las funciones de
-- lista de espera.
--
-- Motivo: el email pasa a ser obligatorio al reservar desde la página
-- pública (ver `publicBookingContactSchema` en el código — de "opcional"
-- pasa a exigirse), porque mientras no haya una cuenta de WhatsApp
-- Business API conectada, el correo es el único canal real para avisar de
-- confirmaciones, cancelaciones y ofertas de hueco libre (antes solo se
-- dejaban en los logs del servidor vía el mock de WhatsApp). Estas
-- funciones necesitan devolver también el email del cliente para que la
-- capa de TypeScript pueda enviarlo.
--
-- `create or replace function` no permite cambiar la tabla de retorno de
-- una función ya existente, así que aquí se hace `drop` + `create` en vez
-- de un simple `or replace`.
-- =========================================================================

drop function if exists public.offer_waitlist_slot(uuid, date, timestamptz, timestamptz, uuid);

create function public.offer_waitlist_slot(
  p_business_id uuid,
  p_preferred_date date,
  p_slot_start timestamptz,
  p_slot_end timestamptz,
  p_exclude_entry_id uuid default null
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
  select we.id, we.service_id, s.duration_minutes, we.respond_token,
         c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
         s.name as service_name
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
      offered_at = now()
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

-- Sigue sin grant a `authenticated`/`anon` a propósito — ver el comentario
-- largo en 0006_waitlist.sql, no cambia con esta migración.
revoke all on function public.offer_waitlist_slot(uuid, date, timestamptz, timestamptz, uuid) from public;

drop function if exists public.offer_next_waitlist_candidate(uuid);

create function public.offer_next_waitlist_candidate(p_booking_id uuid)
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
    select * from public.offer_waitlist_slot(v_booking.business_id, v_date, v_booking.start_time, v_booking.end_time);
end;
$$;

revoke all on function public.offer_next_waitlist_candidate(uuid) from public;
grant execute on function public.offer_next_waitlist_candidate(uuid) to authenticated;

drop function if exists public.respond_to_waitlist_offer(uuid, boolean);

create function public.respond_to_waitlist_offer(p_token uuid, p_accept boolean)
returns table (
  result text,
  booking_id uuid,
  business_name text,
  service_name text,
  start_time timestamptz,
  end_time timestamptz,
  -- Datos de quien responde: hacen falta para poder enviarle un email de
  -- confirmación cuando acepta (antes no se devolvían).
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
  customer_name := v_customer.name;
  customer_email := v_customer.email;

  if not p_accept then
    update public.waitlist_entries set status = 'rejected' where id = v_entry.id;

    select * into v_next
    from public.offer_waitlist_slot(v_entry.business_id, v_date, v_entry.offered_start_time, v_entry.offered_end_time, v_entry.id);

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

  select not exists (
    select 1 from public.bookings b
    where b.business_id = v_entry.business_id
      and b.employee_id is null
      and b.status not in ('cancelled', 'no_show')
      and tstzrange(b.start_time, b.end_time, '[)') && tstzrange(v_entry.offered_start_time, v_entry.offered_end_time, '[)')
  ) into v_still_available;

  if not v_still_available then
    update public.waitlist_entries set status = 'expired' where id = v_entry.id;
    result := 'expired';
    return next;
    return;
  end if;

  insert into public.bookings (business_id, service_id, customer_id, start_time, end_time, status)
  values (v_entry.business_id, v_entry.service_id, v_entry.customer_id, v_entry.offered_start_time, v_entry.offered_end_time, 'confirmed')
  returning id into v_new_booking_id;

  update public.waitlist_entries set status = 'accepted' where id = v_entry.id;

  result := 'accepted';
  booking_id := v_new_booking_id;
  service_name := v_service.name;
  start_time := v_entry.offered_start_time;
  end_time := v_entry.offered_end_time;
  return next;
end;
$$;

revoke all on function public.respond_to_waitlist_offer(uuid, boolean) from public;
grant execute on function public.respond_to_waitlist_offer(uuid, boolean) to anon, authenticated;
