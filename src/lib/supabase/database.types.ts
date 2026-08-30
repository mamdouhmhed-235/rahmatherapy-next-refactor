// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: the live Supabase schema (project twzutkfgqclqurvkmvqz), generated 2026-08-29.
// Regenerate with:  pnpm db:typegen
//
// Why this exists: table and column names used to be unchecked strings, so a query could ask
// for a column that does not exist, fail with HTTP 400, and be silently swallowed. Four live
// bugs were found that way (DEFERRED.md section I). Wiring this into the Supabase client
// factories makes TypeScript reject a wrong column name at build time instead.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_password_requests: {
        Row: {
          created_at: string
          encrypted_payload: string | null
          expires_at: string
          id: string
          payload_cipher_version: number
          payload_nonce: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          staff_id: string
          status: Database["public"]["Enums"]["account_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_payload?: string | null
          expires_at: string
          id?: string
          payload_cipher_version?: number
          payload_nonce?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["account_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_payload?: string | null
          expires_at?: string
          id?: string
          payload_cipher_version?: number
          payload_nonce?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["account_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_password_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_password_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_staff_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action_type: string
          actor_staff_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action_type?: string
          actor_staff_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_overrides: {
        Row: {
          end_time: string
          id: string
          override_date: string
          reason: string | null
          start_time: string
        }
        Insert: {
          end_time: string
          id?: string
          override_date: string
          reason?: string | null
          start_time: string
        }
        Update: {
          end_time?: string
          id?: string
          override_date?: string
          reason?: string | null
          start_time?: string
        }
        Relationships: []
      }
      availability_rules: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_working_day: boolean
          start_time: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: string
          is_working_day?: boolean
          start_time: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_working_day?: boolean
          start_time?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          blocked_date: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      booking_assignments: {
        Row: {
          assigned_staff_id: string | null
          booking_id: string
          created_at: string
          id: string
          participant_id: string
          required_therapist_gender: Database["public"]["Enums"]["staff_gender_type"]
          status: Database["public"]["Enums"]["assignment_status_type"]
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          booking_id: string
          created_at?: string
          id?: string
          participant_id: string
          required_therapist_gender: Database["public"]["Enums"]["staff_gender_type"]
          status?: Database["public"]["Enums"]["assignment_status_type"]
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          participant_id?: string
          required_therapist_gender?: Database["public"]["Enums"]["staff_gender_type"]
          status?: Database["public"]["Enums"]["assignment_status_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_assignments_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_items: {
        Row: {
          booking_id: string
          booking_participant_id: string | null
          id: string
          service_duration_snapshot: number
          service_id: string
          service_name_snapshot: string
          service_price_snapshot: number
        }
        Insert: {
          booking_id: string
          booking_participant_id?: string | null
          id?: string
          service_duration_snapshot: number
          service_id: string
          service_name_snapshot: string
          service_price_snapshot: number
        }
        Update: {
          booking_id?: string
          booking_participant_id?: string | null
          id?: string
          service_duration_snapshot?: number
          service_id?: string
          service_name_snapshot?: string
          service_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_booking_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_participants: {
        Row: {
          booking_id: string
          consent_acknowledged: boolean
          display_name: string | null
          health_notes: string | null
          id: string
          is_main_contact: boolean
          participant_gender: Database["public"]["Enums"]["staff_gender_type"]
          participant_notes: string | null
          required_therapist_gender: Database["public"]["Enums"]["staff_gender_type"]
        }
        Insert: {
          booking_id: string
          consent_acknowledged?: boolean
          display_name?: string | null
          health_notes?: string | null
          id?: string
          is_main_contact?: boolean
          participant_gender: Database["public"]["Enums"]["staff_gender_type"]
          participant_notes?: string | null
          required_therapist_gender: Database["public"]["Enums"]["staff_gender_type"]
        }
        Update: {
          booking_id?: string
          consent_acknowledged?: boolean
          display_name?: string | null
          health_notes?: string | null
          id?: string
          is_main_contact?: boolean
          participant_gender?: Database["public"]["Enums"]["staff_gender_type"]
          participant_notes?: string | null
          required_therapist_gender?: Database["public"]["Enums"]["staff_gender_type"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_participants_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          access_notes: string | null
          admin_notes: string | null
          amount_due: number | null
          amount_paid: number
          assignment_status: Database["public"]["Enums"]["booking_assignment_status_type"]
          booking_date: string
          booking_source: string
          cancelled_at: string | null
          client_id: string
          completed_at: string | null
          consent_acknowledged: boolean
          contact_email: string | null
          contact_full_name: string
          contact_phone: string
          created_at: string
          customer_cancellation_note: string | null
          customer_cancelled_at: string | null
          customer_manage_notes: string | null
          customer_notes: string | null
          deleted_at: string | null
          end_time: string
          group_booking: boolean
          health_notes: string | null
          id: string
          last_customer_manage_action_at: string | null
          manage_token_expires_at: string | null
          manage_token_hash: string | null
          paid_at: string | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_note: string | null
          payment_status: Database["public"]["Enums"]["payment_status_type"]
          recurring_occurrence_date: string | null
          recurring_template_id: string | null
          reschedule_note: string | null
          reschedule_preferred_date: string | null
          reschedule_preferred_time: string | null
          reschedule_requested_at: string | null
          reschedule_status: string
          review_email_sent_at: string | null
          service_address_line1: string | null
          service_address_line2: string | null
          service_city: string | null
          service_postcode: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status_type"]
          total_duration_mins: number | null
          total_price: number | null
          travel_fee: number
          treatment_notes: string | null
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          admin_notes?: string | null
          amount_due?: number | null
          amount_paid?: number
          assignment_status?: Database["public"]["Enums"]["booking_assignment_status_type"]
          booking_date: string
          booking_source?: string
          cancelled_at?: string | null
          client_id: string
          completed_at?: string | null
          consent_acknowledged?: boolean
          contact_email?: string | null
          contact_full_name: string
          contact_phone: string
          created_at?: string
          customer_cancellation_note?: string | null
          customer_cancelled_at?: string | null
          customer_manage_notes?: string | null
          customer_notes?: string | null
          deleted_at?: string | null
          end_time: string
          group_booking?: boolean
          health_notes?: string | null
          id?: string
          last_customer_manage_action_at?: string | null
          manage_token_expires_at?: string | null
          manage_token_hash?: string | null
          paid_at?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_note?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_type"]
          recurring_occurrence_date?: string | null
          recurring_template_id?: string | null
          reschedule_note?: string | null
          reschedule_preferred_date?: string | null
          reschedule_preferred_time?: string | null
          reschedule_requested_at?: string | null
          reschedule_status?: string
          review_email_sent_at?: string | null
          service_address_line1?: string | null
          service_address_line2?: string | null
          service_city?: string | null
          service_postcode?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status_type"]
          total_duration_mins?: number | null
          total_price?: number | null
          travel_fee?: number
          treatment_notes?: string | null
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          admin_notes?: string | null
          amount_due?: number | null
          amount_paid?: number
          assignment_status?: Database["public"]["Enums"]["booking_assignment_status_type"]
          booking_date?: string
          booking_source?: string
          cancelled_at?: string | null
          client_id?: string
          completed_at?: string | null
          consent_acknowledged?: boolean
          contact_email?: string | null
          contact_full_name?: string
          contact_phone?: string
          created_at?: string
          customer_cancellation_note?: string | null
          customer_cancelled_at?: string | null
          customer_manage_notes?: string | null
          customer_notes?: string | null
          deleted_at?: string | null
          end_time?: string
          group_booking?: boolean
          health_notes?: string | null
          id?: string
          last_customer_manage_action_at?: string | null
          manage_token_expires_at?: string | null
          manage_token_hash?: string | null
          paid_at?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_note?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_type"]
          recurring_occurrence_date?: string | null
          recurring_template_id?: string | null
          reschedule_note?: string | null
          reschedule_preferred_date?: string | null
          reschedule_preferred_time?: string | null
          reschedule_requested_at?: string | null
          reschedule_status?: string
          review_email_sent_at?: string | null
          service_address_line1?: string | null
          service_address_line2?: string | null
          service_city?: string | null
          service_postcode?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status_type"]
          total_duration_mins?: number | null
          total_price?: number | null
          travel_fee?: number
          treatment_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_booking_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          booking_status_enabled: boolean
          booking_window_days: number
          buffer_time_mins: number
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          customer_cancellation_cutoff_hours: number
          free_travel_cities: Json
          id: number
          mileage_origin: string | null
          minimum_notice_hours: number
        }
        Insert: {
          booking_status_enabled?: boolean
          booking_window_days?: number
          buffer_time_mins?: number
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          customer_cancellation_cutoff_hours?: number
          free_travel_cities?: Json
          id: number
          mileage_origin?: string | null
          minimum_notice_hours?: number
        }
        Update: {
          booking_status_enabled?: boolean
          booking_window_days?: number
          buffer_time_mins?: number
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          customer_cancellation_cutoff_hours?: number
          free_travel_cities?: Json
          id?: number
          mileage_origin?: string | null
          minimum_notice_hours?: number
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          author_staff_id: string | null
          client_id: string
          created_at: string
          id: string
          is_sensitive: boolean
          note: string
        }
        Insert: {
          author_staff_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_sensitive?: boolean
          note: string
        }
        Update: {
          author_staff_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_sensitive?: boolean
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_author_staff_id_fkey"
            columns: ["author_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_privacy_requests: {
        Row: {
          client_id: string
          created_at: string
          created_by_staff_id: string | null
          id: string
          request_note: string | null
          request_type: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by_staff_id?: string | null
          id?: string
          request_note?: string | null
          request_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by_staff_id?: string | null
          id?: string
          request_note?: string | null
          request_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_privacy_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_privacy_requests_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          area: string | null
          city: string | null
          client_source: string
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          gender_preference: Database["public"]["Enums"]["gender_preference_type"]
          id: string
          notes: string | null
          phone: string | null
          postcode: string | null
          source_detail: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          city?: string | null
          client_source?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          gender_preference?: Database["public"]["Enums"]["gender_preference_type"]
          id?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          source_detail?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          area?: string | null
          city?: string | null
          client_source?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          gender_preference?: Database["public"]["Enums"]["gender_preference_type"]
          id?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          source_detail?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consent_events: {
        Row: {
          action: string
          banner_version: string
          choices: Json
          consent_id: string
          created_at: string
          id: string
          purposes_offered: Json
        }
        Insert: {
          action: string
          banner_version: string
          choices: Json
          consent_id: string
          created_at?: string
          id?: string
          purposes_offered: Json
        }
        Update: {
          action?: string
          banner_version?: string
          choices?: Json
          consent_id?: string
          created_at?: string
          id?: string
          purposes_offered?: Json
        }
        Relationships: []
      }
      email_delivery_events: {
        Row: {
          booking_id: string | null
          created_at: string
          delivery_status: string
          error_message: string | null
          event_type: string
          html_payload: string | null
          id: string
          metadata: Json | null
          provider_message_id: string | null
          recipient_email: string | null
          recipient_role: string | null
          scheduled_for: string | null
          staff_id: string | null
          subject: string | null
          text_payload: string | null
          to_email: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          delivery_status: string
          error_message?: string | null
          event_type: string
          html_payload?: string | null
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_role?: string | null
          scheduled_for?: string | null
          staff_id?: string | null
          subject?: string | null
          text_payload?: string | null
          to_email?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          event_type?: string
          html_payload?: string | null
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_role?: string | null
          scheduled_for?: string | null
          staff_id?: string | null
          subject?: string | null
          text_payload?: string | null
          to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_delivery_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_overrides: {
        Row: {
          field_key: string
          id: string
          template_id: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          field_key: string
          id?: string
          template_id: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          field_key?: string
          id?: string
          template_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_template_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiries: {
        Row: {
          assigned_staff_id: string | null
          client_id: string | null
          converted_booking_id: string | null
          created_at: string
          created_by_staff_id: string | null
          email: string | null
          first_contacted_at: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          service_interest: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          client_id?: string | null
          converted_booking_id?: string | null
          created_at?: string
          created_by_staff_id?: string | null
          email?: string | null
          first_contacted_at?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          service_interest?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          client_id?: string | null
          converted_booking_id?: string | null
          created_at?: string
          created_by_staff_id?: string | null
          email?: string | null
          first_contacted_at?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          service_interest?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_converted_booking_id_fkey"
            columns: ["converted_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_dismissals: {
        Row: {
          dismissed_at: string
          insight_id: string
          staff_id: string
        }
        Insert: {
          dismissed_at?: string
          insight_id: string
          staff_id: string
        }
        Update: {
          dismissed_at?: string
          insight_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_dismissals_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_state: {
        Row: {
          archived_at: string | null
          notification_id: string
          read_at: string | null
          snoozed_until: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          notification_id: string
          read_at?: string | null
          snoozed_until?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          notification_id?: string
          read_at?: string | null
          snoozed_until?: string | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_state_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_events: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_staff_id: string | null
          booking_id: string | null
          created_at: string
          event_type: string
          id: string
          resolved_at: string | null
          resolved_by_staff_id: string | null
          safe_context: Json
          severity: string
          staff_id: string | null
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_staff_id?: string | null
          booking_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          resolved_at?: string | null
          resolved_by_staff_id?: string | null
          safe_context?: Json
          severity?: string
          staff_id?: string | null
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_staff_id?: string | null
          booking_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          resolved_at?: string | null
          resolved_by_staff_id?: string | null
          safe_context?: Json
          severity?: string
          staff_id?: string | null
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_events_acknowledged_by_staff_id_fkey"
            columns: ["acknowledged_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_events_resolved_by_staff_id_fkey"
            columns: ["resolved_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          risk_level: string
          scope: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          risk_level?: string
          scope?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          risk_level?: string
          scope?: string
        }
        Relationships: []
      }
      recurring_booking_templates: {
        Row: {
          anchor_day_of_month: number | null
          anchor_day_of_week: number | null
          anchor_start_time: string
          bound_therapist_id: string | null
          cadence: string
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
          client_id: string
          created_at: string
          created_by: string
          end_count: number | null
          end_date: string | null
          end_type: string
          horizon_through_date: string
          id: string
          notes: string | null
          open_to_any_therapist: boolean
          participant_gender: Database["public"]["Enums"]["staff_gender_type"]
          required_therapist_gender: Database["public"]["Enums"]["staff_gender_type"]
          service_address_line1: string | null
          service_area: string | null
          service_city: string | null
          service_id: string
          service_postcode: string | null
          total_duration_mins: number
          travel_fee: number
        }
        Insert: {
          anchor_day_of_month?: number | null
          anchor_day_of_week?: number | null
          anchor_start_time: string
          bound_therapist_id?: string | null
          cadence: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          client_id: string
          created_at?: string
          created_by: string
          end_count?: number | null
          end_date?: string | null
          end_type: string
          horizon_through_date: string
          id?: string
          notes?: string | null
          open_to_any_therapist?: boolean
          participant_gender: Database["public"]["Enums"]["staff_gender_type"]
          required_therapist_gender: Database["public"]["Enums"]["staff_gender_type"]
          service_address_line1?: string | null
          service_area?: string | null
          service_city?: string | null
          service_id: string
          service_postcode?: string | null
          total_duration_mins: number
          travel_fee?: number
        }
        Update: {
          anchor_day_of_month?: number | null
          anchor_day_of_week?: number | null
          anchor_start_time?: string
          bound_therapist_id?: string | null
          cadence?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          end_count?: number | null
          end_date?: string | null
          end_type?: string
          horizon_through_date?: string
          id?: string
          notes?: string | null
          open_to_any_therapist?: boolean
          participant_gender?: Database["public"]["Enums"]["staff_gender_type"]
          required_therapist_gender?: Database["public"]["Enums"]["staff_gender_type"]
          service_address_line1?: string | null
          service_area?: string | null
          service_city?: string | null
          service_id?: string
          service_postcode?: string | null
          total_duration_mins?: number
          travel_fee?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_booking_templates_bound_therapist_id_fkey"
            columns: ["bound_therapist_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_booking_templates_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_booking_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_booking_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_booking_templates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_label: string | null
          id: string
          is_system: boolean
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_label?: string | null
          id?: string
          is_system?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_label?: string | null
          id?: string
          is_system?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          allow_recurrence: boolean
          created_at: string
          display_order: number
          duration_mins: number
          full_description: string | null
          gender_restrictions: Database["public"]["Enums"]["gender_restrictions_type"]
          group_category: string | null
          id: string
          is_active: boolean
          is_visible_on_frontend: boolean
          name: string
          price: number
          short_description: string | null
          slug: string
          suitable_for_notes: string | null
          updated_at: string
        }
        Insert: {
          allow_recurrence?: boolean
          created_at?: string
          display_order?: number
          duration_mins: number
          full_description?: string | null
          gender_restrictions?: Database["public"]["Enums"]["gender_restrictions_type"]
          group_category?: string | null
          id?: string
          is_active?: boolean
          is_visible_on_frontend?: boolean
          name: string
          price: number
          short_description?: string | null
          slug: string
          suitable_for_notes?: string | null
          updated_at?: string
        }
        Update: {
          allow_recurrence?: boolean
          created_at?: string
          display_order?: number
          duration_mins?: number
          full_description?: string | null
          gender_restrictions?: Database["public"]["Enums"]["gender_restrictions_type"]
          group_category?: string | null
          id?: string
          is_active?: boolean
          is_visible_on_frontend?: boolean
          name?: string
          price?: number
          short_description?: string | null
          slug?: string
          suitable_for_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_availability_overrides: {
        Row: {
          end_time: string
          id: string
          override_date: string
          override_type: string | null
          reason: string | null
          staff_id: string
          start_time: string
        }
        Insert: {
          end_time: string
          id?: string
          override_date: string
          override_type?: string | null
          reason?: string | null
          staff_id: string
          start_time: string
        }
        Update: {
          end_time?: string
          id?: string
          override_date?: string
          override_type?: string | null
          reason?: string | null
          staff_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_overrides_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_availability_rules: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_working_day: boolean
          staff_id: string
          start_time: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: string
          is_working_day?: boolean
          staff_id: string
          start_time: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_working_day?: boolean
          staff_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_rules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_blocked_dates: {
        Row: {
          blocked_date: string
          id: string
          reason: string | null
          staff_id: string
        }
        Insert: {
          blocked_date: string
          id?: string
          reason?: string | null
          staff_id: string
        }
        Update: {
          blocked_date?: string
          id?: string
          reason?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_blocked_dates_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permission_overrides: {
        Row: {
          is_granted: boolean
          permission_id: string
          staff_id: string
        }
        Insert: {
          is_granted: boolean
          permission_id: string
          staff_id: string
        }
        Update: {
          is_granted?: boolean
          permission_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permission_overrides_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          active: boolean
          auth_user_id: string | null
          availability_mode: Database["public"]["Enums"]["availability_mode_type"]
          business_notification_prefs: Json | null
          can_take_bookings: boolean
          created_at: string
          created_by: string | null
          email: string
          gender: Database["public"]["Enums"]["staff_gender_type"]
          id: string
          languages: string[]
          name: string
          notification_email: string | null
          phone: string | null
          profile_completed_at: string | null
          profile_photo_path: string | null
          role_id: string
          service_areas: string[]
          short_bio: string | null
          show_phone_on_profile: boolean
          specialties: string[]
          theme_preference: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          availability_mode?: Database["public"]["Enums"]["availability_mode_type"]
          business_notification_prefs?: Json | null
          can_take_bookings?: boolean
          created_at?: string
          created_by?: string | null
          email: string
          gender: Database["public"]["Enums"]["staff_gender_type"]
          id?: string
          languages?: string[]
          name: string
          notification_email?: string | null
          phone?: string | null
          profile_completed_at?: string | null
          profile_photo_path?: string | null
          role_id: string
          service_areas?: string[]
          short_bio?: string | null
          show_phone_on_profile?: boolean
          specialties?: string[]
          theme_preference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          availability_mode?: Database["public"]["Enums"]["availability_mode_type"]
          business_notification_prefs?: Json | null
          can_take_bookings?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          gender?: Database["public"]["Enums"]["staff_gender_type"]
          id?: string
          languages?: string[]
          name?: string
          notification_email?: string | null
          phone?: string | null
          profile_completed_at?: string | null
          profile_photo_path?: string | null
          role_id?: string
          service_areas?: string[]
          short_bio?: string | null
          show_phone_on_profile?: boolean
          specialties?: string[]
          theme_preference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_availability_day_segments: {
        Args: { p_day_of_week: number; p_segments: Json }
        Returns: undefined
      }
      compute_occurrence_dates: {
        Args: {
          p_cadence: string
          p_end_count: number
          p_end_date: string
          p_end_type: string
          p_first_date: string
          p_horizon_end: string
        }
        Returns: string[]
      }
      create_booking_request: {
        Args: {
          p_access_notes: string
          p_area?: string
          p_booking_date: string
          p_booking_source?: string
          p_client_id?: string
          p_confirm_duplicate?: boolean
          p_consent_acknowledged: boolean
          p_contact_email: string
          p_contact_full_name: string
          p_contact_phone: string
          p_customer_notes: string
          p_health_notes: string
          p_override_availability?: boolean
          p_participant_display_names?: string[]
          p_participant_genders: Database["public"]["Enums"]["staff_gender_type"][]
          p_participant_notes?: string[]
          p_participant_service_slugs?: string[]
          p_raise_on_duplicate?: boolean
          p_service_address_line1: string
          p_service_city: string
          p_service_postcode: string
          p_service_slugs: string[]
          p_start_time: string
        }
        Returns: Json
      }
      create_recurring_booking_series: {
        Args: {
          p_actor_staff_id: string
          p_anchor_start_time: string
          p_bound_therapist_id?: string
          p_cadence: string
          p_client_id: string
          p_consent_acknowledged?: boolean
          p_end_count?: number
          p_end_date?: string
          p_end_type: string
          p_first_occurrence_date: string
          p_horizon_weeks?: number
          p_notes?: string
          p_open_to_any_therapist?: boolean
          p_participant_gender: Database["public"]["Enums"]["staff_gender_type"]
          p_required_therapist_gender: Database["public"]["Enums"]["staff_gender_type"]
          p_service_address_line1?: string
          p_service_area?: string
          p_service_city?: string
          p_service_postcode?: string
          p_service_slug: string
          p_travel_fee?: number
        }
        Returns: Json
      }
      save_availability_day: {
        Args: { p_day_of_week: number; p_segments: Json }
        Returns: Json
      }
      save_staff_availability_day: {
        Args: { p_day_of_week: number; p_segments: Json; p_staff_id: string }
        Returns: Json
      }
    }
    Enums: {
      account_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "expired"
        | "used"
      assignment_status_type:
        | "unassigned"
        | "assigned"
        | "completed"
        | "cancelled"
        | "no_show"
      availability_mode_type: "use_global" | "custom" | "global_with_overrides"
      booking_assignment_status_type:
        | "unassigned"
        | "partially_assigned"
        | "fully_assigned"
      booking_status_type:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      gender_preference_type: "male" | "female" | "no_preference"
      gender_restrictions_type: "any" | "male_only" | "female_only"
      payment_method_type: "cash" | "card"
      payment_status_type: "paid" | "unpaid"
      staff_gender_type: "male" | "female"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_request_status: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "used",
      ],
      assignment_status_type: [
        "unassigned",
        "assigned",
        "completed",
        "cancelled",
        "no_show",
      ],
      availability_mode_type: ["use_global", "custom", "global_with_overrides"],
      booking_assignment_status_type: [
        "unassigned",
        "partially_assigned",
        "fully_assigned",
      ],
      booking_status_type: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      gender_preference_type: ["male", "female", "no_preference"],
      gender_restrictions_type: ["any", "male_only", "female_only"],
      payment_method_type: ["cash", "card"],
      payment_status_type: ["paid", "unpaid"],
      staff_gender_type: ["male", "female"],
    },
  },
} as const
