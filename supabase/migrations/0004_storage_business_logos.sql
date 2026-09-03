-- =========================================================================
-- 0004_storage_business_logos.sql
-- Bucket de Storage para los logos que sube cada negocio, con RLS igual de
-- estricta que el resto del proyecto: cada negocio solo puede escribir en
-- su propia carpeta (primer segmento de la ruta = business_id), pero los
-- logos son públicos en lectura porque se muestran en la página de
-- reservas pública.
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('business-logos', 'business-logos', true)
on conflict (id) do nothing;

create policy "Los logos de negocio son públicos"
  on storage.objects for select
  using (bucket_id = 'business-logos');

create policy "Los miembros pueden subir el logo de su negocio"
  on storage.objects for insert
  with check (
    bucket_id = 'business-logos'
    and public.is_business_member((storage.foldername(name))[1]::uuid)
  );

create policy "Los miembros pueden actualizar el logo de su negocio"
  on storage.objects for update
  using (
    bucket_id = 'business-logos'
    and public.is_business_member((storage.foldername(name))[1]::uuid)
  );

create policy "Los miembros pueden borrar el logo de su negocio"
  on storage.objects for delete
  using (
    bucket_id = 'business-logos'
    and public.is_business_member((storage.foldername(name))[1]::uuid)
  );
