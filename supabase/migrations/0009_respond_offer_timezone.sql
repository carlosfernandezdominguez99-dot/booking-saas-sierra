-- =========================================================================
-- 0009_respond_offer_timezone.sql — corrige la hora que se mostraba en los
-- emails de la lista de espera.
--
-- Bug: los emails de confirmación/oferta mostraban la hora en UTC en vez
-- de en la zona horaria del negocio (una cita a las 18:00 en
-- Europe/Madrid podía salir como "17:00" o "16:00" en el correo). La
-- causa: `respond_to_waitlist_offer` no devolvía la zona horaria del
-- negocio, así que la capa de TypeScript no tenía forma de formatear bien
-- la hora al enviar el email de confirmación (al aceptar) ni el de la
-- siguiente oferta (al rechazar en cadena).
--
-- `create or replace function` no permite cambiar la tabla de retorno de
-- una función existente, así que aquí se hace `drop` + `create`.
-- =========================================================================

drop function if exists public.respond_to_waitlist_offer(uuid, boolean);

create function public.respond_to_waitlist_offer(p_token uuid, p_accept boolean)
returns table (
  result text,
  booking_id uuid,
  business_name text,
  -- Zona horaria del negocio (p. ej. "Europe/Madrid") — para poder
  -- mostrar la hora correcta en los emails que se mandan desde TypeScript.
  business_timezone text,
  service_name text,
  start_time timestamptz,
  end_time timestamptz,
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
  business_timezone := v_business.timezone;
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
