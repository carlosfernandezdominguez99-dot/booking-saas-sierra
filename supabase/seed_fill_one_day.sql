-- =========================================================================
-- seed_fill_one_day.sql — deja UN día concreto totalmente sin huecos
-- libres, para poder probar de verdad la lista de espera (que solo tiene
-- sentido cuando ya no queda ningún hueco ese día) y ver el listado de
-- reservas de un día completo.
--
-- CÓMO USARLO: pégalo entero en el SQL Editor de Supabase y dale a Run.
-- No hace falta que ejecutes antes `seed_test_bookings.sql`, aunque
-- funciona igual de bien si ya lo hiciste.
--
-- Qué hace: busca el primer día (entre mañana y los próximos 21 días) en
-- el que tu negocio esté realmente abierto según tus Horarios y que no
-- esté bloqueado (vacaciones/festivos), y va rellenando TODOS los huecos
-- reales de ese día para TODOS tus servicios activos, usando la misma
-- función que usa la página pública de reservas (`get_available_slots`)
-- — así que el resultado es exactamente "cero huecos disponibles" de
-- verdad, no una aproximación.
--
-- Al terminar, el `raise notice` te dice qué día quedó lleno y cuántas
-- citas se crearon — pruébalo en tu página pública de reservas eligiendo
-- ese día (debería salir "No hay huecos disponibles"), y desde ahí prueba
-- a apuntarte a la lista de espera para ese día.
-- =========================================================================

do $$
declare
  v_business_id uuid;
  v_target_date date;
  v_service_ids uuid[];
  v_customer_ids uuid[];
  v_service_id uuid;
  v_slot record;
  v_customer_id uuid;
  v_inserted_this_pass boolean;
  v_total_inserted int := 0;
  v_pass int := 0;
begin
  -- 1) Tu negocio.
  select b.id into v_business_id
  from public.businesses b
  join public.profiles p on p.id = b.owner_id
  where p.email = 'carlosfernandezdominguez99@gmail.com'
  limit 1;

  if v_business_id is null then
    raise exception 'No se encontró ningún negocio para ese email.';
  end if;

  -- 2) Servicios activos.
  select array_agg(id order by position) into v_service_ids
  from public.services
  where business_id = v_business_id and active = true;

  if v_service_ids is null or array_length(v_service_ids, 1) = 0 then
    raise exception 'Tu negocio no tiene ningún servicio activo — crea uno en el panel (Servicios) antes de ejecutar esto.';
  end if;

  -- 3) Clientes para repartir las citas (reutiliza los que ya tengas).
  select array_agg(id) into v_customer_ids
  from (select id from public.customers where business_id = v_business_id order by created_at limit 6) t;

  if v_customer_ids is null or array_length(v_customer_ids, 1) = 0 then
    raise exception 'No tienes ningún cliente todavía — ejecuta antes seed_test_bookings.sql (crea un par de clientes de prueba).';
  end if;

  -- 4) Primer día realmente abierto (según tus Horarios) y no bloqueado,
  -- entre mañana y los próximos 21 días.
  select min(gs::date) into v_target_date
  from generate_series(current_date + 1, current_date + 21, interval '1 day') as gs
  where exists (
    select 1 from public.business_hours bh
    where bh.business_id = v_business_id
      and bh.employee_id is null
      and bh.day_of_week = extract(dow from gs)::smallint
  )
  and not exists (
    select 1 from public.blocked_dates bd
    where bd.business_id = v_business_id and bd.date = gs::date
  );

  if v_target_date is null then
    raise exception 'No encontré ningún día abierto en los próximos 21 días — revisa tus Horarios en el panel (parece que no tienes ninguno configurado, o están todos bloqueados).';
  end if;

  -- 5) Se van rellenando huecos reales (vía get_available_slots, la misma
  -- función que usa tu página pública) hasta que ningún servicio activo
  -- tenga ya ningún hueco libre ese día. Varias pasadas sobre todos los
  -- servicios porque, al ir ocupando tiempo, pueden quedar huecos sueltos
  -- que solo encajan en un servicio más corto que ya se procesó antes.
  loop
    v_pass := v_pass + 1;
    v_inserted_this_pass := false;

    foreach v_service_id in array v_service_ids loop
      select * into v_slot
      from public.get_available_slots(v_business_id, v_service_id, v_target_date, null)
      limit 1;

      if found then
        v_customer_id := v_customer_ids[1 + (v_total_inserted % array_length(v_customer_ids, 1))];

        insert into public.bookings (business_id, service_id, customer_id, start_time, end_time, status)
        values (v_business_id, v_service_id, v_customer_id, v_slot.slot_start, v_slot.slot_end, 'confirmed');

        v_total_inserted := v_total_inserted + 1;
        v_inserted_this_pass := true;
      end if;
    end loop;

    exit when not v_inserted_this_pass or v_pass > 500; -- red de seguridad, no debería llegar a hacer falta
  end loop;

  if v_total_inserted = 0 then
    raise notice 'El día % ya no tenía ningún hueco libre (o tus Horarios no dejan ninguno) — no hizo falta crear nada.', v_target_date;
  else
    raise notice 'Día % completamente lleno: % citas creadas, ya no queda ningún hueco libre ese día.', v_target_date, v_total_inserted;
  end if;
end $$;
