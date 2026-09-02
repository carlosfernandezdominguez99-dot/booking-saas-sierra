/**
 * Tipos de la base de datos, escritos a mano para que coincidan con las
 * migraciones de `supabase/migrations`.
 *
 * En cuanto exista un proyecto Supabase real, se pueden regenerar
 * automáticamente con:
 *   npm run supabase:types
 * (usa el Supabase CLI y sobreescribe este archivo).
 *
 * Nota: cada tabla incluye `Relationships: []` y el esquema incluye
 * `CompositeTypes` aunque no los usemos, porque @supabase/supabase-js
 * (vía @supabase/postgrest-js) espera esa forma exacta (la misma que
 * genera `supabase gen types`) para poder resolver correctamente los
 * tipos de `.select(...)`, incluido `select("*")`. Sin `Relationships`,
 * algunas consultas resolvían silenciosamente a `never` en el build.
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      employee_services: {
        Row: { employee_id: string; service_id: string };
        Insert: { employee_id: string; service_id: string };
        Update: Partial<{ employee_id: string; service_id: string }>;
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Insert: Partial<Database["public"]["Tables"]["bookin
