-- =========================================================================
-- seed.sql — datos de demostración ("Barbería Demo")
--
-- IMPORTANTE: los negocios pertenecen siempre a un usuario real de
-- Supabase Auth (public.businesses.owner_id -> auth.users). Este script
-- NO crea ese usuario (los campos internos de auth.users varían entre
-- versiones de GoTrue y no es seguro fabricarlos a mano). Pasos:
--
--   1. Arranca la app y regístrate una vez en /registro con cualquier
--      email (p. ej. demo@bookingsaas.test).
--   2. Copia el UUID de ese usuario desde el Dashboard de Supabase
--      (Authentication → Users) o con:
--        select id, email from auth.users;
--   3. Sustituye el valor de `demo_owner_id` más abajo por ese UUID.
--   4. Ejecuta este archivo, p. ej.:
--        supabase db execute -f supabase/seed.sql
--      o pégalo en el SQL Editor del dashboard de Supabase.
-- =========================================================================

do $$
declare
  demo_owner_id uuid := '00000000-0000-0000-0000-000000000000'; -- <-- sustituir
  v_business_id uuid;
  v_service_corte uuid;
  v_service_barba uuid;
  v_service_combo uuid;
  v_employee_id uuid;
  v_customer_id uuid;
begin
  if demo_owner_id = '00000000-0000-0000-0000-000000000000' then
    raise exception 'Sustituye demo_owner_id por el UUID de un usuario real antes de ejecutar el seed.';
  end if;

  delete from public.businesses where slug = 'barberia-demo';

  insert into public.businesses (
    owner_id, name, slug, description, phone, address, city, business_type, subscription_status
  ) values (
    demo_owner_id,
    'Barbería Demo',
    'barberia-demo',
    'Barbería clásica en el centro de la ciudad. Cortes, arreglos de barba y afeitado tradicional.',
    '+34 600 000 000',
    'Calle Mayor 12',
    'Madrid',
    'barberia',
    'trial'
  )
  returning id into v_business_id;

  update public.booking_settings
  set min_notice_minutes = 60, max_notice_days = 45, buffer_minutes = 10, min_cancellation_hours = 4
  where business_id = v_business_id;

  insert into public.services (business_id, name, description, price_cents, duration_minutes, position)
  values (v_business_id, 'Corte de pelo', 'Corte a tijera o máquina, incluye lavado.', 1500, 30, 1)
  returning id into v_service_corte;

  insert into public.services (business_id, name, description, price_cents, duration_minutes, position)
  values (v_business_id, 'Arreglo de barba', 'Perfilado y afeitado de barba.', 1000, 20, 2)
  returning id into v_service_barba;

  insert into public.services (business_id, name, description, price_cents, duration_minutes, position)
  values (v_business_id, 'Corte + barba', 'Combo completo de corte y arreglo de barba.', 2200, 45, 3)
  returning id into v_service_combo;

  insert into public.employees (business_id, name, active)
  values (v_business_id, 'Alex', true)
  returning id into v_employee_id;

  insert into public.employee_services (employee_id, service_id)
  values (v_employee_id, v_service_corte), (v_employee_id, v_service_barba), (v_employee_id, v_service_combo);

  -- Horario general del negocio: L-V 9-14 y 16-20, Sábado 9-14, Domingo cerrado.
  insert into public.business_hours (business_id, day_of_week, start_time, end_time) values
    (v_business_id, 1, '09:00', '14:00'), (v_business_id, 1, '16:00', '20:00'),
    (v_business_id, 2, '09:00', '14:00'), (v_business_id, 2, '16:00', '20:00'),
    (v_business_id, 3, '09:00', '14:00'), (v_business_id, 3, '16:00', '20:00'),
    (v_business_id, 4, '09:00', '14:00'), (v_business_id, 4, '16:00', '20:00'),
    (v_business_id, 5, '09:00', '14:00'), (v_business_id, 5, '16:00', '20:00'),
    (v_business_id, 6, '09:00', '14:00');

  insert into public.customers (business_id, name, phone, email)
  values (v_business_id, 'Juan Pérez', '+34611111111', 'juan@example.com')
  returning id into v_customer_id;

  insert into public.bookings (business_id, service_id, employee_id, customer_id, start_time, end_time, status)
  values (
    v_business_id, v_service_corte, v_employee_id, v_customer_id,
    date_trunc('day', now()) + interval '11 hours',
    date_trunc('day', now()) + interval '11 hours 30 minutes',
    'confirmed'
  );

  insert into public.customers (business_id, name, phone, email)
  values (v_business_id, 'María López', '+34622222222', null)
  returning id into v_customer_id;

  insert into public.bookings (business_id, service_id, employee_id, customer_id, start_time, end_time, status)
  values (
    v_business_id, v_service_combo, v_employee_id, v_customer_id,
    date_trunc('day', now()) + interval '1 day 17 hours',
    date_trunc('day', now()) + interval '1 day 17 hours 45 minutes',
    'pending'
  );

  raise notice 'Seed completado. Negocio de demo: %', v_business_id;
end $$;
