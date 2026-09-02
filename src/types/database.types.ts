/**
 * Tipos de la base de datos, escritos a mano para que coincidan con las
 * migraciones de `supabase/migrations`.
 *
 * En cuanto exista un proyecto Supabase real, se pueden regenerar
 * automáticamente con:
 *   npm run supabase:types
 * (usa el Supabase CLI y sobreescribe este archivo).
 */

export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type NotificationChannel = "whatsapp" | "email" | "push";
export type NotificationStatus = "pending" | "sent" | "failed";
export type BusinessMemberRole = "owner" | "staff";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          description: string | null;
          logo_url: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          business_type: string | null;
          timezone: string;
          subscription_status: SubscriptionStatus;
          trial_ends_at: string;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["businesses"]["Row"]> & {
          owner_id: string;
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["businesses"]["Row"]>;
      };
      business_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: BusinessMemberRole;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["business_members"]["Row"]> & {
          business_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_members"]["Row"]>;
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          price_cents: number;
          duration_minutes: number;
          active: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["services"]["Row"]> & {
          business_id: string;
          name: string;
          duration_minutes: number;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Row"]>;
      };
      employees: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          photo_url: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["employees"]["Row"]> & {
          business_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Row"]>;
      };
      employee_services: {
        Row: { employee_id: string; service_id: string };
        Insert: { employee_id: string; service_id: string };
        Update: Partial<{ employee_id: string; service_id: string }>;
      };
      business_hours: {
        Row: {
          id: string;
          business_id: string;
          employee_id: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["business_hours"]["Row"]> & {
          business_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_hours"]["Row"]>;
      };
      blocked_dates: {
        Row: {
          id: string;
          business_id: string;
          employee_id: string | null;
          date: string;
          reason: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["blocked_dates"]["Row"]> & {
          business_id: string;
          date: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocked_dates"]["Row"]>;
      };
      booking_settings: {
        Row: {
          business_id: string;
          min_notice_minutes: number;
          max_notice_days: number;
          buffer_minutes: number;
          allow_cancellation: boolean;
          min_cancellation_hours: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["booking_settings"]["Row"]> & {
          business_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["booking_settings"]["Row"]>;
      };
      customers: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          phone: string;
          email: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> & {
          business_id: string;
          name: string;
          phone: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
      };
      bookings: {
        Row: {
          id: string;
          business_id: string;
          service_id: string;
          employee_id: string | null;
          customer_id: string;
          start_time: string;
          end_time: string;
          status: BookingStatus;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bookings"]["Row"]> & {
          business_id: string;
          service_id: string;
          customer_id: string;
          start_time: string;
          end_time: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
      };
      notifications: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string | null;
          channel: NotificationChannel;
          type: string;
          status: NotificationStatus;
          payload: Record<string, unknown> | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          business_id: string;
          channel: NotificationChannel;
          type: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_available_slots: {
        Args: {
          p_business_id: string;
          p_service_id: string;
          p_date: string;
          p_employee_id?: string | null;
        };
        Returns: { slot_start: string; slot_end: string }[];
      };
      create_public_booking: {
        Args: {
          p_business_id: string;
          p_service_id: string;
          p_start_time: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_employee_id?: string | null;
          p_customer_email?: string | null;
          p_comment?: string | null;
        };
        Returns: {
          booking_id: string;
          business_name: string;
          service_name: string;
          price_cents: number;
          start_time: string;
          end_time: string;
          status: string;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}
