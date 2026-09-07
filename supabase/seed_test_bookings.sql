-- =========================================================================
-- seed_test_bookings.sql — datos de prueba para comprobar estadísticas.
--
-- Genera citas próximas (mañana en adelante, ~2 semanas, saltando
-- domingos) para TU negocio, repitiendo varios clientes ya existentes y
-- añadiendo un par de clientes nuevos de prueba, para que las
-- estadísticas del panel (citas por día, clientes que repiten, etc.)
-- tengan algo real que mostrar.
--
-- CÓMO USARLO: pégalo entero en el SQL Editor de Supabase y dale a Run.
-- No es una migración de esquema (no cambia tablas ni funciones) — es
-- solo para rellenar datos de prueba, así que no hace falta añadirlo a la
-- carpeta `migrations/`.
--
-- OJO:
--  - Necesitas tener al menos un servicio activo dado de alta en el panel
--    (Servicios) antes de ejecutar esto — si no, el script para con un
--    error explicándolo.
--  - Asume que ningún servicio dura más de 3 horas (las citas se separan
--    9:00 / 12:00 / 15:00 / 18:00 hora del negocio); si tienes un
--    servicio más largo, se podría solapar con la siguiente y el script
--    pararía con un error de "solape" — dímelo y ajusto el espaciado.
--  - Si lo ejecutas dos veces el mismo día, la segunda vez chocará con
--    las citas que ya creó la primera (mismos huecos exactos) y dará
--    error de solape sin crear nada más — es lo esperado, no hace falta
--    limpiarlo a mano, la transacción entera se deshace sola.
--  - Los clientes de prueba nuevos llevan "(prueba)" en el nombre y un
--    teléfono que empieza por +34600 900xxx, para poder identificarlos y
--    borrarlos luego a mano si quieres.
-- =========================================================================

do $$
declare
  v_business_id uuid;
  v_timezone text;
  v_service_ids uuid[];
  v_existing_customer_ids uuid[];
  v_new_customer_ids uuid[];
  v_customer_ids uuid[];
  v_day date;
  v_slot_local timestamp;
  v_start timestamptz;
  v_end timestamptz;
  v_service_id uuid;
  v_duration int;
  v_customer_id uuid;
  v_status text;
  v_slot_index int;
  v_day_offset int;
  v_created_count int := 0;
begin
  -- 1) Tu negocio (el único que tienes, buscado por el email con el que
  -- entras al panel).
  select b.id, b.timezone into v_business_id, v_timezone
  from public.businesses b
  join public.profiles p on p.id = b.owner_id
  where p.email = 'carlosfernandezdominguez99@gmail.com'
  limit 1;

  if v_business_id is null then
    raise exception 'No se encontró ningún negocio para ese email.';
  end if;

  -- 2) Servicios activos del negocio (hace falta al menos uno).
  select array_agg(id order by position) into v_service_ids
  from public.services
  where business_id = v_business_id and active = true;

  if v_service_ids is null or array_length(v_service_ids, 1) = 0 then
    raise exception 'Tu negocio no tiene ningún servicio activo — crea uno en el panel (Servicios) antes de ejecutar esto.';
  end if;

  -- 3) Hasta 4 clientes que ya existan de verdad, para repetirlos en
  -- varias citas (lo que pediste).
  select array_agg(id) into v_existing_customer_ids
  from (
    select id from public.customers
    where business_id = v_business_id
    order by created_at asc
    limit 4
  ) t;

  -- 4) Un par de clientes nuevos de prueba, para que también haya alguno
  -- que no se repita tanto (identificables por "(prueba)" en el nombre).
  insert into public.customers (business_id, name, phone, email)
  values
    (v_business_id, 'Lucía Ejemplo (prueba)', '+34600900001', 'lucia.prueba@example.com'),
    (v_business_id, 'Marcos Ejemplo (prueba)', '+34600900002', 'marcos.prueba@example.com')
  on conflict (business_id, phone) do nothing;

  select array_agg(id) into v_new_customer_ids
  from public.customers
  where business_id = v_business_id
    and phone in ('+34600900001', '+34600900002');

  v_customer_ids := coalesce(v_existing_customer_ids, array[]::uuid[]) || coalesce(v_new_customer_ids, array[]::uuid[]);

  if array_length(v_customer_ids, 1) is null or array_length(v_customer_ids, 1) = 0 then
    raise exception 'No hay clientes disponibles ni se pudieron crear los de prueba.';
  end if;

  -- 5) Citas de mañana en adelante, ~2 semanas, 4 huecos al día
  -- (9:00 / 12:00 / 15:00 / 18:00, hora del negocio), saltando domingos,
  -- repitiendo clientes y servicios en round-robin, con algún "pending" y
  -- alguna "cancelled" sueltas para que las estadísticas tengan algo de
  -- variedad de estados, no solo "confirmed".
  for v_day_offset in 1..14 loop
    v_day := current_date + v_day_offset;

    if extract(dow from v_day) = 0 then
      continue; -- domingo cerrado
    end if;

    for v_slot_index in 0..3 loop
      v_slot_local := v_day + (9 + v_slot_index * 3) * interval '1 hour';
      v_start := v_slot_local at time zone v_timezone;

      v_service_id := v_service_ids[1 + ((v_day_offset + v_slot_index) % array_length(v_service_ids, 1))];
      select duration_minutes into v_duration from public.services where id = v_service_id;
      v_end := v_start + make_interval(mins => v_duration);

      v_customer_id := v_customer_ids[1 + ((v_day_offset * 2 + v_slot_index) % array_length(v_customer_ids, 1))];

      v_status := case
        when v_slot_index = 3 and v_day_offset % 5 = 0 then 'pending'
        when v_slot_index = 2 and v_day_offset % 7 = 0 then 'cancelled'
        else 'confirmed'
      end;

      insert into public.bookings (business_id, service_id, customer_id, start_time, end_time, status)
      values (v_business_id, v_service_id, v_customer_id, v_start, v_end, v_status);

      v_created_count := v_created_count + 1;
    end loop;
  end loop;

  raise notice 'Listo: % citas de prueba creadas para el negocio %.', v_created_count, v_business_id;
end $$;
