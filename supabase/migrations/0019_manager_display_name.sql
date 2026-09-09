-- =========================================================================
-- 0019_manager_display_name.sql — Fase 9.2: el gerente ya no necesita una
-- ficha de empleado falsa para seguir siendo reservable.
--
-- "Sin empleado" (employee_id null, en business_hours/bookings) pasa a
-- significar oficialmente "la agenda del propio gerente" en toda la app.
-- Para poder mostrarle por su nombre al cliente (en el paso "¿con quién?"
-- y en las confirmaciones) sin depender de leer `profiles` desde `anon`
-- (RLS solo deja leer el propio perfil), se guarda un nombre propio,
-- editable, en el negocio — se rellena con el nombre de quien se registra
-- y se puede cambiar después desde Configuración.
-- =========================================================================

alter table public.businesses
  add column manager_display_name text;
