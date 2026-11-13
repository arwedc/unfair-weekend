// Automatisch erzeugt mit `pnpm db:types` aus dem Supabase-Dev-Projekt.
// NICHT von Hand ändern. Nach jeder Schemaänderung neu erzeugen und committen.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      companies: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          logo_path: string | null;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          logo_path?: string | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          logo_path?: string | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          category: Database['public']['Enums']['offer_category'];
          created_at: string;
          id: number;
          location_id: string;
          offer_id: string;
          seats: number | null;
          type: Database['public']['Enums']['event_type'];
          user_id: string | null;
          voucher_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          category: Database['public']['Enums']['offer_category'];
          created_at?: string;
          id?: never;
          location_id: string;
          offer_id: string;
          seats?: number | null;
          type: Database['public']['Enums']['event_type'];
          user_id?: string | null;
          voucher_id?: string | null;
        };
        Update: {
          category?: Database['public']['Enums']['offer_category'];
          created_at?: string;
          id?: never;
          location_id?: string;
          offer_id?: string;
          seats?: number | null;
          type?: Database['public']['Enums']['event_type'];
          user_id?: string | null;
          voucher_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_offer_id_fkey';
            columns: ['offer_id'];
            isOneToOne: false;
            referencedRelation: 'offers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_voucher_id_fkey';
            columns: ['voucher_id'];
            isOneToOne: false;
            referencedRelation: 'vouchers';
            referencedColumns: ['id'];
          },
        ];
      };
      favorite_categories: {
        Row: {
          category: Database['public']['Enums']['offer_category'];
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category: Database['public']['Enums']['offer_category'];
          created_at?: string;
          user_id: string;
        };
        Update: {
          category?: Database['public']['Enums']['offer_category'];
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorite_categories_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      favorite_locations: {
        Row: {
          created_at: string;
          location_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          location_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          location_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorite_locations_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorite_locations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      favorite_offers: {
        Row: {
          created_at: string;
          offer_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          offer_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          offer_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorite_offers_offer_id_fkey';
            columns: ['offer_id'];
            isOneToOne: false;
            referencedRelation: 'offers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorite_offers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      geocode_cache: {
        Row: {
          created_at: string;
          display_name: string | null;
          lat: number;
          lng: number;
          provider: string;
          query: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          lat: number;
          lng: number;
          provider?: string;
          query: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          lat?: number;
          lng?: number;
          provider?: string;
          query?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          account_user_id: string | null;
          city: string;
          company_id: string;
          created_at: string;
          id: string;
          lat: number | null;
          lng: number | null;
          name: string;
          phone: string | null;
          postal_code: string;
          status: Database['public']['Enums']['location_status'];
          status_changed_at: string | null;
          status_changed_by: string | null;
          status_reason: string | null;
          street: string;
          updated_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_user_id?: string | null;
          city: string;
          company_id: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          name: string;
          phone?: string | null;
          postal_code: string;
          status?: Database['public']['Enums']['location_status'];
          status_changed_at?: string | null;
          status_changed_by?: string | null;
          status_reason?: string | null;
          street: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          account_user_id?: string | null;
          city?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          name?: string;
          phone?: string | null;
          postal_code?: string;
          status?: Database['public']['Enums']['location_status'];
          status_changed_at?: string | null;
          status_changed_by?: string | null;
          status_reason?: string | null;
          street?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'locations_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          id: number;
          last_error: string | null;
          next_attempt_at: string;
          offer_id: string | null;
          payload: NonNullable<Json>;
          recipient_user_id: string;
          sent_at: string | null;
          status: Database['public']['Enums']['notification_status'];
          type: Database['public']['Enums']['notification_type'];
          voucher_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: never;
          last_error?: string | null;
          next_attempt_at?: string;
          offer_id?: string | null;
          payload?: NonNullable<Json>;
          recipient_user_id: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['notification_status'];
          type: Database['public']['Enums']['notification_type'];
          voucher_id?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: never;
          last_error?: string | null;
          next_attempt_at?: string;
          offer_id?: string | null;
          payload?: NonNullable<Json>;
          recipient_user_id?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['notification_status'];
          type?: Database['public']['Enums']['notification_type'];
          voucher_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_outbox_offer_id_fkey';
            columns: ['offer_id'];
            isOneToOne: false;
            referencedRelation: 'offers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_outbox_recipient_user_id_fkey';
            columns: ['recipient_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_outbox_voucher_id_fkey';
            columns: ['voucher_id'];
            isOneToOne: false;
            referencedRelation: 'vouchers';
            referencedColumns: ['id'];
          },
        ];
      };
      offer_templates: {
        Row: {
          capacity: number;
          category: Database['public']['Enums']['offer_category'];
          created_at: string;
          deal_price_cents: number;
          description: string;
          duration_minutes: number;
          id: string;
          image_paths: string[];
          location_id: string;
          max_per_user: number;
          name: string;
          original_price_cents: number;
          title: string;
          type: Database['public']['Enums']['offer_type'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          capacity: number;
          category: Database['public']['Enums']['offer_category'];
          created_at?: string;
          deal_price_cents: number;
          description: string;
          duration_minutes: number;
          id?: string;
          image_paths?: string[];
          location_id: string;
          max_per_user: number;
          name: string;
          original_price_cents: number;
          title: string;
          type: Database['public']['Enums']['offer_type'];
          updated_at?: string;
        };
        Update: {
          capacity?: number;
          category?: Database['public']['Enums']['offer_category'];
          created_at?: string;
          deal_price_cents?: number;
          description?: string;
          duration_minutes?: number;
          id?: string;
          image_paths?: string[];
          location_id?: string;
          max_per_user?: number;
          name?: string;
          original_price_cents?: number;
          title?: string;
          type?: Database['public']['Enums']['offer_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'offer_templates_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      offers: {
        Row: {
          address: string;
          capacity: number;
          category: Database['public']['Enums']['offer_category'];
          created_at: string;
          created_by: string | null;
          deal_price_cents: number;
          description: string;
          ends_at: string;
          id: string;
          image_paths: string[];
          lat: number;
          lng: number;
          location_id: string;
          max_per_user: number;
          original_price_cents: number;
          relevant_at: string | null;
          seats_taken: number;
          starts_at: string;
          status: Database['public']['Enums']['offer_status'];
          status_changed_at: string | null;
          status_changed_by: string | null;
          status_reason: string | null;
          title: string;
          type: Database['public']['Enums']['offer_type'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address: string;
          capacity: number;
          category: Database['public']['Enums']['offer_category'];
          created_at?: string;
          created_by?: string | null;
          deal_price_cents: number;
          description: string;
          ends_at: string;
          id?: string;
          image_paths?: string[];
          lat: number;
          lng: number;
          location_id: string;
          max_per_user?: number;
          original_price_cents: number;
          relevant_at?: never;
          seats_taken?: number;
          starts_at: string;
          status?: Database['public']['Enums']['offer_status'];
          status_changed_at?: string | null;
          status_changed_by?: string | null;
          status_reason?: string | null;
          title: string;
          type: Database['public']['Enums']['offer_type'];
          updated_at?: string;
        };
        Update: {
          address?: string;
          capacity?: number;
          category?: Database['public']['Enums']['offer_category'];
          created_at?: string;
          created_by?: string | null;
          deal_price_cents?: number;
          description?: string;
          ends_at?: string;
          id?: string;
          image_paths?: string[];
          lat?: number;
          lng?: number;
          location_id?: string;
          max_per_user?: number;
          original_price_cents?: number;
          relevant_at?: never;
          seats_taken?: number;
          starts_at?: string;
          status?: Database['public']['Enums']['offer_status'];
          status_changed_at?: string | null;
          status_changed_by?: string | null;
          status_reason?: string | null;
          title?: string;
          type?: Database['public']['Enums']['offer_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'offers_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      paid_bookings: {
        Row: {
          amount_cents: number;
          cancel_reason: Database['public']['Enums']['booking_cancel_reason'] | null;
          cancelled_at: string | null;
          charge_id: string | null;
          commission_bps: number;
          commission_cents: number;
          created_at: string;
          currency: string;
          expired_at: string | null;
          id: string;
          location_id: string;
          offer_id: string;
          paid_at: string | null;
          paid_out_at: string | null;
          payment_intent_id: string | null;
          payout_cents: number | null;
          payout_due_at: string | null;
          refunded_at: string | null;
          reserved_until: string;
          seats: number;
          status: Database['public']['Enums']['booking_status'];
          unit_price_cents: number;
          updated_at: string;
          user_id: string | null;
          voucher_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          cancel_reason?: Database['public']['Enums']['booking_cancel_reason'] | null;
          cancelled_at?: string | null;
          charge_id?: string | null;
          commission_bps: number;
          commission_cents: number;
          created_at?: string;
          currency?: string;
          expired_at?: string | null;
          id?: string;
          location_id: string;
          offer_id: string;
          paid_at?: string | null;
          paid_out_at?: string | null;
          payment_intent_id?: string | null;
          payout_cents?: never;
          payout_due_at?: string | null;
          refunded_at?: string | null;
          reserved_until: string;
          seats: number;
          status?: Database['public']['Enums']['booking_status'];
          unit_price_cents: number;
          updated_at?: string;
          user_id?: string | null;
          voucher_id?: string | null;
        };
        Update: {
          amount_cents?: number;
          cancel_reason?: Database['public']['Enums']['booking_cancel_reason'] | null;
          cancelled_at?: string | null;
          charge_id?: string | null;
          commission_bps?: number;
          commission_cents?: number;
          created_at?: string;
          currency?: string;
          expired_at?: string | null;
          id?: string;
          location_id?: string;
          offer_id?: string;
          paid_at?: string | null;
          paid_out_at?: string | null;
          payment_intent_id?: string | null;
          payout_cents?: never;
          payout_due_at?: string | null;
          refunded_at?: string | null;
          reserved_until?: string;
          seats?: number;
          status?: Database['public']['Enums']['booking_status'];
          unit_price_cents?: number;
          updated_at?: string;
          user_id?: string | null;
          voucher_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'paid_bookings_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paid_bookings_offer_id_fkey';
            columns: ['offer_id'];
            isOneToOne: false;
            referencedRelation: 'offers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paid_bookings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paid_bookings_voucher_id_fkey';
            columns: ['voucher_id'];
            isOneToOne: true;
            referencedRelation: 'vouchers';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_disputes: {
        Row: {
          amount_cents: number;
          booking_id: string | null;
          charge_id: string | null;
          closed_at: string | null;
          created_at: string;
          evidence_due_by: string | null;
          id: string;
          reason: string | null;
          stripe_dispute_id: string;
          stripe_status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          booking_id?: string | null;
          charge_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          evidence_due_by?: string | null;
          id?: string;
          reason?: string | null;
          stripe_dispute_id: string;
          stripe_status: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          booking_id?: string | null;
          charge_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          evidence_due_by?: string | null;
          id?: string;
          reason?: string | null;
          stripe_dispute_id?: string;
          stripe_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_disputes_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'paid_bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_jobs: {
        Row: {
          attempts: number;
          booking_id: string;
          created_at: string;
          finished_at: string | null;
          id: number;
          kind: Database['public']['Enums']['payment_job_kind'];
          last_error: string | null;
          next_attempt_at: string;
          status: Database['public']['Enums']['payment_job_status'];
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          booking_id: string;
          created_at?: string;
          finished_at?: string | null;
          id?: never;
          kind: Database['public']['Enums']['payment_job_kind'];
          last_error?: string | null;
          next_attempt_at?: string;
          status?: Database['public']['Enums']['payment_job_status'];
        };
        Update: {
          attempts?: number;
          booking_id?: string;
          created_at?: string;
          finished_at?: string | null;
          id?: never;
          kind?: Database['public']['Enums']['payment_job_kind'];
          last_error?: string | null;
          next_attempt_at?: string;
          status?: Database['public']['Enums']['payment_job_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'payment_jobs_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'paid_bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_refunds: {
        Row: {
          amount_cents: number;
          booking_id: string;
          created_at: string;
          id: string;
          last_error: string | null;
          reason: Database['public']['Enums']['booking_cancel_reason'];
          refunded_at: string | null;
          status: Database['public']['Enums']['refund_status'];
          stripe_refund_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          booking_id: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          reason: Database['public']['Enums']['booking_cancel_reason'];
          refunded_at?: string | null;
          status?: Database['public']['Enums']['refund_status'];
          stripe_refund_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          booking_id?: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          reason?: Database['public']['Enums']['booking_cancel_reason'];
          refunded_at?: string | null;
          status?: Database['public']['Enums']['refund_status'];
          stripe_refund_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_refunds_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: true;
            referencedRelation: 'paid_bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_settings: {
        Row: {
          commission_bps: number;
          id: boolean;
          payments_enabled: boolean;
          payout_delay_hours: number;
          reservation_minutes: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          commission_bps?: number;
          id?: boolean;
          payments_enabled?: boolean;
          payout_delay_hours?: number;
          reservation_minutes?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          commission_bps?: number;
          id?: boolean;
          payments_enabled?: boolean;
          payout_delay_hours?: number;
          reservation_minutes?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_transfers: {
        Row: {
          amount_cents: number;
          booking_id: string;
          created_at: string;
          destination_account_id: string;
          id: string;
          last_error: string | null;
          location_id: string;
          reversed_at: string | null;
          source_charge_id: string;
          status: Database['public']['Enums']['transfer_status'];
          stripe_reversal_id: string | null;
          stripe_transfer_id: string;
          transferred_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          booking_id: string;
          created_at?: string;
          destination_account_id: string;
          id?: string;
          last_error?: string | null;
          location_id: string;
          reversed_at?: string | null;
          source_charge_id: string;
          status?: Database['public']['Enums']['transfer_status'];
          stripe_reversal_id?: string | null;
          stripe_transfer_id: string;
          transferred_at?: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          booking_id?: string;
          created_at?: string;
          destination_account_id?: string;
          id?: string;
          last_error?: string | null;
          location_id?: string;
          reversed_at?: string | null;
          source_charge_id?: string;
          status?: Database['public']['Enums']['transfer_status'];
          stripe_reversal_id?: string | null;
          stripe_transfer_id?: string;
          transferred_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_transfers_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: true;
            referencedRelation: 'paid_bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_transfers_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          blocked_until: string | null;
          created_at: string;
          first_name: string | null;
          id: string;
          last_name: string | null;
          no_show_count: number;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_until?: string | null;
          created_at?: string;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          no_show_count?: number;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Update: {
          blocked_until?: string | null;
          created_at?: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          no_show_count?: number;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          created_at: string;
          id: number;
          last_seen_at: string;
          platform: Database['public']['Enums']['push_platform'];
          token: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: never;
          last_seen_at?: string;
          platform: Database['public']['Enums']['push_platform'];
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          last_seen_at?: string;
          platform?: Database['public']['Enums']['push_platform'];
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          id: string;
          location_id: string;
          rating: number;
          updated_at: string;
          user_id: string;
          voucher_id: string;
        };
        ComputedFields: never;
        Insert: {
          comment?: string | null;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: string;
          location_id: string;
          rating: number;
          updated_at?: string;
          user_id: string;
          voucher_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: string;
          location_id?: string;
          rating?: number;
          updated_at?: string;
          user_id?: string;
          voucher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_voucher_id_fkey';
            columns: ['voucher_id'];
            isOneToOne: true;
            referencedRelation: 'vouchers';
            referencedColumns: ['id'];
          },
        ];
      };
      settings: {
        Row: {
          block_days: number;
          cancel_deadline_hours: number;
          id: boolean;
          min_discount_percent: number;
          no_show_limit: number;
          reminder_hours_before: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          block_days?: number;
          cancel_deadline_hours?: number;
          id?: boolean;
          min_discount_percent?: number;
          no_show_limit?: number;
          reminder_hours_before?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          block_days?: number;
          cancel_deadline_hours?: number;
          id?: boolean;
          min_discount_percent?: number;
          no_show_limit?: number;
          reminder_hours_before?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      stripe_accounts: {
        Row: {
          charges_enabled: boolean;
          created_at: string;
          details_submitted: boolean;
          disabled_reason: string | null;
          is_ready: boolean | null;
          location_id: string;
          payouts_enabled: boolean;
          requirements_due: string[];
          stripe_account_id: string;
          synced_at: string | null;
          transfers_active: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          charges_enabled?: boolean;
          created_at?: string;
          details_submitted?: boolean;
          disabled_reason?: string | null;
          is_ready?: never;
          location_id: string;
          payouts_enabled?: boolean;
          requirements_due?: string[];
          stripe_account_id: string;
          synced_at?: string | null;
          transfers_active?: boolean;
          updated_at?: string;
        };
        Update: {
          charges_enabled?: boolean;
          created_at?: string;
          details_submitted?: boolean;
          disabled_reason?: string | null;
          is_ready?: never;
          location_id?: string;
          payouts_enabled?: boolean;
          requirements_due?: string[];
          stripe_account_id?: string;
          synced_at?: string | null;
          transfers_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stripe_accounts_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: true;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      stripe_webhook_events: {
        Row: {
          attempts: number;
          event_id: string;
          last_error: string | null;
          livemode: boolean;
          processed_at: string | null;
          received_at: string;
          stripe_created_at: string | null;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          event_id: string;
          last_error?: string | null;
          livemode?: boolean;
          processed_at?: string | null;
          received_at?: string;
          stripe_created_at?: string | null;
          type: string;
        };
        Update: {
          attempts?: number;
          event_id?: string;
          last_error?: string | null;
          livemode?: boolean;
          processed_at?: string | null;
          received_at?: string;
          stripe_created_at?: string | null;
          type?: string;
        };
        Relationships: [];
      };
      vouchers: {
        Row: {
          cancel_reason: Database['public']['Enums']['voucher_cancel_reason'] | null;
          cancelled_at: string | null;
          claimed_at: string;
          expired_at: string | null;
          id: string;
          no_show_at: string | null;
          no_show_by: string | null;
          offer_id: string;
          redeemed_at: string | null;
          redeemed_by: string | null;
          seats: number;
          short_code: string;
          status: Database['public']['Enums']['voucher_status'];
          token: string;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          cancel_reason?: Database['public']['Enums']['voucher_cancel_reason'] | null;
          cancelled_at?: string | null;
          claimed_at?: string;
          expired_at?: string | null;
          id?: string;
          no_show_at?: string | null;
          no_show_by?: string | null;
          offer_id: string;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
          seats: number;
          short_code: string;
          status?: Database['public']['Enums']['voucher_status'];
          token: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          cancel_reason?: Database['public']['Enums']['voucher_cancel_reason'] | null;
          cancelled_at?: string | null;
          claimed_at?: string;
          expired_at?: string | null;
          id?: string;
          no_show_at?: string | null;
          no_show_by?: string | null;
          offer_id?: string;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
          seats?: number;
          short_code?: string;
          status?: Database['public']['Enums']['voucher_status'];
          token?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vouchers_offer_id_fkey';
            columns: ['offer_id'];
            isOneToOne: false;
            referencedRelation: 'offers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vouchers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_location: {
        Args: { p_location_id: string; p_merge_into_company_id?: string };
        Returns: {
          account_user_id: string | null;
          city: string;
          company_id: string;
          created_at: string;
          id: string;
          lat: number | null;
          lng: number | null;
          name: string;
          phone: string | null;
          postal_code: string;
          status: Database['public']['Enums']['location_status'];
          status_changed_at: string | null;
          status_changed_by: string | null;
          status_reason: string | null;
          street: string;
          updated_at: string;
          website: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'locations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      attach_payment_intent: {
        Args: { p_booking_id: string; p_payment_intent_id: string };
        Returns: {
          amount_cents: number;
          cancel_reason: Database['public']['Enums']['booking_cancel_reason'] | null;
          cancelled_at: string | null;
          charge_id: string | null;
          commission_bps: number;
          commission_cents: number;
          created_at: string;
          currency: string;
          expired_at: string | null;
          id: string;
          location_id: string;
          offer_id: string;
          paid_at: string | null;
          paid_out_at: string | null;
          payment_intent_id: string | null;
          payout_cents: number | null;
          payout_due_at: string | null;
          refunded_at: string | null;
          reserved_until: string;
          seats: number;
          status: Database['public']['Enums']['booking_status'];
          unit_price_cents: number;
          updated_at: string;
          user_id: string | null;
          voucher_id: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'paid_bookings';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_offer: { Args: { p_offer_id: string; p_reason?: string }; Returns: Json };
      cancel_paid_booking: {
        Args: { p_booking_id: string };
        Returns: {
          id: string;
          refund_amount_cents: number;
          status: Database['public']['Enums']['booking_status'];
        }[];
      };
      cancel_voucher: {
        Args: { p_voucher_id: string };
        Returns: {
          cancelled_at: string;
          id: string;
          offer_id: string;
          seats: number;
          status: Database['public']['Enums']['voucher_status'];
        }[];
      };
      claim_payment_jobs: {
        Args: { p_booking_id?: string; p_limit?: number };
        Returns: {
          attempts: number;
          booking_id: string;
          charge_id: string;
          destination_account_id: string;
          job_id: number;
          kind: Database['public']['Enums']['payment_job_kind'];
          payment_intent_id: string;
          payout_cents: number;
          refund_amount_cents: number;
          stripe_transfer_id: string;
        }[];
      };
      claim_push_batch: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          notification_type: Database['public']['Enums']['notification_type'];
          offer_id: string;
          outbox_id: number;
          payload: Json;
          recipient_id: string;
          tokens: string[];
          voucher_id: string;
        }[];
      };
      claim_voucher: {
        Args: { p_offer_id: string; p_seats?: number };
        Returns: {
          claimed_at: string;
          id: string;
          offer_id: string;
          seats: number;
          short_code: string;
          status: Database['public']['Enums']['voucher_status'];
          token: string;
        }[];
      };
      confirm_paid_booking: {
        Args: {
          p_amount_received: number;
          p_booking_id: string;
          p_charge_id: string;
          p_currency: string;
          p_payment_intent_id: string;
        };
        Returns: {
          booking_id: string;
          outcome: string;
          status: Database['public']['Enums']['booking_status'];
          voucher_id: string;
        }[];
      };
      create_offer: {
        Args: {
          p_address: string;
          p_capacity: number;
          p_category: Database['public']['Enums']['offer_category'];
          p_deal_price_cents: number;
          p_description: string;
          p_ends_at: string;
          p_image_paths: string[];
          p_lat: number;
          p_lng: number;
          p_max_per_user: number;
          p_original_price_cents: number;
          p_starts_at: string;
          p_title: string;
          p_type: Database['public']['Enums']['offer_type'];
        };
        Returns: {
          address: string;
          capacity: number;
          category: Database['public']['Enums']['offer_category'];
          created_at: string;
          created_by: string | null;
          deal_price_cents: number;
          description: string;
          ends_at: string;
          id: string;
          image_paths: string[];
          lat: number;
          lng: number;
          location_id: string;
          max_per_user: number;
          original_price_cents: number;
          relevant_at: string | null;
          seats_taken: number;
          starts_at: string;
          status: Database['public']['Enums']['offer_status'];
          status_changed_at: string | null;
          status_changed_by: string | null;
          status_reason: string | null;
          title: string;
          type: Database['public']['Enums']['offer_type'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'offers';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_offer_template: {
        Args: {
          p_capacity: number;
          p_category: Database['public']['Enums']['offer_category'];
          p_deal_price_cents: number;
          p_description: string;
          p_duration_minutes: number;
          p_image_paths: string[];
          p_max_per_user: number;
          p_name: string;
          p_original_price_cents: number;
          p_title: string;
          p_type: Database['public']['Enums']['offer_type'];
        };
        Returns: {
          capacity: number;
          category: Database['public']['Enums']['offer_category'];
          created_at: string;
          deal_price_cents: number;
          description: string;
          duration_minutes: number;
          id: string;
          image_paths: string[];
          location_id: string;
          max_per_user: number;
          name: string;
          original_price_cents: number;
          title: string;
          type: Database['public']['Enums']['offer_type'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'offer_templates';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_review: {
        Args: { p_comment?: string; p_rating: number; p_voucher_id: string };
        Returns: {
          comment: string;
          created_at: string;
          id: string;
          location_id: string;
          rating: number;
          voucher_id: string;
        }[];
      };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      delete_offer_template: { Args: { p_template_id: string }; Returns: undefined };
      finish_payment_job: {
        Args: {
          p_error?: string;
          p_job_id: number;
          p_ok: boolean;
          p_permanent?: boolean;
          p_stripe_id?: string;
          p_stripe_status?: string;
        };
        Returns: undefined;
      };
      finish_push_batch: {
        Args: { p_failed?: Json; p_invalid_tokens?: string[]; p_sent_ids?: number[] };
        Returns: Json;
      };
      finish_webhook_event: { Args: { p_error?: string; p_event_id: string }; Returns: undefined };
      get_admin_metrics: { Args: { p_from?: string; p_to?: string }; Returns: Json };
      get_admin_payment_metrics: { Args: { p_from?: string; p_to?: string }; Returns: Json };
      get_location_bookings: {
        Args: { p_limit?: number; p_location_id?: string; p_offset?: number };
        Returns: {
          amount_cents: number;
          booking_id: string;
          cancel_reason: Database['public']['Enums']['booking_cancel_reason'];
          commission_cents: number;
          ends_at: string;
          first_name: string;
          last_initial: string;
          location_id: string;
          location_name: string;
          offer_id: string;
          offer_title: string;
          offer_type: Database['public']['Enums']['offer_type'];
          paid_at: string;
          payout_cents: number;
          payout_due_at: string;
          refund_status: Database['public']['Enums']['refund_status'];
          refunded_at: string;
          seats: number;
          short_code: string;
          starts_at: string;
          status: Database['public']['Enums']['booking_status'];
          transfer_status: Database['public']['Enums']['transfer_status'];
          transferred_at: string;
        }[];
      };
      get_location_ratings: {
        Args: { p_location_ids: string[] };
        Returns: {
          average_rating: number;
          location_id: string;
          review_count: number;
        }[];
      };
      get_locations_public: {
        Args: { p_location_ids: string[] };
        Returns: {
          city: string;
          company_description: string;
          company_id: string;
          company_logo_path: string;
          company_name: string;
          id: string;
          lat: number;
          lng: number;
          name: string;
          phone: string;
          postal_code: string;
          street: string;
          website: string;
        }[];
      };
      get_my_account: { Args: Record<PropertyKey, never>; Returns: Json };
      get_my_vouchers: {
        Args: Record<PropertyKey, never>;
        Returns: {
          address: string;
          can_cancel: boolean;
          cancel_deadline: string;
          cancel_reason: Database['public']['Enums']['voucher_cancel_reason'];
          cancelled_at: string;
          claimed_at: string;
          company_name: string;
          cover_image_path: string;
          ends_at: string;
          id: string;
          lat: number;
          lng: number;
          location_id: string;
          location_name: string;
          offer_id: string;
          offer_status: Database['public']['Enums']['offer_status'];
          offer_title: string;
          offer_type: Database['public']['Enums']['offer_type'];
          redeemed_at: string;
          seats: number;
          short_code: string;
          starts_at: string;
          status: Database['public']['Enums']['voucher_status'];
          token: string;
        }[];
      };
      get_offer: {
        Args: { p_offer_id: string };
        Returns: {
          address: string;
          capacity: number;
          category: Database['public']['Enums']['offer_category'];
          company_description: string;
          company_id: string;
          company_logo_path: string;
          company_name: string;
          cover_image_path: string;
          deal_price_cents: number;
          description: string;
          discount_percent: number;
          ends_at: string;
          free_seats: number;
          id: string;
          image_paths: string[];
          is_claimable: boolean;
          lat: number;
          lng: number;
          location_city: string;
          location_id: string;
          location_name: string;
          location_phone: string;
          location_postal_code: string;
          location_street: string;
          location_website: string;
          max_per_user: number;
          original_price_cents: number;
          relevant_at: string;
          starts_at: string;
          status: Database['public']['Enums']['offer_status'];
          status_reason: string;
          title: string;
          type: Database['public']['Enums']['offer_type'];
        }[];
      };
      get_offer_participants: {
        Args: { p_offer_id: string };
        Returns: {
          claimed_at: string;
          first_name: string;
          last_initial: string;
          no_show_at: string;
          redeemed_at: string;
          seats: number;
          short_code: string;
          status: Database['public']['Enums']['voucher_status'];
          voucher_id: string;
        }[];
      };
      get_offer_participants_paid: {
        Args: { p_offer_id: string };
        Returns: {
          amount_cents: number;
          booking_id: string;
          booking_status: Database['public']['Enums']['booking_status'];
          claimed_at: string;
          first_name: string;
          is_paid: boolean;
          last_initial: string;
          no_show_at: string;
          redeemed_at: string;
          seats: number;
          short_code: string;
          status: Database['public']['Enums']['voucher_status'];
          voucher_id: string;
        }[];
      };
      get_payment_settings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          commission_bps: number;
          payments_enabled: boolean;
          payout_delay_hours: number;
          reservation_minutes: number;
        }[];
      };
      get_pending_location_contacts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          contact_email: string;
          location_id: string;
        }[];
      };
      get_settings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          block_days: number;
          cancel_deadline_hours: number;
          id: boolean;
          min_discount_percent: number;
          no_show_limit: number;
          reminder_hours_before: number;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'settings';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      list_location_reviews: {
        Args: { p_limit?: number; p_location_id: string; p_offset?: number };
        Returns: {
          author_name: string;
          comment: string;
          created_at: string;
          id: string;
          offer_title: string;
          rating: number;
        }[];
      };
      list_offer_created_at: {
        Args: { p_offer_ids: string[] };
        Returns: {
          created_at: string;
          id: string;
        }[];
      };
      list_offers: {
        Args: {
          p_category?: Database['public']['Enums']['offer_category'];
          p_limit?: number;
          p_location_ids?: string[];
          p_offset?: number;
          p_only_available?: boolean;
        };
        Returns: {
          address: string;
          capacity: number;
          category: Database['public']['Enums']['offer_category'];
          company_id: string;
          company_logo_path: string;
          company_name: string;
          cover_image_path: string;
          deal_price_cents: number;
          discount_percent: number;
          ends_at: string;
          free_seats: number;
          id: string;
          image_paths: string[];
          lat: number;
          lng: number;
          location_id: string;
          location_name: string;
          max_per_user: number;
          original_price_cents: number;
          relevant_at: string;
          starts_at: string;
          title: string;
          type: Database['public']['Enums']['offer_type'];
        }[];
      };
      log_offer_view: { Args: { p_offer_id: string }; Returns: undefined };
      mark_no_show: {
        Args: { p_voucher_id: string };
        Returns: {
          blocked_until: string;
          id: string;
          no_show_at: string;
          status: Database['public']['Enums']['voucher_status'];
          user_blocked: boolean;
        }[];
      };
      mark_paid_no_show: {
        Args: { p_voucher_id: string };
        Returns: {
          id: string;
          no_show_at: string;
          status: Database['public']['Enums']['voucher_status'];
        }[];
      };
      record_dispute: {
        Args: {
          p_amount_cents: number;
          p_charge_id: string;
          p_closed: boolean;
          p_evidence_due_by: string;
          p_payment_intent_id: string;
          p_reason: string;
          p_stripe_dispute_id: string;
          p_stripe_status: string;
        };
        Returns: {
          amount_cents: number;
          booking_id: string | null;
          charge_id: string | null;
          closed_at: string | null;
          created_at: string;
          evidence_due_by: string | null;
          id: string;
          reason: string | null;
          stripe_dispute_id: string;
          stripe_status: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'payment_disputes';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_webhook_event: {
        Args: { p_created: string; p_event_id: string; p_livemode: boolean; p_type: string };
        Returns: boolean;
      };
      redeem_voucher: {
        Args: { p_code: string };
        Returns: {
          first_name: string;
          id: string;
          last_initial: string;
          offer_id: string;
          offer_title: string;
          redeemed_at: string;
          seats: number;
          short_code: string;
          status: Database['public']['Enums']['voucher_status'];
        }[];
      };
      register_company: {
        Args: {
          p_city: string;
          p_company_description?: string;
          p_company_name: string;
          p_lat?: number;
          p_lng?: number;
          p_location_name: string;
          p_phone?: string;
          p_postal_code: string;
          p_street: string;
          p_website?: string;
        };
        Returns: Json;
      };
      register_push_token: {
        Args: { p_platform: Database['public']['Enums']['push_platform']; p_token: string };
        Returns: undefined;
      };
      register_stripe_account: {
        Args: { p_location_id: string; p_stripe_account_id: string };
        Returns: {
          charges_enabled: boolean;
          created_at: string;
          details_submitted: boolean;
          disabled_reason: string | null;
          is_ready: boolean | null;
          location_id: string;
          payouts_enabled: boolean;
          requirements_due: string[];
          stripe_account_id: string;
          synced_at: string | null;
          transfers_active: boolean;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'stripe_accounts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reject_location: { Args: { p_location_id: string; p_reason?: string }; Returns: Json };
      remove_offer: { Args: { p_offer_id: string; p_reason?: string }; Returns: Json };
      set_review_hidden: {
        Args: { p_hidden: boolean; p_reason?: string; p_review_id: string };
        Returns: {
          hidden_at: string;
          hidden_reason: string;
          id: string;
        }[];
      };
      start_paid_booking: {
        Args: { p_offer_id: string; p_seats?: number };
        Returns: {
          amount_cents: number;
          commission_cents: number;
          currency: string;
          id: string;
          offer_id: string;
          reserved_until: string;
          seats: number;
          server_now: string;
          status: Database['public']['Enums']['booking_status'];
        }[];
      };
      sync_stripe_account: {
        Args: {
          p_charges_enabled: boolean;
          p_details_submitted: boolean;
          p_disabled_reason: string;
          p_payouts_enabled: boolean;
          p_requirements_due: string[];
          p_stripe_account_id: string;
          p_transfers_active: boolean;
        };
        Returns: {
          charges_enabled: boolean;
          created_at: string;
          details_submitted: boolean;
          disabled_reason: string | null;
          is_ready: boolean | null;
          location_id: string;
          payouts_enabled: boolean;
          requirements_due: string[];
          stripe_account_id: string;
          synced_at: string | null;
          transfers_active: boolean;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'stripe_accounts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      unregister_push_token: { Args: { p_token: string }; Returns: undefined };
      update_my_company: {
        Args: { p_description?: string; p_logo_path?: string; p_name: string };
        Returns: {
          created_at: string;
          description: string | null;
          id: string;
          logo_path: string | null;
          name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'companies';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_my_location: {
        Args: {
          p_city: string;
          p_lat?: number;
          p_lng?: number;
          p_name: string;
          p_phone?: string;
          p_postal_code: string;
          p_street: string;
          p_website?: string;
        };
        Returns: {
          account_user_id: string | null;
          city: string;
          company_id: string;
          created_at: string;
          id: string;
          lat: number | null;
          lng: number | null;
          name: string;
          phone: string | null;
          postal_code: string;
          status: Database['public']['Enums']['location_status'];
          status_changed_at: string | null;
          status_changed_by: string | null;
          status_reason: string | null;
          street: string;
          updated_at: string;
          website: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'locations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_my_profile: {
        Args: { p_first_name: string; p_last_name: string };
        Returns: {
          blocked_until: string | null;
          created_at: string;
          first_name: string | null;
          id: string;
          last_name: string | null;
          no_show_count: number;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_offer: {
        Args: {
          p_address: string;
          p_capacity: number;
          p_category: Database['public']['Enums']['offer_category'];
          p_deal_price_cents: number;
          p_description: string;
          p_ends_at: string;
          p_image_paths: string[];
          p_lat: number;
          p_lng: number;
          p_max_per_user: number;
          p_offer_id: string;
          p_original_price_cents: number;
          p_starts_at: string;
          p_title: string;
          p_type: Database['public']['Enums']['offer_type'];
        };
        Returns: {
          address: string;
          capacity: number;
          category: Database['public']['Enums']['offer_category'];
          created_at: string;
          created_by: string | null;
          deal_price_cents: number;
          description: string;
          ends_at: string;
          id: string;
          image_paths: string[];
          lat: number;
          lng: number;
          location_id: string;
          max_per_user: number;
          original_price_cents: number;
          relevant_at: string | null;
          seats_taken: number;
          starts_at: string;
          status: Database['public']['Enums']['offer_status'];
          status_changed_at: string | null;
          status_changed_by: string | null;
          status_reason: string | null;
          title: string;
          type: Database['public']['Enums']['offer_type'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'offers';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_offer_template: {
        Args: {
          p_capacity: number;
          p_category: Database['public']['Enums']['offer_category'];
          p_deal_price_cents: number;
          p_description: string;
          p_duration_minutes: number;
          p_image_paths: string[];
          p_max_per_user: number;
          p_name: string;
          p_original_price_cents: number;
          p_template_id: string;
          p_title: string;
          p_type: Database['public']['Enums']['offer_type'];
        };
        Returns: {
          capacity: number;
          category: Database['public']['Enums']['offer_category'];
          created_at: string;
          deal_price_cents: number;
          description: string;
          duration_minutes: number;
          id: string;
          image_paths: string[];
          location_id: string;
          max_per_user: number;
          name: string;
          original_price_cents: number;
          title: string;
          type: Database['public']['Enums']['offer_type'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'offer_templates';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_payment_settings: {
        Args: { p_commission_bps: number; p_payments_enabled: boolean };
        Returns: {
          commission_bps: number;
          payments_enabled: boolean;
          payout_delay_hours: number;
          reservation_minutes: number;
        }[];
      };
      update_refund_status: {
        Args: { p_error?: string; p_stripe_refund_id: string; p_stripe_status: string };
        Returns: undefined;
      };
      update_settings: {
        Args: {
          p_block_days: number;
          p_cancel_deadline_hours: number;
          p_min_discount_percent: number;
          p_no_show_limit: number;
          p_reminder_hours_before: number;
        };
        Returns: {
          block_days: number;
          cancel_deadline_hours: number;
          id: boolean;
          min_discount_percent: number;
          no_show_limit: number;
          reminder_hours_before: number;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'settings';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_role: 'nutzer' | 'standort' | 'admin';
      booking_cancel_reason:
        'nutzer' | 'angebot_abgesagt' | 'angebot_entfernt' | 'konto_geloescht' | 'zahlung_zu_spaet';
      booking_status:
        | 'reserviert'
        | 'abgelaufen'
        | 'bezahlt'
        | 'storniert'
        | 'erstattet'
        | 'eingeloest'
        | 'no_show'
        | 'ausgezahlt';
      event_type:
        'angebot_angesehen' | 'code_geholt' | 'code_storniert' | 'code_eingeloest' | 'no_show';
      location_status: 'pending' | 'approved' | 'rejected';
      notification_status: 'pending' | 'processing' | 'sent' | 'failed';
      notification_type: 'angebot_abgesagt' | 'erinnerung' | 'neues_angebot';
      offer_category:
        | 'kochen_essen'
        | 'sport_bewegung'
        | 'kreativ_workshops'
        | 'wellness_beauty'
        | 'kultur_events'
        | 'sonstiges';
      offer_status: 'aktiv' | 'abgesagt' | 'entfernt';
      offer_type: 'einzeltermin' | 'zeitraum';
      payment_job_kind: 'pi_abbrechen' | 'erstatten' | 'auszahlen' | 'auszahlung_zurueckholen';
      payment_job_status: 'offen' | 'laeuft' | 'erledigt' | 'fehlgeschlagen';
      push_platform: 'ios' | 'android' | 'web';
      refund_status: 'offen' | 'angefragt' | 'erstattet' | 'fehlgeschlagen';
      transfer_status: 'ueberwiesen' | 'zurueckholen' | 'zurueckgeholt' | 'fehlgeschlagen';
      voucher_cancel_reason: 'nutzer' | 'angebot_abgesagt' | 'angebot_entfernt' | 'konto_geloescht';
      voucher_status: 'aktiv' | 'storniert' | 'eingeloest' | 'no_show' | 'abgelaufen';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['nutzer', 'standort', 'admin'],
      booking_cancel_reason: [
        'nutzer',
        'angebot_abgesagt',
        'angebot_entfernt',
        'konto_geloescht',
        'zahlung_zu_spaet',
      ],
      booking_status: [
        'reserviert',
        'abgelaufen',
        'bezahlt',
        'storniert',
        'erstattet',
        'eingeloest',
        'no_show',
        'ausgezahlt',
      ],
      event_type: [
        'angebot_angesehen',
        'code_geholt',
        'code_storniert',
        'code_eingeloest',
        'no_show',
      ],
      location_status: ['pending', 'approved', 'rejected'],
      notification_status: ['pending', 'processing', 'sent', 'failed'],
      notification_type: ['angebot_abgesagt', 'erinnerung', 'neues_angebot'],
      offer_category: [
        'kochen_essen',
        'sport_bewegung',
        'kreativ_workshops',
        'wellness_beauty',
        'kultur_events',
        'sonstiges',
      ],
      offer_status: ['aktiv', 'abgesagt', 'entfernt'],
      offer_type: ['einzeltermin', 'zeitraum'],
      payment_job_kind: ['pi_abbrechen', 'erstatten', 'auszahlen', 'auszahlung_zurueckholen'],
      payment_job_status: ['offen', 'laeuft', 'erledigt', 'fehlgeschlagen'],
      push_platform: ['ios', 'android', 'web'],
      refund_status: ['offen', 'angefragt', 'erstattet', 'fehlgeschlagen'],
      transfer_status: ['ueberwiesen', 'zurueckholen', 'zurueckgeholt', 'fehlgeschlagen'],
      voucher_cancel_reason: ['nutzer', 'angebot_abgesagt', 'angebot_entfernt', 'konto_geloescht'],
      voucher_status: ['aktiv', 'storniert', 'eingeloest', 'no_show', 'abgelaufen'],
    },
  },
} as const;
