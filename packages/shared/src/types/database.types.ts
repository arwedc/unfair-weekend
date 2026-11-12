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
          image_paths: string[];
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
      cancel_offer: { Args: { p_offer_id: string; p_reason?: string }; Returns: Json };
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
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      get_admin_metrics: { Args: { p_from?: string; p_to?: string }; Returns: Json };
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
      reject_location: { Args: { p_location_id: string; p_reason?: string }; Returns: Json };
      remove_offer: { Args: { p_offer_id: string; p_reason?: string }; Returns: Json };
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
      event_type:
        'angebot_angesehen' | 'code_geholt' | 'code_storniert' | 'code_eingeloest' | 'no_show';
      location_status: 'pending' | 'approved' | 'rejected';
      notification_status: 'pending' | 'processing' | 'sent' | 'failed';
      notification_type: 'angebot_abgesagt' | 'erinnerung';
      offer_category:
        | 'kochen_essen'
        | 'sport_bewegung'
        | 'kreativ_workshops'
        | 'wellness_beauty'
        | 'kultur_events'
        | 'sonstiges';
      offer_status: 'aktiv' | 'abgesagt' | 'entfernt';
      offer_type: 'einzeltermin' | 'zeitraum';
      push_platform: 'ios' | 'android' | 'web';
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
      event_type: [
        'angebot_angesehen',
        'code_geholt',
        'code_storniert',
        'code_eingeloest',
        'no_show',
      ],
      location_status: ['pending', 'approved', 'rejected'],
      notification_status: ['pending', 'processing', 'sent', 'failed'],
      notification_type: ['angebot_abgesagt', 'erinnerung'],
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
      push_platform: ['ios', 'android', 'web'],
      voucher_cancel_reason: ['nutzer', 'angebot_abgesagt', 'angebot_entfernt', 'konto_geloescht'],
      voucher_status: ['aktiv', 'storniert', 'eingeloest', 'no_show', 'abgelaufen'],
    },
  },
} as const;
