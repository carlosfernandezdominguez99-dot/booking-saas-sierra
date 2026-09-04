/**
 * Tipos de la base de datos, escritos a mano para que coincidan con las
 * migraciones de `supabase/migrations`.
 *
 * En cuanto exista un proyecto Supabase real, se pueden regenerar
 * automáticamente con:
 *   npm run supabase:types
 * (usa el Supabase CLI y sobreescribe este archivo).
 *
 * IMPORTANTE — por qué `Insert`/`Update` están escritos como objetos
 * literales completos y NO como `Partial<Row> & {...}`:
 *
 * La primera versión de este archivo definía, para cada tabla, algo como
 *   Insert: Partial<Database["public"]["Tables"]["businesses"]["Row"]> & { ... }
 * es decir, un tipo que se autorreferencia dentro de la misma declaración
 * de `Database` en la que vive. Aunque TypeScript permite esto en teoría,
 * en la práctica provocaba que, en ciertos puntos de uso (algunos
 * `select()`, y también `insert()`), el tipo de la tabla colapsara a
 * `never` durante el build de producción de Next.js (aunque en local /
 * en runtime la consulta funcionaba perfectamente) — y lo hacía de forma
 * inconsistente: unas veces en un `select`, otras en un `insert`, y no en
 * todas las tablas ni todos los archivos. Esto costó varias rondas de
 * debugging antes de identificar que la causa raíz era esa referencia
 * circular, y no ninguna de las hipótesis anteriores (Relationships
 * ausente, `select("*")`, etc.).
 *
 * `supabase gen types` (la herramienta oficial) NUNCA genera `Insert`/
 * `Update` de esa forma autorreferenciada: siempre escribe cada campo de
 * forma literal e independiente. Este archivo ahora sigue ese mismo
 * patrón a mano, lo que elimina la causa raíz del problema. Si en el
 * futuro se regenera este archivo con el CLI, el resultado tendrá esta
 * misma forma.
 */

export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type NotificationChannel = "whatsapp" | "email" | "push";
export type NotificationStatus = "pending" | "sent" | "failed";
export type WaitlistStatus = "waiting" | "offered" | "accepted" | "rejected" | "expired";
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
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
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
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          description?: string | null;
          logo_url?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          business_type?: string | null;
          timezone?: string;
          subscription_status?: SubscriptionStatus;
          trial_ends_at?: string;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          logo_url?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          business_type?: string | null;
          timezone?: string;
          subscription_status?: SubscriptionStatus;
          trial_ends_at?: string;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
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
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role?: BusinessMemberRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: BusinessMemberRole;
          created_at?: string;
        };
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
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          price_cents?: number;
          duration_minutes: number;
          active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          price_cents?: number;
          duration_minutes?: number;
          active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
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
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          photo_url?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          photo_url?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employee_services: {
        Row: { employee_id: string; service_id: string };
        Insert: { employee_id: string; service_id: string };
        Update: { employee_id?: string; service_id?: string };
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
        Insert: {
          id?: string;
          business_id: string;
          employee_id?: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          employee_id?: string | null;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          created_at?: string;
        };
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
        Insert: {
          id?: string;
          business_id: string;
          employee_id?: string | null;
          date: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          employee_id?: string | null;
          date?: string;
          reason?: string | null;
          created_at?: string;
        };
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
        Insert: {
          business_id: string;
          min_notice_minutes?: number;
          max_notice_days?: number;
          buffer_minutes?: number;
          allow_cancellation?: boolean;
          min_cancellation_hours?: number;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          min_notice_minutes?: number;
          max_notice_days?: number;
          buffer_minutes?: number;
          allow_cancellation?: boolean;
          min_cancellation_hours?: number;
          updated_at?: string;
        };
        Relationships: [];
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
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          phone: string;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          phone?: string;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
        Insert: {
          id?: string;
          business_id: string;
          service_id: string;
          employee_id?: string | null;
          customer_id: string;
          start_time: string;
          end_time: string;
          status?: BookingStatus;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          service_id?: string;
          employee_id?: string | null;
          customer_id?: string;
          start_time?: string;
          end_time?: string;
          status?: BookingStatus;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
        Insert: {
          id?: string;
          business_id: string;
          booking_id?: string | null;
          channel: NotificationChannel;
          type: string;
          status?: NotificationStatus;
          payload?: Record<string, unknown> | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          booking_id?: string | null;
          channel?: NotificationChannel;
          type?: string;
          status?: NotificationStatus;
          payload?: Record<string, unknown> | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      waitlist_entries: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          service_id: string;
          preferred_date: string;
          status: WaitlistStatus;
          offered_start_time: string | null;
          offered_end_time: string | null;
          offered_at: string | null;
          respond_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          service_id: string;
          preferred_date: string;
          status?: WaitlistStatus;
          offered_start_time?: string | null;
          offered_end_time?: string | null;
          offered_at?: string | null;
          respond_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string;
          service_id?: string;
          preferred_date?: string;
          status?: WaitlistStatus;
          offered_start_time?: string | null;
          offered_end_time?: string | null;
          offered_at?: string | null;
          respond_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
      offer_next_waitlist_candidate: {
        Args: { p_booking_id: string };
        Returns: {
          entry_id: string;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          service_name: string;
          offered_start_time: string;
          offered_end_time: string;
          respond_token: string;
        }[];
      };
      respond_to_waitlist_offer: {
        Args: { p_token: string; p_accept: boolean };
        Returns: {
          result: "accepted" | "rejected" | "expired" | "not_found";
          booking_id: string | null;
          business_name: string | null;
          service_name: string | null;
          start_time: string | null;
          end_time: string | null;
          customer_name: string | null;
          customer_email: string | null;
          next_entry_id: string | null;
          next_customer_name: string | null;
          next_customer_phone: string | null;
          next_customer_email: string | null;
          next_service_name: string | null;
          next_offered_start_time: string | null;
          next_offered_end_time: string | null;
          next_respond_token: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
