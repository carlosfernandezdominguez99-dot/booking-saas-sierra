import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type { BookingSettingsInput } from "@/lib/validations/business";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

type BookingSettingsRow = Database["public"]["Tables"]["booking_settings"]["Row"];
type BookingSettingsUpdate = Database["public"]["Tables"]["booking_settings"]["Update"];

const SETTINGS_COLUMNS =
  "business_id, min_notice_minutes, max_notice_days, buffer_minutes, allow_cancellation, min_cancellation_hours, updated_at";

/**
 * La fila de `booking_settings` se crea automáticamente (con valores por
 * defecto) mediante un trigger al crear el negocio — esta capa solo lee y
 * actualiza, nunca inserta.
 */
export async function getBookingSettings(
  client: TypedClient,
  businessId: string,
): Promise<BookingSettingsRow | null> {
  const { data, error } = (await client
    .from("booking_settings")
    .select(SETTINGS_COLUMNS)
    .eq("business_id", businessId)
    .maybeSingle()) as unknown as { data: BookingSettingsRow | null; error: { message: string } | null };

  if (error) throw error;
  return data;
}

export async function updateBookingSettings(
  client: TypedClient,
  businessId: string,
  input: BookingSettingsInput,
): Promise<void> {
  const updatePayload: BookingSettingsUpdate = {
    min_notice_minutes: input.minNoticeMinutes,
    max_notice_days: input.maxNoticeDays,
    buffer_minutes: input.bufferMinutes,
    allow_cancellation: input.allowCancellation,
    min_cancellation_hours: input.minCancellationHours,
  };

  const { error } = await (client.from("booking_settings") as any)
    .update(updatePayload)
    .eq("business_id", businessId);

  if (error) throw error;
}
