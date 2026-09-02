-- =========================================================================
-- 0003_booking_functions.sql
--
-- Toda la lógica de disponibilidad y creación de reservas públicas vive
-- aquí, en el backend (Postgres), no en el cliente. Son las dos únicas
-- puertas de entrada que tiene el rol `anon` a datos relacionados con
-- reservas, y ambas son `security definer`: leen tablas que `anon` no
-- puede consultar directamente (bookings, business_hours, blocked_dates,
-- booking_settings, customers) pero solo devuelven lo estrictamente
-- necesario para la página pública.
--
-- El constraint `bookings_no_overlap` (0001_schema.sql) es la última red
-- de seguridad ante condiciones de carrera; esta función hace además la
-- validación "de negocio" (antelación, horario, días bloqueados) para dar
-- errores claros en vez de un error crudo de Postgres.
-- =========================================================================

-- Granularidad con la que se generan los huecos candidatos dentro de cada
-- franja horaria abierta. 15 minutos es un estándar razonable para el MVP.
create or replace function public.get_available_slots(
  p_business_id uuid,
  p_service_id uuid,
  p_date date,
  p_employee_id uuid default null
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_business record;
  v_service record;
  v_settings record;
  v_duration interval;
  v_buffer interval;
  v_dow smallint;
  v_hours record;
  v_step interval := interval '15 minutes';
  v_cursor timestamptz;
  v_slot_end timestamptz;
  v_earliest timestamptz;
  v_latest_date date;
  v_is_blocked boolean;
begin
  select * into v_business from public.businesses where id = p_business_id;
  if not found or v_business.subscription_status not in ('trial', 'active') then
    return; -- negocio inexistente o inactivo: sin huecos
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and business_id = p_business_id and active = true;
  if not found then
    return;
  end if;

  select * into v_settings from public.booking_settings where business_id = p_business_id;
  if not found then
    v_settings.min_notice_minutes := 60;
    v_settings.max_notice_days := 60;
    v_settings.buffer_minutes := 0;
  end if;

  v_latest_date := (now() at time zone v_business.timezone)::date + v_settings.max_notice_days;
  if p_date > v_latest_date then
    return;
  end if;

  -- Día bloqueado (general o del empleado concreto).
  select exists (
    select 1 from public.blocked_dates bd
    where bd.business_id = p_business_id
      and bd.date = p_date
      and (bd.employee_id is null or bd.employee_id = p_employee_id)
  ) into v_is_blocked;
  if v_is_blocked then
    return;
  end if;

  v_duration := make_interval(mins => v_service.duration_minutes);
  v_buffer := make_interval(mins => v_settings.buffer_minutes);
  v_earliest := now() + make_interval(mins => v_settings.min_notice_minutes);
  v_dow := extract(dow from p_date);

  for v_hours in
    select bh.start_time, bh.end_time
    from public.business_hours bh
    where bh.business_id = p_business_id
      and bh.day_of_week = v_dow
      and bh.employee_id is not distinct from p_employee_id
    order by bh.start_time
  loop
    v_cursor := (p_date::text || ' ' || v_hours.start_time::text)::timestamp at time zone v_business.timezone;

    while v_cursor + v_duration <= (p_date::text || ' ' || v_hours.end_time::text)::timestamp at time zone v_business.timezone
    loop
      v_slot_end := v_cursor + v_duration;

      if v_cursor >= v_earliest then
        -- ¿Choca con alguna reserva activa del mismo recurso, respetando el buffer?
        if not exists (
          select 1
          from public.bookings b
          where b.business_id = p_business_id
            and b.employee_id is not distinct from p_employee_id
            and b.status not in ('cancelled', 'no_show')
            and tstzrange(b.start_time - v_buffer, b.end_time + v_buffer, '[)')
                && tstzrange(v_cursor, v_slot_end, '[)')
        ) then
          slot_start := v_cursor;
          slot_end := v_slot_end;
          return next;
        end if;
      end if;

      v_cursor := v_cursor + v_step;
    end loop;
  end loop;

  return;
end;
$$;

revoke all on function public.get_available_slots(uuid, uuid, date, uuid) from public;
grant execute on function public.get_available_slots(uuid, uuid, date, uuid) to anon, authenticated;

-- -------------------------------------------------------------------------
-- create_public_booking: valida de nuevo el hueco (nunca confía en el
-- cliente) y crea/actualiza el cliente + la reserva en una única
-- transacción implícita de función.
-- -------------------------------------------------------------------------
create or replace function public.create_public_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_start_time timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_employee_id uuid default null,
  p_customer_email text default null,
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
  v_business record;
  v_service record;
  v_end_time timestamptz;
  v_customer_id uuid;
  v_booking_id uuid;
  v_available boolean;
begin
  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_customer_phone), '') = '' then
    raise exception 'Nombre y teléfono son obligatorios' using errcode = '22023';
  end if;

  select * into v_business from public.businesses where id = p_business_id;
  if not found or v_business.subscription_status not in ('trial', 'active') then
    raise exception 'Negocio no disponible' using errcode = '22023';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and business_id = p_business_id and active = true;
  if not found then
    raise exception 'Servicio no disponible' using errcode = '22023';
  end if;

  v_end_time := p_start_time + make_interval(mins => v_service.duration_minutes);

  -- Revalida que el hueco solicitado sigue apareciendo entre los huecos
  -- disponibles calculados por get_available_slots para ese día.
  select exists (
    select 1
    from public.get_available_slots(
      p_business_id, p_service_id, (p_start_time at time zone v_business.timezone)::date, p_employee_id
    ) s
    where s.slot_start = p_start_time
  ) into v_available;

  if not v_available then
    raise exception 'Ese horario ya no está disponible' using errcode = '22023';
  end if;

  insert into public.customers (business_id, name, phone, email)
  values (p_business_id, trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_customer_email), ''))
  on conflict (business_id, phone)
  do update set
    name = excluded.name,
    email = coalesce(excluded.email, public.customers.email),
    updated_at = now()
  returning id into v_customer_id;

  insert into public.bookings (
    business_id, service_id, employee_id, customer_id,
    start_time, end_time, status, comment
  )
  values (
    p_business_id, p_service_id, p_employee_id, v_customer_id,
    p_start_time, v_end_time, 'confirmed', nullif(trim(p_comment), '')
  )
  returning id into v_booking_id;

  insert into public.notifications (business_id, booking_id, channel, type, status, payload)
  values (
    p_business_id, v_booking_id, 'whatsapp', 'booking_confirmation', 'pending',
    jsonb_build_object('customer_phone', p_customer_phone)
  );

  return query
    select v_booking_id, v_business.name, v_service.name, v_service.price_cents,
           p_start_time, v_end_time, 'confirmed'::text;
end;
$$;

revoke all on function public.create_public_booking(uuid, uuid, timestamptz, text, text, uuid, text, text) from public;
grant execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, uuid, text, text) to anon, authenticated;
