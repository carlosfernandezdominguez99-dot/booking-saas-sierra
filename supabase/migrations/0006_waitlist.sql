-- =========================================================================
-- 0006_waitlist.sql — Fase 7: lista de espera + reoferta automática al
-- cancelar una cita.
--
-- Reglas de negocio (acordadas con Carlos, ver PROGRESO.md):
--   - Cada entrada de la lista de espera es "cliente + servicio" (no solo
--     el cliente), porque el hueco que se libere tiene que encajar en
--     duración con el servicio que esa persona quiere.
--   - Al liberarse una cita (cancelación), se avisa EN ORDEN de llegada a
--     la lista de espera de ese día, saltando a quien no encaje en tiempo.
--   - Si la persona avisada rechaza (o no responde a tiempo), se pasa a
--     ofrecer el mismo hueco a la siguiente persona que encaje.
--   - Si acepta, se crea su cita y se reordena el resto de la lista (al
--     no usar una columna de posición explícita sino `created_at`, "el
--     resto de la lista" ya queda reordenado solo).
--
-- Todavía NO hay integración real de WhatsApp (llega cuando Carlos tenga
-- cuenta de WhatsApp Business API) — mientras tanto, la persona responde
-- "Sí/No" a través de un enlace público de un solo uso
-- (`respond_token`), y `whatsappService` (mock) es quien "envía" ese
-- enlace por ahora vía console.log, igual que el resto de mensajes.
-- =========================================================================

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  -- Día concreto para el que la persona quiere hueco (no una fecha límite:
  -- "quiero hueco EL VIERNES", por ejemplo).
  preferred_date date not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'offered', 'accepted', 'rejected', 'expired')),
  offered_start_time timestamptz,
  offered_end_time timestamptz,
  offered_at timestamptz,
  -- Token de un solo uso para el enlace público "Aceptar/Rechazar" que iría
  -- en el mensaje de WhatsApp — no requiere sesión, así que nunca se expone
  -- la tabla completa a `anon`, solo esta fila vía el token.
  respond_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (respond_token)
);

create index idx_waitlist_business_date_status
  on public.waitlist_entries (business_id, preferred_date, status, created_at);

create trigger trg_waitlist_entries_updated_at
  before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

alter table public.waitlist_entries enable row level security;

-- Los miembros del negocio ven y gestionan su propia lista de espera
-- (añadir a mano, cancelar una entrada, etc.) — igual que `customers`.
create policy "waitlist_entries: miembros gestionan su lista de espera"
  on public.waitlist_entries for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- Sin política para `anon`: el acceso público solo pasa por las funciones
-- `security definer` de abajo, que exponen únicamente lo necesario y solo
-- a través del `respond_token` (nunca se puede listar ni adivinar filas).

-- -------------------------------------------------------------------------
-- offer_waitlist_slot: función interna compartida — busca a la siguiente
-- persona en espera cuyo servicio quepa en el hueco dado y le marca la
-- oferta. La usan tanto la cancelación manual como el rechazo en cadena.
-- -------------------------------------------------------------------------
create or replace function public.offer_waitlist_slot(
  p_business_id uuid,
  p_preferred_date date,
  p_slot_start timestamptz,
  p_slot_end timestamptz,
  -- Al reofertar en cadena tras un rechazo, se excluye la entrada que
  -- acaba de rechazar para no volver a ofrecérselo a ella misma.
  p_exclude_entry_id uuid default null
)
returns table (
  entry_id uuid,
  customer_name text,
  customer_phone text,
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
  select we.id, we.service_id, s.duration_minutes, we.respond_token, c.name as customer_name, c.phone as customer_phone, s.name as service_name
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
  service_name := v_candidate.service_name;
  offered_start_time := p_slot_start;
  offered_end_time := v_candidate_end;
  respond_token := v_candidate.respond_token;
  return next;
end;
$$;

-- Sin grant a `authenticated`/`anon` a propósito: es un helper interno que
-- solo deben invocar `offer_next_waitlist_candidate` y
-- `respond_to_waitlist_offer` desde dentro (como son `security definer`,
-- esa llamada interna se comprueba contra los permisos del propietario de
-- la función, no contra quien llamó a la función pública, así que sigue
-- funcionando). Si se pudiera llamar directamente, cualquier usuario
-- autenticado podría leer nombre/teléfono de la lista de espera de OTRO
-- negocio pasando su `business_id` a mano.
revoke all on function public.offer_waitlist_slot(uuid, date, timestamptz, timestamptz, uuid) from public;

-- -------------------------------------------------------------------------
-- offer_next_waitlist_candidate: se llama justo después de cancelar una
-- cita desde el panel. Solo el propio negocio puede activarla sobre sus
-- reservas (RLS de `bookings` ya lo garantiza al leerla aquí dentro).
-- -------------------------------------------------------------------------
create or replace function public.offer_next_waitlist_candidate(p_booking_id uuid)
returns table (
  entry_id uuid,
  customer_name text,
  customer_phone text,
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

  -- Al ser `security definer` esta función salta RLS, así que hay que
  -- comprobar aquí a mano que quien llama pertenece al negocio de la
  -- reserva — si no, cualquier usuario autenticado (de cualquier negocio)
  -- podría leer nombre/teléfono de la lista de espera de otro negocio.
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

-- -------------------------------------------------------------------------
-- respond_to_waitlist_offer: la puerta pública (anon) para "Sí, la quiero"
-- / "No, gracias" desde el enlace de un solo uso. Revalida el hueco antes
-- de crear la cita (mismo principio que `create_public_booking`: nunca te
-- fías de lo que haya calculado el cliente).
-- -------------------------------------------------------------------------
create or replace function public.respond_to_waitlist_offer(p_token uuid, p_accept boolean)
returns table (
  result text,
  booking_id uuid,
  business_name text,
  service_name text,
  start_time timestamptz,
  end_time timestamptz,
  next_entry_id uuid,
  next_customer_name text,
  next_customer_phone text,
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
    -- Ya se respondió antes, o la oferta expiró/se reofertó a otra
    -- persona (doble clic, enlace usado dos veces, etc.).
    result := 'not_found';
    return next;
    return;
  end if;

  select * into v_business from public.businesses where id = v_entry.business_id;
  select * into v_service from public.services where id = v_entry.service_id;
  v_date := (v_entry.offered_start_time at time zone v_business.timezone)::date;

  -- Se fija ya para las dos ramas (aceptar/rechazar): al rechazar con
  -- reoferta en cadena, el nombre del negocio también hace falta para el
  -- aviso de WhatsApp de la siguiente persona.
  business_name := v_business.name;

  if not p_accept then
    update public.waitlist_entries set status = 'rejected' where id = v_entry.id;

    -- Se ofrece el mismo hueco liberado a la siguiente persona que encaje.
    -- Ojo: se comprueba `found` (nunca los campos de `v_next` directamente)
    -- porque un `record` sin asignar da error al leer un campo suyo, y
    -- aquí es perfectamente normal que no haya nadie más en espera.
    select * into v_next
    from public.offer_waitlist_slot(v_entry.business_id, v_date, v_entry.offered_start_time, v_entry.offered_end_time, v_entry.id);

    result := 'rejected';
    if found then
      next_entry_id := v_next.entry_id;
      next_customer_name := v_next.customer_name;
      next_customer_phone := v_next.customer_phone;
      next_service_name := v_next.service_name;
      next_offered_start_time := v_next.offered_start_time;
      next_offered_end_time := v_next.offered_end_time;
      next_respond_token := v_next.respond_token;
    end if;
    return next;
    return;
  end if;

  -- Aceptación: revalida que el hueco sigue libre antes de crear la cita.
  -- La lista de espera no distingue empleado (se apunta al negocio, no a
  -- una persona concreta) y la cita se crea con `employee_id` nulo — igual
  -- que `bookings_no_overlap` agrupa por `coalesce(employee_id, ...)`,
  -- aquí solo hace falta mirar solapes contra otras citas también sin
  -- empleado asignado.
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
  business_name := v_business.name;
  service_name := v_service.name;
  start_time := v_entry.offered_start_time;
  end_time := v_entry.offered_end_time;
  return next;
end;
$$;

revoke all on function public.respond_to_waitlist_offer(uuid, boolean) from public;
grant execute on function public.respond_to_waitlist_offer(uuid, boolean) to anon, authenticated;
