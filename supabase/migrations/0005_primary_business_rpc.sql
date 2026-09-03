-- -----------------------------------------------------------------------
-- get_my_primary_business: junta en una sola ida y vuelta a la base de
-- datos lo que antes eran dos consultas secuenciadas (`business_members`
-- y luego `businesses`) dentro de `getPrimaryBusinessForUser`. Esa función
-- se llama en CADA página del panel (vía `requireBusinessContext`), así
-- que esta ida y vuelta de red de más se notaba en todas partes —
-- especialmente al navegar por el calendario, donde además hay que
-- esperar las consultas de reservas/clientes/servicios.
--
-- Usa `auth.uid()` internamente en vez de recibir el user_id como
-- parámetro: al ser `security definer` (salta RLS), es la única forma de
-- garantizar que un usuario autenticado solo puede llegar a ver SU
-- PROPIO negocio con esta función, nunca el de otro pasándole otro id.
-- -----------------------------------------------------------------------
create or replace function public.get_my_primary_business()
returns table (
  role text,
  id uuid,
  owner_id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  phone text,
  address text,
  city text,
  business_type text,
  timezone text,
  subscription_status text,
  trial_ends_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    bm.role,
    b.id,
    b.owner_id,
    b.name,
    b.slug,
    b.description,
    b.logo_url,
    b.phone,
    b.address,
    b.city,
    b.business_type,
    b.timezone,
    b.subscription_status,
    b.trial_ends_at,
    b.onboarding_completed_at,
    b.created_at,
    b.updated_at
  from public.business_members bm
  join public.businesses b on b.id = bm.business_id
  where bm.user_id = auth.uid()
  order by bm.created_at asc
  limit 1;
$$;

revoke all on function public.get_my_primary_business() from public;
grant execute on function public.get_my_primary_business() to authenticated;
