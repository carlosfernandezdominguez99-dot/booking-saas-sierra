-- =========================================================================
-- 0022_manager_photo.sql — Fase 11: el gerente también tiene su propio
-- círculo en el selector de arriba del panel (y su propia tarjeta en el
-- paso público "¿con quién?"), igual que cualquier empleado. Para eso
-- necesita una foto propia, distinta del logo del negocio.
-- =========================================================================

alter table public.businesses
  add column manager_photo_url text;
