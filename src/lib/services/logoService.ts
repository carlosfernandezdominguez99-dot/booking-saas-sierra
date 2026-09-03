import type { createClient } from "@/lib/supabase/server";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

const BUCKET = "business-logos";
const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Sube el logo de un negocio al bucket público `business-logos` (ver
 * `supabase/migrations/0004_storage_business_logos.sql`) y actualiza
 * `businesses.logo_url`. La ruta empieza siempre por `${businessId}/`,
 * que es justo lo que comprueban las policies de Storage para autorizar
 * la subida.
 */
export async function uploadBusinessLogo(client: TypedClient, businessId: string, file: File): Promise<string> {
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    throw new Error("Formato no soportado. Usa una imagen PNG, JPG o WEBP.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("La imagen no puede superar los 3 MB.");
  }

  const path = `${businessId}/logo-${Date.now()}.${extension}`;

  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: updateError } = await (client.from("businesses") as any)
    .update({ logo_url: publicUrl })
    .eq("id", businessId);
  if (updateError) throw updateError;

  return publicUrl;
}
