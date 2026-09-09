-- =========================================================================
-- 0020_reviews.sql — Fase 9.3: reseñas.
--
-- Una reseña por cliente y negocio como máximo (constraint `unique
-- (business_id, customer_id)`, que además es lo que impide mandar el
-- enlace dos veces). Se crea la fila (con su enlace) en cuanto termina la
-- PRIMERA cita confirmada de ese cliente con ese negocio — no cuando se
-- deja la opinión, que puede pasar más tarde o no pasar nunca (rating y
-- comment se quedan a null hasta entonces).
--
-- No hay ningún trigger de base de datos "al terminar la cita": nada
-- cambia el estado de una reserva a mano cuando pasa la hora (se queda en
-- `confirmed` para siempre salvo que se cancele). Por eso la detección de
-- "cita ya terminada" la hace `request_pending_reviews()`, llamada
-- periódicamente desde un cron de Vercel (`/api/cron/review-requests`),
-- no un trigger — mirar `end_time < now()` en un trigger no tendría
-- sentido, nada dispara el trigger con el simple paso del tiempo.
-- =========================================================================

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  token uuid not null default gen_random_uuid(),
  rating smallint check (rating between 1 and 5),
  comment text,
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, customer_id)
);

create unique index idx_reviews_token on public.reviews (token);

alter table public.reviews enable row level security;

-- El negocio solo puede LEER sus propias reseñas — nunca crearlas ni
-- editarlas a mano (las crea el cron, las rellena el propio cliente a
-- través de `submit_review`).
create policy "reviews: negocio lee las suyas"
  on public.reviews for select
  using (public.is_business_member(business_id));

-- Ni `anon` ni `authenticated` tocan la tabla directamente: todo pasa por
-- las funciones de abajo (mismo patrón que `bookings`/`waitlist_entries`).

-- -------------------------------------------------------------------------
-- request_pending_reviews: la llama el cron (con la service role, que
-- salta RLS) — busca citas confirmadas cuya hora de fin ya pasó (dentro de
-- una ventana de 2 días, para no reprocesar todo el historial en cada
-- pasada) y para las que su cliente todavía no tiene ninguna reseña con
-- ese negocio. Inserta la fila con `on conflict do nothing`: así, aunque
-- el cron se solape o la cita tenga varias filas candidatas, cada
-- cliente+negocio solo dispara el envío una vez en toda su historia — y
-- solo devuelve las que de verdad se acaban de insertar (nunca reenvía).
-- -------------------------------------------------------------------------
create function public.request_pending_reviews()
returns table (
  review_token uuid,
  business_id uuid,
  business_name text,
  business_slug text,
  customer_id uuid,
  customer_name text,
  customer_email text,
  service_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select distinct on (b.business_id, b.customer_id)
      b.id as booking_id, b.business_id, b.customer_id
    from public.bookings b
    where b.status = 'confirmed'
      and b.end_time < now()
      and b.end_time > now() - interval '2 days'
      and not exists (
        select 1 from public.reviews r
        where r.business_id = b.business_id and r.customer_id = b.customer_id
      )
    order by b.business_id, b.customer_id, b.start_time asc
  ),
  inserted as (
    insert into public.reviews (business_id, customer_id, booking_id)
    select business_id, customer_id, booking_id from candidates
    on conflict (business_id, customer_id) do nothing
    returning business_id, customer_id, booking_id, token
  )
  select
    i.token,
    biz.id,
    biz.name,
    biz.slug,
    i.customer_id,
    c.name,
    c.email,
    s.name
  from inserted i
  join public.businesses biz on biz.id = i.business_id
  join public.customers c on c.id = i.customer_id
  left join public.bookings bk on bk.id = i.booking_id
  left join public.services s on s.id = bk.service_id;
end;
$$;

revoke all on function public.request_pending_reviews() from public;
grant execute on function public.request_pending_reviews() to service_role;

-- -------------------------------------------------------------------------
-- get_review_by_token: para la página pública de la reseña — solo dice si
-- el enlace es válido, de qué negocio es y si ya se usó (para no dejar
-- opinar dos veces), nunca el email/nombre del cliente.
-- -------------------------------------------------------------------------
create function public.get_review_by_token(p_token uuid)
returns table (
  valid boolean,
  business_name text,
  already_submitted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review record;
  v_business record;
begin
  select * into v_review from public.reviews where token = p_token;
  if not found then
    valid := false;
    return next;
    return;
  end if;

  select * into v_business from public.businesses where id = v_review.business_id;

  valid := true;
  business_name := v_business.name;
  already_submitted := v_review.submitted_at is not null;
  return next;
end;
$$;

revoke all on function public.get_review_by_token(uuid) from public;
grant execute on function public.get_review_by_token(uuid) to anon, authenticated;

-- -------------------------------------------------------------------------
-- submit_review: guarda la opinión. Solo una vez por enlace — si
-- `submitted_at` ya tiene valor, se rechaza en vez de sobrescribir.
-- -------------------------------------------------------------------------
create function public.submit_review(p_token uuid, p_rating smallint, p_comment text)
returns table (ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review record;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    ok := false;
    error := 'Elige una puntuación de 1 a 5.';
    return next;
    return;
  end if;

  select * into v_review from public.reviews where token = p_token;
  if not found then
    ok := false;
    error := 'Este enlace no es válido.';
    return next;
    return;
  end if;

  if v_review.submitted_at is not null then
    ok := false;
    error := 'Ya has dejado tu opinión con este enlace.';
    return next;
    return;
  end if;

  update public.reviews
  set rating = p_rating,
      comment = nullif(trim(coalesce(p_comment, '')), ''),
      submitted_at = now()
  where token = p_token;

  ok := true;
  return next;
end;
$$;

revoke all on function public.submit_review(uuid, smallint, text) from public;
grant execute on function public.submit_review(uuid, smallint, text) to anon, authenticated;
