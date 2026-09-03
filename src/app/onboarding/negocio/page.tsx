import { requireBusinessContext } from "@/lib/services/authContext";
import { listServices } from "@/lib/services/servicesService";
import { hoursRowsToWeekly, listBusinessHours } from "@/lib/services/hoursService";
import { getBookingSettings } from "@/lib/services/bookingSettingsService";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import type { BookingSettingsInput } from "@/lib/validations/business";

const DEFAULT_SETTINGS: BookingSettingsInput = {
  minNoticeMinutes: 60,
  maxNoticeDays: 30,
  bufferMinutes: 0,
  allowCancellation: true,
  minCancellationHours: 24,
};

export default async function OnboardingNegocioPage() {
  const { supabase, business } = await requireBusinessContext();

  const [services, hoursRows, settingsRow] = await Promise.all([
    listServices(supabase, business.id),
    listBusinessHours(supabase, business.id),
    getBookingSettings(supabase, business.id),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const publicUrl = `${siteUrl}/negocio/${business.slug}`;

  const initialSettings: BookingSettingsInput = settingsRow
    ? {
        minNoticeMinutes: settingsRow.min_notice_minutes,
        maxNoticeDays: settingsRow.max_notice_days,
        bufferMinutes: settingsRow.buffer_minutes,
        allowCancellation: settingsRow.allow_cancellation,
        minCancellationHours: settingsRow.min_cancellation_hours,
      }
    : DEFAULT_SETTINGS;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50/50 px-4 py-12">
      <OnboardingWizard
        businessName={business.name}
        initialProfile={{
          description: business.description ?? "",
          address: business.address ?? "",
          city: business.city ?? "",
        }}
        initialServices={services}
        initialWeeklyHours={hoursRowsToWeekly(hoursRows)}
        initialBookingSettings={initialSettings}
        publicUrl={publicUrl}
      />
    </main>
  );
}
