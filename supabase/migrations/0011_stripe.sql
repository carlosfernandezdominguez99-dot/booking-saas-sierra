-- =========================================================================
-- 0011_stripe.sql — columnas para enlazar cada negocio con su cliente y
-- suscripción de Stripe (Fase 8). No cambia el flujo de negocio en sí
-- (`subscription_status`/`trial_ends_at` ya existían desde la Fase 1 y
-- siguen siendo la fuente de verdad que usa el resto de la app) — solo
-- añade dónde guardar los IDs que hacen falta para poder abrir el portal
-- de facturación y para que el webhook sepa a qué negocio actualizar.
-- =========================================================================

alter table public.businesses
  add column stripe_customer_id text,
  add column stripe_subscription_id text;

-- El webhook busca por `stripe_customer_id` en los eventos de suscripción
-- (no siempre traen el `business_id` en los metadatos, a diferencia de
-- `checkout.session.completed`), así que conviene un índice.
create index idx_businesses_stripe_customer on public.businesses (stripe_customer_id);
