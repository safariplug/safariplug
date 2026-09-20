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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_booking_pricing_ledger: {
        Row: {
          booking_status: string
          checkout_intent_key: string | null
          confirmed_at: string | null
          created_at: string
          customer_currency: string
          customer_user_id: string
          exchange_rate: number | null
          id: string
          markup_percent: number
          metadata: Json
          paid_at: string | null
          payment_initiation_started_at: string | null
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string
          preconfirm_initiation_started_at: string | null
          preconfirmed_at: string | null
          prepared_booking_id: string
          provider: string
          provider_booking_reference: string | null
          retail_amount: number
          supplier_amount: number
          supplier_currency: string
          supplier_settlement_status: string
          updated_at: string
        }
        Insert: {
          booking_status?: string
          checkout_intent_key?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_currency: string
          customer_user_id: string
          exchange_rate?: number | null
          id?: string
          markup_percent?: number
          metadata?: Json
          paid_at?: string | null
          payment_initiation_started_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          preconfirm_initiation_started_at?: string | null
          preconfirmed_at?: string | null
          prepared_booking_id: string
          provider?: string
          provider_booking_reference?: string | null
          retail_amount: number
          supplier_amount: number
          supplier_currency: string
          supplier_settlement_status?: string
          updated_at?: string
        }
        Update: {
          booking_status?: string
          checkout_intent_key?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_currency?: string
          customer_user_id?: string
          exchange_rate?: number | null
          id?: string
          markup_percent?: number
          metadata?: Json
          paid_at?: string | null
          payment_initiation_started_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          preconfirm_initiation_started_at?: string | null
          preconfirmed_at?: string | null
          prepared_booking_id?: string
          provider?: string
          provider_booking_reference?: string | null
          retail_amount?: number
          supplier_amount?: number
          supplier_currency?: string
          supplier_settlement_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_telemetry_logs: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_discovered_events: {
        Row: {
          category: string
          city: string | null
          confidence_score: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          end_at: string | null
          experience_type: string | null
          id: string
          image_url: string | null
          image_verified: boolean | null
          is_featured: boolean | null
          organizer_name: string | null
          price: number | null
          review_notes: string | null
          review_score: number | null
          review_status: string | null
          reviewed_at: string | null
          source_name: string | null
          source_type: string | null
          source_url: string | null
          start_at: string | null
          status: string | null
          title: string
          updated_at: string | null
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          category: string
          city?: string | null
          confidence_score?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          end_at?: string | null
          experience_type?: string | null
          id?: string
          image_url?: string | null
          image_verified?: boolean | null
          is_featured?: boolean | null
          organizer_name?: string | null
          price?: number | null
          review_notes?: string | null
          review_score?: number | null
          review_status?: string | null
          reviewed_at?: string | null
          source_name?: string | null
          source_type?: string | null
          source_url?: string | null
          start_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          category?: string
          city?: string | null
          confidence_score?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          end_at?: string | null
          experience_type?: string | null
          id?: string
          image_url?: string | null
          image_verified?: boolean | null
          is_featured?: boolean | null
          organizer_name?: string | null
          price?: number | null
          review_notes?: string | null
          review_score?: number | null
          review_status?: string | null
          reviewed_at?: string | null
          source_name?: string | null
          source_type?: string | null
          source_url?: string | null
          start_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      ai_event_itineraries: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          itinerary: Json | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          itinerary?: Json | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          itinerary?: Json | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_event_itineraries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ai_discovered_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sales_outreach: {
        Row: {
          approved: boolean | null
          channel: string
          created_at: string | null
          follow_up_date: string | null
          follow_up_notes: string | null
          id: string
          last_contacted_at: string | null
          message: string
          outcome: string | null
          prospect_id: string | null
          response: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
        }
        Insert: {
          approved?: boolean | null
          channel: string
          created_at?: string | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          id?: string
          last_contacted_at?: string | null
          message: string
          outcome?: string | null
          prospect_id?: string | null
          response?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Update: {
          approved?: boolean | null
          channel?: string
          created_at?: string | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          id?: string
          last_contacted_at?: string | null
          message?: string
          outcome?: string | null
          prospect_id?: string | null
          response?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_sales_outreach_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sales_prospects: {
        Row: {
          business_name: string
          category: string | null
          city: string | null
          contact_email: string | null
          created_at: string | null
          description: string | null
          facebook: string | null
          id: string
          instagram: string | null
          notes: string | null
          opportunity_score: number | null
          phone: string | null
          review_status: string | null
          source_name: string | null
          source_url: string | null
          status: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          business_name: string
          category?: string | null
          city?: string | null
          contact_email?: string | null
          created_at?: string | null
          description?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          notes?: string | null
          opportunity_score?: number | null
          phone?: string | null
          review_status?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          business_name?: string
          category?: string | null
          city?: string | null
          contact_email?: string | null
          created_at?: string | null
          description?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          notes?: string | null
          opportunity_score?: number | null
          phone?: string | null
          review_status?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      ai_scans: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string | null
          events_found: number | null
          id: string
          location: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          category: string
          completed_at?: string | null
          created_at?: string | null
          events_found?: number | null
          id?: string
          location: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string | null
          events_found?: number | null
          id?: string
          location?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      ai_scout_locks: {
        Row: {
          created_at: string
          lock_name: string
          locked_by: string | null
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          lock_name: string
          locked_by?: string | null
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          lock_name?: string
          locked_by?: string | null
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_scout_runs: {
        Row: {
          attempt_count: number
          category: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string | null
          discoveries_found: number | null
          events_found: number | null
          id: string
          last_error: string | null
          last_provider_error: string | null
          location: string
          max_attempts: number
          notes: string | null
          poll_lease_until: string | null
          provider_failure_count: number
          provider_response_id: string | null
          provider_status: string | null
          queued_at: string | null
          sent_for_review: number | null
          sources_checked: number | null
          started_at: string | null
          status: string | null
          worker_stage: string | null
        }
        Insert: {
          attempt_count?: number
          category: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          discoveries_found?: number | null
          events_found?: number | null
          id?: string
          last_error?: string | null
          last_provider_error?: string | null
          location: string
          max_attempts?: number
          notes?: string | null
          poll_lease_until?: string | null
          provider_failure_count?: number
          provider_response_id?: string | null
          provider_status?: string | null
          queued_at?: string | null
          sent_for_review?: number | null
          sources_checked?: number | null
          started_at?: string | null
          status?: string | null
          worker_stage?: string | null
        }
        Update: {
          attempt_count?: number
          category?: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          discoveries_found?: number | null
          events_found?: number | null
          id?: string
          last_error?: string | null
          last_provider_error?: string | null
          location?: string
          max_attempts?: number
          notes?: string | null
          poll_lease_until?: string | null
          provider_failure_count?: number
          provider_response_id?: string | null
          provider_status?: string | null
          queued_at?: string | null
          sent_for_review?: number | null
          sources_checked?: number | null
          started_at?: string | null
          status?: string | null
          worker_stage?: string | null
        }
        Relationships: []
      }
      aurelian_feed_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          excluded_past_count: number
          http_status: number
          id: string
          malformed_count: number
          outcome: string
          provider: string
          record_count: number
          requested_at: string
          upcoming_count: number
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          excluded_past_count?: number
          http_status: number
          id?: string
          malformed_count?: number
          outcome: string
          provider?: string
          record_count?: number
          requested_at?: string
          upcoming_count?: number
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          excluded_past_count?: number
          http_status?: number
          id?: string
          malformed_count?: number
          outcome?: string
          provider?: string
          record_count?: number
          requested_at?: string
          upcoming_count?: number
        }
        Relationships: []
      }
      booking_status_events: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          commission_amount: number
          created_at: string
          customer_currency: string | null
          customer_total: number | null
          discount_amount: number
          event_id: string | null
          expires_at: string | null
          fee_amount: number
          id: string
          idempotency_key: string | null
          markup_amount: number
          notes: string | null
          offering_id: string | null
          price_source: string
          provider_id: string | null
          public_id: string
          status: string
          supplier_amount: number | null
          supplier_currency: string | null
          supplier_reference: string | null
          tax_amount: number
          traveler_id: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          customer_currency?: string | null
          customer_total?: number | null
          discount_amount?: number
          event_id?: string | null
          expires_at?: string | null
          fee_amount?: number
          id?: string
          idempotency_key?: string | null
          markup_amount?: number
          notes?: string | null
          offering_id?: string | null
          price_source?: string
          provider_id?: string | null
          public_id: string
          status?: string
          supplier_amount?: number | null
          supplier_currency?: string | null
          supplier_reference?: string | null
          tax_amount?: number
          traveler_id: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          customer_currency?: string | null
          customer_total?: number | null
          discount_amount?: number
          event_id?: string | null
          expires_at?: string | null
          fee_amount?: number
          id?: string
          idempotency_key?: string | null
          markup_amount?: number
          notes?: string | null
          offering_id?: string | null
          price_source?: string
          provider_id?: string | null
          public_id?: string
          status?: string
          supplier_amount?: number | null
          supplier_currency?: string | null
          supplier_reference?: string | null
          tax_amount?: number
          traveler_id?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          business_type: string | null
          city_id: string | null
          claimed: boolean
          cover_image_url: string | null
          created_at: string
          description: string | null
          email: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          owner_id: string | null
          phone: string | null
          slug: string
          status: string
          supplier_contact_name: string | null
          supplier_gallery_urls: string[]
          tiktok_url: string | null
          updated_at: string
          verified: boolean
          website_url: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          business_type?: string | null
          city_id?: string | null
          claimed?: boolean
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          owner_id?: string | null
          phone?: string | null
          slug: string
          status?: string
          supplier_contact_name?: string | null
          supplier_gallery_urls?: string[]
          tiktok_url?: string | null
          updated_at?: string
          verified?: boolean
          website_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          business_type?: string | null
          city_id?: string | null
          claimed?: boolean
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          slug?: string
          status?: string
          supplier_contact_name?: string | null
          supplier_gallery_urls?: string[]
          tiktok_url?: string | null
          updated_at?: string
          verified?: boolean
          website_url?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          type: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          type?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          active: boolean
          country: string
          country_code: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          slug: string
          timezone: string | null
        }
        Insert: {
          active?: boolean
          country: string
          country_code?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          slug: string
          timezone?: string | null
        }
        Update: {
          active?: boolean
          country?: string
          country_code?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          slug?: string
          timezone?: string | null
        }
        Relationships: []
      }
      concierge_rate_limits: {
        Row: {
          bucket: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          bucket: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          bucket?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          activity_type: string
          contact_id: string | null
          created_at: string
          details: string | null
          id: string
          occurred_at: string
          partner_id: string | null
          prospect_id: string | null
          summary: string
        }
        Insert: {
          activity_type: string
          contact_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          occurred_at?: string
          partner_id?: string | null
          prospect_id?: string | null
          summary: string
        }
        Update: {
          activity_type?: string
          contact_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          occurred_at?: string
          partner_id?: string | null
          prospect_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "safari_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          job_title: string | null
          linkedin_url: string | null
          notes: string | null
          partner_id: string | null
          phone: string | null
          prospect_id: string | null
          source_url: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          job_title?: string | null
          linkedin_url?: string | null
          notes?: string | null
          partner_id?: string | null
          phone?: string | null
          prospect_id?: string | null
          source_url?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          job_title?: string | null
          linkedin_url?: string | null
          notes?: string | null
          partner_id?: string | null
          phone?: string | null
          prospect_id?: string | null
          source_url?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "safari_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_conversions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          occurred_at: string
          outcome: string
          partner_id: string | null
          prospect_id: string | null
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          outcome: string
          partner_id?: string | null
          prospect_id?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          outcome?: string
          partner_id?: string | null
          prospect_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_conversions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "safari_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_conversions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_followups: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          created_at: string
          due_at: string
          id: string
          notes: string | null
          partner_id: string | null
          priority: string
          prospect_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          due_at: string
          id?: string
          notes?: string | null
          partner_id?: string | null
          priority?: string
          prospect_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          due_at?: string
          id?: string
          notes?: string | null
          partner_id?: string | null
          priority?: string
          prospect_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_followups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "safari_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_followups_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      discoveries: {
        Row: {
          confidence_score: number | null
          created_at: string
          discovered_at: string
          duplicate_score: number | null
          extracted_data: Json | null
          id: string
          potential_category: string | null
          potential_listing_type: string | null
          raw_content: string | null
          raw_title: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          source_url: string | null
          status: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          discovered_at?: string
          duplicate_score?: number | null
          extracted_data?: Json | null
          id?: string
          potential_category?: string | null
          potential_listing_type?: string | null
          raw_content?: string | null
          raw_title?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          source_url?: string | null
          status?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          discovered_at?: string
          duplicate_score?: number | null
          extracted_data?: Json | null
          id?: string
          potential_category?: string | null
          potential_listing_type?: string | null
          raw_content?: string | null
          raw_title?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "discoveries_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_assignments: {
        Row: {
          assigned_by: string
          booking_id: string
          created_at: string
          driver_id: string
          id: string
          note: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          assigned_by?: string
          booking_id: string
          created_at?: string
          driver_id: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          assigned_by?: string
          booking_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_compliance_overview"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "driver_compliance_overview"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "driver_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_availability: {
        Row: {
          available_on: string
          created_at: string
          driver_id: string
          end_time: string | null
          id: string
          start_time: string | null
          status: string
          timezone: string
        }
        Insert: {
          available_on: string
          created_at?: string
          driver_id: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          status?: string
          timezone?: string
        }
        Update: {
          available_on?: string
          created_at?: string
          driver_id?: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_availability_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_compliance_overview"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_availability_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_compliance_alerts: {
        Row: {
          alert_type: string
          created_at: string
          document_type: string
          driver_id: string
          expires_on: string
          id: string
          resolved_at: string | null
          status: string
          vehicle_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          document_type: string
          driver_id: string
          expires_on: string
          id?: string
          resolved_at?: string | null
          status?: string
          vehicle_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          document_type?: string
          driver_id?: string
          expires_on?: string
          id?: string
          resolved_at?: string | null
          status?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_compliance_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_compliance_overview"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_compliance_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_compliance_alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "driver_compliance_overview"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "driver_compliance_alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          capabilities: string[]
          contact_ref: string | null
          created_at: string
          display_name: string
          driving_license_compliance_status: string
          driving_license_expires_on: string | null
          driving_license_number: string | null
          driving_license_path: string | null
          driving_license_uploaded_at: string | null
          external_id: string | null
          id: string
          identity_liveness_verified_at: string | null
          personal_photo_url: string | null
          preferred: boolean
          provider_id: string | null
          provider_type: string
          service_airport_code: string | null
          service_city: string | null
          service_city_id: string | null
          service_country: string | null
          service_lat: number | null
          service_lng: number | null
          service_radius_km: number | null
          service_region: string | null
          service_status: string
          source: string
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          user_id: string | null
          verification_state: string
        }
        Insert: {
          capabilities?: string[]
          contact_ref?: string | null
          created_at?: string
          display_name: string
          driving_license_compliance_status?: string
          driving_license_expires_on?: string | null
          driving_license_number?: string | null
          driving_license_path?: string | null
          driving_license_uploaded_at?: string | null
          external_id?: string | null
          id?: string
          identity_liveness_verified_at?: string | null
          personal_photo_url?: string | null
          preferred?: boolean
          provider_id?: string | null
          provider_type?: string
          service_airport_code?: string | null
          service_city?: string | null
          service_city_id?: string | null
          service_country?: string | null
          service_lat?: number | null
          service_lng?: number | null
          service_radius_km?: number | null
          service_region?: string | null
          service_status?: string
          source?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_id?: string | null
          verification_state?: string
        }
        Update: {
          capabilities?: string[]
          contact_ref?: string | null
          created_at?: string
          display_name?: string
          driving_license_compliance_status?: string
          driving_license_expires_on?: string | null
          driving_license_number?: string | null
          driving_license_path?: string | null
          driving_license_uploaded_at?: string | null
          external_id?: string | null
          id?: string
          identity_liveness_verified_at?: string | null
          personal_photo_url?: string | null
          preferred?: boolean
          provider_id?: string | null
          provider_type?: string
          service_airport_code?: string | null
          service_city?: string | null
          service_city_id?: string | null
          service_country?: string | null
          service_lat?: number | null
          service_lng?: number | null
          service_radius_km?: number | null
          service_region?: string | null
          service_status?: string
          source?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_id?: string | null
          verification_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_profiles_service_city_id_fkey"
            columns: ["service_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_transfer_rates: {
        Row: {
          airport_code: string | null
          amount: number
          created_at: string
          currency: string
          destination_label: string | null
          driver_id: string
          extra_km_amount: number | null
          id: string
          included_km: number | null
          origin_label: string | null
          rate_type: string
          status: string
          updated_at: string
        }
        Insert: {
          airport_code?: string | null
          amount: number
          created_at?: string
          currency?: string
          destination_label?: string | null
          driver_id: string
          extra_km_amount?: number | null
          id?: string
          included_km?: number | null
          origin_label?: string | null
          rate_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          airport_code?: string | null
          amount?: number
          created_at?: string
          currency?: string
          destination_label?: string | null
          driver_id?: string
          extra_km_amount?: number | null
          id?: string
          included_km?: number | null
          origin_label?: string | null
          rate_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_transfer_rates_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_compliance_overview"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_transfer_rates_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_transfer_requests: {
        Row: {
          created_at: string
          currency: string
          destination_label: string
          driver_id: string
          id: string
          notes: string | null
          passenger_count: number
          pickup_label: string
          quoted_amount: number | null
          requested_at: string
          status: string
          transfer_rate_id: string | null
          traveler_id: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          destination_label: string
          driver_id: string
          id?: string
          notes?: string | null
          passenger_count?: number
          pickup_label: string
          quoted_amount?: number | null
          requested_at: string
          status?: string
          transfer_rate_id?: string | null
          traveler_id: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          destination_label?: string
          driver_id?: string
          id?: string
          notes?: string | null
          passenger_count?: number
          pickup_label?: string
          quoted_amount?: number | null
          requested_at?: string
          status?: string
          transfer_rate_id?: string | null
          traveler_id?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_transfer_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_compliance_overview"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_transfer_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_transfer_requests_transfer_rate_id_fkey"
            columns: ["transfer_rate_id"]
            isOneToOne: false
            referencedRelation: "driver_transfer_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_transfer_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          ai_confidence: number | null
          booking_url: string | null
          category: string
          city_id: string
          created_at: string
          currency: string | null
          description: string | null
          end_at: string | null
          experience_type: string | null
          featured: boolean
          id: string
          image_url: string | null
          is_featured: boolean | null
          latitude: number | null
          longitude: number | null
          organizer_contact: string | null
          organizer_id: string | null
          organizer_name: string | null
          price: number | null
          slug: string
          source_type: string | null
          source_url: string | null
          start_at: string
          status: string
          submitted_by: string | null
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          ai_confidence?: number | null
          booking_url?: string | null
          category: string
          city_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          end_at?: string | null
          experience_type?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          latitude?: number | null
          longitude?: number | null
          organizer_contact?: string | null
          organizer_id?: string | null
          organizer_name?: string | null
          price?: number | null
          slug: string
          source_type?: string | null
          source_url?: string | null
          start_at: string
          status?: string
          submitted_by?: string | null
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          ai_confidence?: number | null
          booking_url?: string | null
          category?: string
          city_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          end_at?: string | null
          experience_type?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          latitude?: number | null
          longitude?: number | null
          organizer_contact?: string | null
          organizer_id?: string | null
          organizer_name?: string | null
          price?: number | null
          slug?: string
          source_type?: string | null
          source_url?: string | null
          start_at?: string
          status?: string
          submitted_by?: string | null
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_delivery_assignments: {
        Row: {
          accepted_at: string | null
          arrived_at: string | null
          assigned_by: string | null
          assignment_source: string
          created_at: string
          customer_note: string | null
          customer_rating: number | null
          delivered_at: string | null
          delivery_fee: number
          driver_id: string
          id: string
          note: string | null
          order_id: string
          picked_up_at: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          arrived_at?: string | null
          assigned_by?: string | null
          assignment_source?: string
          created_at?: string
          customer_note?: string | null
          customer_rating?: number | null
          delivered_at?: string | null
          delivery_fee?: number
          driver_id: string
          id?: string
          note?: string | null
          order_id: string
          picked_up_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          arrived_at?: string | null
          assigned_by?: string | null
          assignment_source?: string
          created_at?: string
          customer_note?: string | null
          customer_rating?: number | null
          delivered_at?: string | null
          delivery_fee?: number
          driver_id?: string
          id?: string
          note?: string | null
          order_id?: string
          picked_up_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_delivery_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_compliance_overview"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "food_delivery_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_delivery_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_delivery_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "driver_compliance_overview"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "food_delivery_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_order_item_options: {
        Row: {
          created_at: string
          id: string
          option_name: string
          order_item_id: string
          price_delta: number
          value_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_name: string
          order_item_id: string
          price_delta?: number
          value_name: string
        }
        Update: {
          created_at?: string
          id?: string
          option_name?: string
          order_item_id?: string
          price_delta?: number
          value_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_order_item_options_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "food_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_order_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          line_total: number
          menu_item_id: string | null
          notes: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          line_total: number
          menu_item_id?: string | null
          notes?: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          line_total?: number
          menu_item_id?: string | null
          notes?: string | null
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      food_order_payment_idempotency: {
        Row: {
          attempt_active: boolean
          created_at: string
          customer_user_id: string
          id: string
          idempotency_key: string
          order_id: string
          payment_intent_id: string
          processing_until: string | null
          provider: string
          provider_reference: string | null
          provider_submission_state: string
        }
        Insert: {
          attempt_active?: boolean
          created_at?: string
          customer_user_id: string
          id?: string
          idempotency_key: string
          order_id: string
          payment_intent_id: string
          processing_until?: string | null
          provider: string
          provider_reference?: string | null
          provider_submission_state?: string
        }
        Update: {
          attempt_active?: boolean
          created_at?: string
          customer_user_id?: string
          id?: string
          idempotency_key?: string
          order_id?: string
          payment_intent_id?: string
          processing_until?: string | null
          provider?: string
          provider_reference?: string | null
          provider_submission_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_order_payment_idempotency_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      food_order_refunds: {
        Row: {
          amount: number
          created_at: string
          currency: string
          error_message: string | null
          id: string
          idempotency_key: string
          order_id: string
          processed_at: string | null
          provider: string
          provider_reference: string | null
          refund_reference: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          order_id: string
          processed_at?: string | null
          provider: string
          provider_reference?: string | null
          refund_reference?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string
          processed_at?: string | null
          provider?: string
          provider_reference?: string | null
          refund_reference?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      food_orders: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          business_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string
          customer_note: string | null
          customer_notes: string | null
          customer_phone: string
          customer_rating: number | null
          customer_total: number
          customer_user_id: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_latitude: number | null
          delivery_longitude: number | null
          discount_amount: number
          estimated_delivery_minutes: number | null
          estimated_prep_minutes: number | null
          eta_at: string | null
          fulfillment_method: string
          id: string
          payment_intent_id: string | null
          payment_reference: string | null
          payment_status: string
          picked_up_at: string | null
          pickup_address: string | null
          public_id: string
          ready_at: string | null
          refund_reference: string | null
          refunded_amount: number
          refunded_at: string | null
          requested_at: string
          restaurant_notes: string | null
          service_fee: number
          status: string
          subtotal: number
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          business_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name: string
          customer_note?: string | null
          customer_notes?: string | null
          customer_phone: string
          customer_rating?: number | null
          customer_total?: number
          customer_user_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          discount_amount?: number
          estimated_delivery_minutes?: number | null
          estimated_prep_minutes?: number | null
          eta_at?: string | null
          fulfillment_method?: string
          id?: string
          payment_intent_id?: string | null
          payment_reference?: string | null
          payment_status?: string
          picked_up_at?: string | null
          pickup_address?: string | null
          public_id?: string
          ready_at?: string | null
          refund_reference?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          requested_at?: string
          restaurant_notes?: string | null
          service_fee?: number
          status?: string
          subtotal?: number
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          business_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string
          customer_note?: string | null
          customer_notes?: string | null
          customer_phone?: string
          customer_rating?: number | null
          customer_total?: number
          customer_user_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          discount_amount?: number
          estimated_delivery_minutes?: number | null
          estimated_prep_minutes?: number | null
          eta_at?: string | null
          fulfillment_method?: string
          id?: string
          payment_intent_id?: string | null
          payment_reference?: string | null
          payment_status?: string
          picked_up_at?: string | null
          pickup_address?: string | null
          public_id?: string
          ready_at?: string | null
          refund_reference?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          requested_at?: string
          restaurant_notes?: string | null
          service_fee?: number
          status?: string
          subtotal?: number
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_booking_pricing_ledger: {
        Row: {
          booking_status: string
          checkout_intent_key: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_currency: string | null
          customer_retail_amount: number | null
          customer_user_id: string
          exchange_rate: number | null
          id: string
          markup_percent: number
          metadata: Json
          paid_at: string | null
          payment_initiation_started_at: string | null
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string
          prepared_booking_id: string | null
          provider: string
          provider_booking_reference: string | null
          quote_id: string | null
          retail_amount: number
          supplier_currency: string | null
          supplier_net_amount: number
          supplier_settlement_status: string
          updated_at: string
        }
        Insert: {
          booking_status?: string
          checkout_intent_key?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_currency?: string | null
          customer_retail_amount?: number | null
          customer_user_id: string
          exchange_rate?: number | null
          id?: string
          markup_percent?: number
          metadata?: Json
          paid_at?: string | null
          payment_initiation_started_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          prepared_booking_id?: string | null
          provider?: string
          provider_booking_reference?: string | null
          quote_id?: string | null
          retail_amount: number
          supplier_currency?: string | null
          supplier_net_amount: number
          supplier_settlement_status?: string
          updated_at?: string
        }
        Update: {
          booking_status?: string
          checkout_intent_key?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_currency?: string | null
          customer_retail_amount?: number | null
          customer_user_id?: string
          exchange_rate?: number | null
          id?: string
          markup_percent?: number
          metadata?: Json
          paid_at?: string | null
          payment_initiation_started_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          prepared_booking_id?: string | null
          provider?: string
          provider_booking_reference?: string | null
          quote_id?: string | null
          retail_amount?: number
          supplier_currency?: string | null
          supplier_net_amount?: number
          supplier_settlement_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hotel_checkout_intents: {
        Row: {
          created_at: string
          customer_user_id: string
          id: string
          intent_key: string
          last_error: string | null
          ledger_id: string | null
          metadata: Json
          payment_initiation_started_at: string | null
          prepared_booking_id: string | null
          provider: string
          state: string
          supplier_prepare_started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_user_id: string
          id?: string
          intent_key: string
          last_error?: string | null
          ledger_id?: string | null
          metadata?: Json
          payment_initiation_started_at?: string | null
          prepared_booking_id?: string | null
          provider: string
          state?: string
          supplier_prepare_started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_user_id?: string
          id?: string
          intent_key?: string
          last_error?: string | null
          ledger_id?: string | null
          metadata?: Json
          payment_initiation_started_at?: string | null
          prepared_booking_id?: string | null
          provider?: string
          state?: string
          supplier_prepare_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_checkout_intents_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "hotel_booking_pricing_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      hotelbeds_content_sync_state: {
        Row: {
          incremental_since: string | null
          language: string
          last_completed_at: string | null
          last_error: string | null
          last_page_count: number
          last_started_at: string | null
          next_from: number
          page_size: number
          status: string
          supplier_total: number | null
          sync_key: string
          updated_at: string
        }
        Insert: {
          incremental_since?: string | null
          language?: string
          last_completed_at?: string | null
          last_error?: string | null
          last_page_count?: number
          last_started_at?: string | null
          next_from?: number
          page_size?: number
          status?: string
          supplier_total?: number | null
          sync_key: string
          updated_at?: string
        }
        Update: {
          incremental_since?: string | null
          language?: string
          last_completed_at?: string | null
          last_error?: string | null
          last_page_count?: number
          last_started_at?: string | null
          next_from?: number
          page_size?: number
          status?: string
          supplier_total?: number | null
          sync_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      hotelbeds_hotel_content: {
        Row: {
          address: Json
          category_code: string | null
          category_name: string | null
          coordinates: Json
          country_code: string | null
          descriptions: Json
          destination_code: string | null
          destination_name: string | null
          facilities: Json
          hotel_code: number
          images: Json
          language: string
          name: string | null
          raw: Json
          rooms: Json
          supplier_last_update: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          address?: Json
          category_code?: string | null
          category_name?: string | null
          coordinates?: Json
          country_code?: string | null
          descriptions?: Json
          destination_code?: string | null
          destination_name?: string | null
          facilities?: Json
          hotel_code: number
          images?: Json
          language?: string
          name?: string | null
          raw?: Json
          rooms?: Json
          supplier_last_update?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          address?: Json
          category_code?: string | null
          category_name?: string | null
          coordinates?: Json
          country_code?: string | null
          descriptions?: Json
          destination_code?: string | null
          destination_name?: string | null
          facilities?: Json
          hotel_code?: number
          images?: Json
          language?: string
          name?: string | null
          raw?: Json
          rooms?: Json
          supplier_last_update?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_syncs: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          last_error: string | null
          last_payload: Json | null
          last_synced_at: string | null
          provider: string
          safariplug_event_id: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          last_payload?: Json | null
          last_synced_at?: string | null
          provider: string
          safariplug_event_id: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          last_payload?: Json | null
          last_synced_at?: string | null
          provider?: string
          safariplug_event_id?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_syncs_safariplug_event_id_fkey"
            columns: ["safariplug_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_kinds: {
        Row: {
          group_name: string
          label: string
          slug: string
        }
        Insert: {
          group_name: string
          label: string
          slug: string
        }
        Update: {
          group_name?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      journal_articles: {
        Row: {
          body: string
          category: string | null
          city: string | null
          created_at: string
          event_id: string | null
          excerpt: string | null
          id: string
          image_url: string | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          source_event_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          city?: string | null
          created_at?: string
          event_id?: string | null
          excerpt?: string | null
          id?: string
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          source_event_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          city?: string | null
          created_at?: string
          event_id?: string | null
          excerpt?: string | null
          id?: string
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          source_event_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_articles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address: string | null
          booking_url: string | null
          business_id: string | null
          category_id: string | null
          city_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          expires_at: string | null
          featured: boolean
          featured_until: string | null
          id: string
          image_url: string | null
          is_recurring: boolean
          latitude: number | null
          listing_type: string
          longitude: number | null
          price_from: number | null
          price_to: number | null
          price_type: string | null
          recurrence_rule: string | null
          short_description: string | null
          slug: string
          source_name: string | null
          source_url: string | null
          start_date: string | null
          start_time: string | null
          status: string
          title: string
          updated_at: string
          venue_name: string | null
          verification_status: string
          website_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          booking_url?: string | null
          business_id?: string | null
          category_id?: string | null
          city_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          expires_at?: string | null
          featured?: boolean
          featured_until?: string | null
          id?: string
          image_url?: string | null
          is_recurring?: boolean
          latitude?: number | null
          listing_type: string
          longitude?: number | null
          price_from?: number | null
          price_to?: number | null
          price_type?: string | null
          recurrence_rule?: string | null
          short_description?: string | null
          slug: string
          source_name?: string | null
          source_url?: string | null
          start_date?: string | null
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
          venue_name?: string | null
          verification_status?: string
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          booking_url?: string | null
          business_id?: string | null
          category_id?: string | null
          city_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          expires_at?: string | null
          featured?: boolean
          featured_until?: string | null
          id?: string
          image_url?: string | null
          is_recurring?: boolean
          latitude?: number | null
          listing_type?: string
          longitude?: number | null
          price_from?: number | null
          price_to?: number | null
          price_type?: string | null
          recurrence_rule?: string | null
          short_description?: string | null
          slug?: string
          source_name?: string | null
          source_url?: string | null
          start_date?: string | null
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
          venue_name?: string | null
          verification_status?: string
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      local_availability: {
        Row: {
          available_on: string
          created_at: string
          end_time: string | null
          id: string
          local_id: string
          start_time: string | null
          status: string
          timezone: string
        }
        Insert: {
          available_on: string
          created_at?: string
          end_time?: string | null
          id?: string
          local_id: string
          start_time?: string | null
          status?: string
          timezone?: string
        }
        Update: {
          available_on?: string
          created_at?: string
          end_time?: string | null
          id?: string
          local_id?: string
          start_time?: string | null
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_availability_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "local_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      local_profiles: {
        Row: {
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          display_name: string
          hourly_rate: number | null
          id: string
          identity_liveness_verified_at: string | null
          interests: string[]
          languages: string[]
          personal_photo_url: string | null
          service_status: string
          specialties: string[]
          terms_accepted_at: string | null
          timezone: string
          updated_at: string
          user_id: string
          verification_state: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          display_name: string
          hourly_rate?: number | null
          id?: string
          identity_liveness_verified_at?: string | null
          interests?: string[]
          languages?: string[]
          personal_photo_url?: string | null
          service_status?: string
          specialties?: string[]
          terms_accepted_at?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
          verification_state?: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          display_name?: string
          hourly_rate?: number | null
          id?: string
          identity_liveness_verified_at?: string | null
          interests?: string[]
          languages?: string[]
          personal_photo_url?: string | null
          service_status?: string
          specialties?: string[]
          terms_accepted_at?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          verification_state?: string
        }
        Relationships: []
      }
      local_requests: {
        Row: {
          activity: string | null
          city: string | null
          created_at: string
          currency: string
          id: string
          local_id: string
          notes: string | null
          quoted_amount: number | null
          requested_end_at: string | null
          requested_start_at: string
          status: string
          traveler_id: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          activity?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          id?: string
          local_id: string
          notes?: string | null
          quoted_amount?: number | null
          requested_end_at?: string | null
          requested_start_at: string
          status?: string
          traveler_id: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          activity?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          id?: string
          local_id?: string
          notes?: string | null
          quoted_amount?: number | null
          requested_end_at?: string | null
          requested_start_at?: string
          status?: string
          traveler_id?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_requests_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "local_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          city: string | null
          content_type: string | null
          created_at: string
          creative_brief: string | null
          draft_content: string | null
          event_id: string | null
          event_name: string | null
          external_url: string | null
          id: number
          image_url: string | null
          metricool_post_id: string | null
          metricool_status: string | null
          platform: string | null
          publish_error: string | null
          publish_status: string | null
          published_at: string | null
          scheduled_at: string | null
          status: string | null
          video_error: string | null
          video_job_id: string | null
          video_prompt: string | null
          video_status: string | null
          video_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          content_type?: string | null
          created_at?: string
          creative_brief?: string | null
          draft_content?: string | null
          event_id?: string | null
          event_name?: string | null
          external_url?: string | null
          id?: number
          image_url?: string | null
          metricool_post_id?: string | null
          metricool_status?: string | null
          platform?: string | null
          publish_error?: string | null
          publish_status?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          video_error?: string | null
          video_job_id?: string | null
          video_prompt?: string | null
          video_status?: string | null
          video_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          content_type?: string | null
          created_at?: string
          creative_brief?: string | null
          draft_content?: string | null
          event_id?: string | null
          event_name?: string | null
          external_url?: string | null
          id?: number
          image_url?: string | null
          metricool_post_id?: string | null
          metricool_status?: string | null
          platform?: string | null
          publish_error?: string | null
          publish_status?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          video_error?: string | null
          video_job_id?: string | null
          video_prompt?: string | null
          video_status?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      offerings: {
        Row: {
          category: string | null
          city_id: string | null
          created_at: string
          description: string | null
          end_at: string | null
          event_id: string | null
          id: string
          kind: string
          provider_id: string | null
          source: string
          start_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          city_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_id?: string | null
          id?: string
          kind: string
          provider_id?: string | null
          source?: string
          start_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          city_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          provider_id?: string | null
          source?: string
          start_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offerings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_kind_fkey"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "inventory_kinds"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "offerings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_invitations: {
        Row: {
          ai_message: string | null
          ai_subject: string | null
          approved_at: string | null
          business_name: string
          channel: string
          contact_email: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          invitation_token: string
          onboarded_user_id: string | null
          opened_at: string | null
          partner_id: string | null
          partner_type: string
          prospect_id: string | null
          sent_at: string | null
          signup_started_at: string | null
          status: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          ai_message?: string | null
          ai_subject?: string | null
          approved_at?: string | null
          business_name: string
          channel: string
          contact_email?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invitation_token?: string
          onboarded_user_id?: string | null
          opened_at?: string | null
          partner_id?: string | null
          partner_type: string
          prospect_id?: string | null
          sent_at?: string | null
          signup_started_at?: string | null
          status?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          ai_message?: string | null
          ai_subject?: string | null
          approved_at?: string | null
          business_name?: string
          channel?: string
          contact_email?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invitation_token?: string
          onboarded_user_id?: string | null
          opened_at?: string | null
          partner_id?: string | null
          partner_type?: string
          prospect_id?: string | null
          sent_at?: string | null
          signup_started_at?: string | null
          status?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_invitations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invitations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "safari_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invitations_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      price_quotes: {
        Row: {
          booking_id: string | null
          commission_amount: number
          created_at: string
          customer_currency: string
          customer_total: number
          discount_amount: number
          fee_amount: number
          id: string
          markup_amount: number
          offering_id: string | null
          source: string
          supplier_amount: number
          supplier_currency: string
          tax_amount: number
        }
        Insert: {
          booking_id?: string | null
          commission_amount?: number
          created_at?: string
          customer_currency: string
          customer_total: number
          discount_amount?: number
          fee_amount?: number
          id?: string
          markup_amount?: number
          offering_id?: string | null
          source?: string
          supplier_amount: number
          supplier_currency: string
          tax_amount?: number
        }
        Update: {
          booking_id?: string | null
          commission_amount?: number
          created_at?: string
          customer_currency?: string
          customer_total?: number
          discount_amount?: number
          fee_amount?: number
          id?: string
          markup_amount?: number
          offering_id?: string | null
          source?: string
          supplier_amount?: number
          supplier_currency?: string
          tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_quotes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_quotes_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
          user_type: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          booking_url: string | null
          business_id: string | null
          category_id: string | null
          city_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          discount_percentage: number | null
          end_at: string
          featured: boolean
          featured_until: string | null
          id: string
          image_url: string | null
          original_price: number | null
          promotional_price: number | null
          slug: string
          source_url: string | null
          start_at: string
          status: string
          terms: string | null
          title: string
          updated_at: string
          website_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          booking_url?: string | null
          business_id?: string | null
          category_id?: string | null
          city_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          discount_percentage?: number | null
          end_at: string
          featured?: boolean
          featured_until?: string | null
          id?: string
          image_url?: string | null
          original_price?: number | null
          promotional_price?: number | null
          slug: string
          source_url?: string | null
          start_at: string
          status?: string
          terms?: string | null
          title: string
          updated_at?: string
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          booking_url?: string | null
          business_id?: string | null
          category_id?: string | null
          city_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          discount_percentage?: number | null
          end_at?: string
          featured?: boolean
          featured_until?: string | null
          id?: string
          image_url?: string | null
          original_price?: number | null
          promotional_price?: number | null
          slug?: string
          source_url?: string | null
          start_at?: string
          status?: string
          terms?: string | null
          title?: string
          updated_at?: string
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          capabilities: string[]
          city_id: string | null
          created_at: string
          external_id: string | null
          id: string
          kind: string
          last_synced_at: string | null
          location_label: string | null
          name: string
          provider_type: string
          service_area: string | null
          slug: string | null
          source: string
          status: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          capabilities?: string[]
          city_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          kind?: string
          last_synced_at?: string | null
          location_label?: string | null
          name: string
          provider_type?: string
          service_area?: string | null
          slug?: string | null
          source?: string
          status?: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          capabilities?: string[]
          city_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          kind?: string
          last_synced_at?: string | null
          location_label?: string | null
          name?: string
          provider_type?: string
          service_area?: string | null
          slug?: string | null
          source?: string
          status?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "providers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          enabled: boolean
          expo_push_token: string
          id: string
          last_seen_at: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          enabled?: boolean
          expo_push_token: string
          id?: string
          last_seen_at?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          enabled?: boolean
          expo_push_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurant_menu_categories: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menu_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_menu_item_option_values: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          option_id: string
          price_delta: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          option_id: string
          price_delta?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          option_id?: string
          price_delta?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menu_item_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menu_item_options"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_menu_item_options: {
        Row: {
          active: boolean
          created_at: string
          id: string
          menu_item_id: string
          name: string
          required: boolean
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          menu_item_id: string
          name: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          menu_item_id?: string
          name?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menu_item_options_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_menu_items: {
        Row: {
          active: boolean
          available: boolean
          business_id: string
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          preparation_time_minutes: number | null
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          available?: boolean
          business_id: string
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          preparation_time_minutes?: number | null
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          available?: boolean
          business_id?: string
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          preparation_time_minutes?: number | null
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menu_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "restaurant_menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          business_id: string
          created_at: string
          customer_driver_base_fee: number
          customer_driver_enabled: boolean
          customer_driver_per_km: number
          free_delivery_threshold: number | null
          id: string
          minimum_order_amount: number
          ordering_enabled: boolean
          ordering_notice_minutes: number
          pickup_enabled: boolean
          preparation_time_minutes: number
          restaurant_delivery_enabled: boolean
          restaurant_delivery_fee: number
          safari_driver_base_fee: number
          safari_driver_enabled: boolean
          safari_driver_per_km: number
          timezone: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_driver_base_fee?: number
          customer_driver_enabled?: boolean
          customer_driver_per_km?: number
          free_delivery_threshold?: number | null
          id?: string
          minimum_order_amount?: number
          ordering_enabled?: boolean
          ordering_notice_minutes?: number
          pickup_enabled?: boolean
          preparation_time_minutes?: number
          restaurant_delivery_enabled?: boolean
          restaurant_delivery_fee?: number
          safari_driver_base_fee?: number
          safari_driver_enabled?: boolean
          safari_driver_per_km?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_driver_base_fee?: number
          customer_driver_enabled?: boolean
          customer_driver_per_km?: number
          free_delivery_threshold?: number | null
          id?: string
          minimum_order_amount?: number
          ordering_enabled?: boolean
          ordering_notice_minutes?: number
          pickup_enabled?: boolean
          preparation_time_minutes?: number
          restaurant_delivery_enabled?: boolean
          restaurant_delivery_fee?: number
          safari_driver_base_fee?: number
          safari_driver_enabled?: boolean
          safari_driver_per_km?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      safari_partners: {
        Row: {
          contact_person: string | null
          created_at: string
          email_or_phone: string | null
          id: string
          instagram_handle: string | null
          notes: string | null
          outreach_stage: string | null
          venue_or_promoter_name: string
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          email_or_phone?: string | null
          id?: string
          instagram_handle?: string | null
          notes?: string | null
          outreach_stage?: string | null
          venue_or_promoter_name: string
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          email_or_phone?: string | null
          id?: string
          instagram_handle?: string | null
          notes?: string | null
          outreach_stage?: string | null
          venue_or_promoter_name?: string
        }
        Relationships: []
      }
      saved_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          traveler_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          traveler_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          traveler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          discoveries_found: number | null
          id: string
          notes: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          discoveries_found?: number | null
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          discoveries_found?: number | null
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      service_appointment_notifications: {
        Row: {
          appointment_id: string
          body: string
          created_at: string
          id: string
          read_at: string | null
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          appointment_id: string
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          status?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          appointment_id?: string
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_appointment_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "service_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_appointment_status_events: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          appointment_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          appointment_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          appointment_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_appointment_status_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "service_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_appointments: {
        Row: {
          cancellation_reason: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_fee_amount: number
          customer_fee_percent: number
          customer_name: string
          customer_notes: string | null
          customer_phone: string | null
          customer_total_amount: number
          customer_user_id: string | null
          ends_at: string
          id: string
          offering_id: string
          paid_at: string | null
          payment_reference: string | null
          payment_status: string
          payout_minimum: number
          price: number
          provider_net_amount: number
          provider_notes: string | null
          public_id: string
          service_fee_amount: number
          service_fee_minimum: number
          service_fee_percent: number
          service_profile_id: string
          staff_id: string
          starts_at: string
          status: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          created_at?: string
          currency: string
          customer_email?: string | null
          customer_fee_amount?: number
          customer_fee_percent?: number
          customer_name: string
          customer_notes?: string | null
          customer_phone?: string | null
          customer_total_amount?: number
          customer_user_id?: string | null
          ends_at: string
          id?: string
          offering_id: string
          paid_at?: string | null
          payment_reference?: string | null
          payment_status?: string
          payout_minimum?: number
          price: number
          provider_net_amount?: number
          provider_notes?: string | null
          public_id: string
          service_fee_amount?: number
          service_fee_minimum?: number
          service_fee_percent?: number
          service_profile_id: string
          staff_id: string
          starts_at: string
          status?: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_fee_amount?: number
          customer_fee_percent?: number
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string | null
          customer_total_amount?: number
          customer_user_id?: string | null
          ends_at?: string
          id?: string
          offering_id?: string
          paid_at?: string | null
          payment_reference?: string | null
          payment_status?: string
          payout_minimum?: number
          price?: number
          provider_net_amount?: number
          provider_notes?: string | null
          public_id?: string
          service_fee_amount?: number
          service_fee_minimum?: number
          service_fee_percent?: number
          service_profile_id?: string
          staff_id?: string
          starts_at?: string
          status?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_appointments_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_appointments_service_profile_id_fkey"
            columns: ["service_profile_id"]
            isOneToOne: false
            referencedRelation: "service_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_appointments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_offerings: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price: number
          requires_confirmation: boolean
          service_profile_id: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes: number
          id?: string
          name: string
          price: number
          requires_confirmation?: boolean
          service_profile_id: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
          requires_confirmation?: boolean
          service_profile_id?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_offerings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_offerings_service_profile_id_fkey"
            columns: ["service_profile_id"]
            isOneToOne: false
            referencedRelation: "service_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_payment_events: {
        Row: {
          appointment_id: string | null
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          provider: string
          provider_reference: string | null
          status: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider: string
          provider_reference?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string
          provider_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_payment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "service_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_payment_idempotency: {
        Row: {
          appointment_id: string
          attempt_active: boolean
          created_at: string
          customer_user_id: string
          id: string
          idempotency_key: string
          payment_intent_id: string | null
          processing_until: string | null
          provider: string
          provider_reference: string | null
          provider_submission_state: string
        }
        Insert: {
          appointment_id: string
          attempt_active?: boolean
          created_at?: string
          customer_user_id: string
          id?: string
          idempotency_key: string
          payment_intent_id?: string | null
          processing_until?: string | null
          provider: string
          provider_reference?: string | null
          provider_submission_state?: string
        }
        Update: {
          appointment_id?: string
          attempt_active?: boolean
          created_at?: string
          customer_user_id?: string
          id?: string
          idempotency_key?: string
          payment_intent_id?: string | null
          processing_until?: string | null
          provider?: string
          provider_reference?: string | null
          provider_submission_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_payment_idempotency_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "service_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_payment_ledger: {
        Row: {
          appointment_id: string
          created_at: string
          currency: string
          customer_fee_amount: number
          customer_fee_percent: number
          customer_total_amount: number
          gross_amount: number
          id: string
          paid_at: string | null
          payment_reference: string | null
          payout_minimum: number
          platform_fee_amount: number
          platform_fee_percent: number
          provider_net_amount: number
          provider_reference: string | null
          refunded_amount: number
          service_fee_minimum: number
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          currency: string
          customer_fee_amount?: number
          customer_fee_percent?: number
          customer_total_amount?: number
          gross_amount?: number
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          payout_minimum?: number
          platform_fee_amount?: number
          platform_fee_percent?: number
          provider_net_amount?: number
          provider_reference?: string | null
          refunded_amount?: number
          service_fee_minimum?: number
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          currency?: string
          customer_fee_amount?: number
          customer_fee_percent?: number
          customer_total_amount?: number
          gross_amount?: number
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          payout_minimum?: number
          platform_fee_amount?: number
          platform_fee_percent?: number
          provider_net_amount?: number
          provider_reference?: string | null
          refunded_amount?: number
          service_fee_minimum?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_payment_ledger_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "service_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_payment_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_reference: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          provider_reference: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_reference?: string
          status?: string
        }
        Relationships: []
      }
      service_profiles: {
        Row: {
          booking_notice_minutes: number
          booking_status: string
          business_id: string
          cancellation_policy: string | null
          category_id: string | null
          created_at: string
          customer_fee_maximum: number
          customer_fee_minimum: number
          customer_fee_percent: number
          id: string
          max_booking_days: number
          notification_email: boolean
          notification_whatsapp: boolean
          payout_minimum: number
          payout_schedule: string
          provider_terms_accepted_at: string | null
          provider_terms_accepted_by: string | null
          provider_terms_version: string | null
          service_fee_minimum: number
          service_fee_percent: number
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          booking_notice_minutes?: number
          booking_status?: string
          business_id: string
          cancellation_policy?: string | null
          category_id?: string | null
          created_at?: string
          customer_fee_maximum?: number
          customer_fee_minimum?: number
          customer_fee_percent?: number
          id?: string
          max_booking_days?: number
          notification_email?: boolean
          notification_whatsapp?: boolean
          payout_minimum?: number
          payout_schedule?: string
          provider_terms_accepted_at?: string | null
          provider_terms_accepted_by?: string | null
          provider_terms_version?: string | null
          service_fee_minimum?: number
          service_fee_percent?: number
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          booking_notice_minutes?: number
          booking_status?: string
          business_id?: string
          cancellation_policy?: string | null
          category_id?: string | null
          created_at?: string
          customer_fee_maximum?: number
          customer_fee_minimum?: number
          customer_fee_percent?: number
          id?: string
          max_booking_days?: number
          notification_email?: boolean
          notification_whatsapp?: boolean
          payout_minimum?: number
          payout_schedule?: string
          provider_terms_accepted_at?: string | null
          provider_terms_accepted_by?: string | null
          provider_terms_version?: string | null
          service_fee_minimum?: number
          service_fee_percent?: number
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      service_provider_payout_accounts: {
        Row: {
          created_at: string
          id: string
          phone: string
          provider: string
          provider_user_id: string
          rejection_reason: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          provider?: string
          provider_user_id: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          provider?: string
          provider_user_id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      service_provider_payouts: {
        Row: {
          appointment_id: string
          approval_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          eligible_at: string | null
          failure_reason: string | null
          gross_amount: number
          id: string
          metadata: Json
          mpesa_conversation_id: string | null
          mpesa_result_code: number | null
          mpesa_result_description: string | null
          mpesa_transaction_id: string | null
          originator_conversation_id: string | null
          paid_at: string | null
          payout_destination_phone: string | null
          payout_destination_verified_at: string | null
          payout_minimum: number
          payout_phone: string | null
          payout_phone_verified_at: string | null
          payout_phone_verified_by: string | null
          payout_provider: string | null
          payout_reference: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          processing_at: string | null
          processor_fee_amount: number
          provider_net_amount: number
          provider_phone: string | null
          provider_user_id: string | null
          refund_amount: number
          result_code: string | null
          result_description: string | null
          service_profile_id: string
          status: string
          transaction_receipt: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          approval_user_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          conversation_id?: string | null
          created_at?: string
          currency: string
          eligible_at?: string | null
          failure_reason?: string | null
          gross_amount?: number
          id?: string
          metadata?: Json
          mpesa_conversation_id?: string | null
          mpesa_result_code?: number | null
          mpesa_result_description?: string | null
          mpesa_transaction_id?: string | null
          originator_conversation_id?: string | null
          paid_at?: string | null
          payout_destination_phone?: string | null
          payout_destination_verified_at?: string | null
          payout_minimum?: number
          payout_phone?: string | null
          payout_phone_verified_at?: string | null
          payout_phone_verified_by?: string | null
          payout_provider?: string | null
          payout_reference?: string | null
          platform_fee_amount?: number
          platform_fee_percent?: number
          processing_at?: string | null
          processor_fee_amount?: number
          provider_net_amount?: number
          provider_phone?: string | null
          provider_user_id?: string | null
          refund_amount?: number
          result_code?: string | null
          result_description?: string | null
          service_profile_id: string
          status?: string
          transaction_receipt?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          approval_user_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          conversation_id?: string | null
          created_at?: string
          currency?: string
          eligible_at?: string | null
          failure_reason?: string | null
          gross_amount?: number
          id?: string
          metadata?: Json
          mpesa_conversation_id?: string | null
          mpesa_result_code?: number | null
          mpesa_result_description?: string | null
          mpesa_transaction_id?: string | null
          originator_conversation_id?: string | null
          paid_at?: string | null
          payout_destination_phone?: string | null
          payout_destination_verified_at?: string | null
          payout_minimum?: number
          payout_phone?: string | null
          payout_phone_verified_at?: string | null
          payout_phone_verified_by?: string | null
          payout_provider?: string | null
          payout_reference?: string | null
          platform_fee_amount?: number
          platform_fee_percent?: number
          processing_at?: string | null
          processor_fee_amount?: number
          provider_net_amount?: number
          provider_phone?: string | null
          provider_user_id?: string | null
          refund_amount?: number
          result_code?: string | null
          result_description?: string | null
          service_profile_id?: string
          status?: string
          transaction_receipt?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_provider_payouts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "service_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_provider_payouts_service_profile_id_fkey"
            columns: ["service_profile_id"]
            isOneToOne: false
            referencedRelation: "service_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_staff: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string
          id: string
          identity_liveness_verified_at: string | null
          personal_photo_url: string | null
          service_profile_id: string
          status: string
          updated_at: string
          user_id: string | null
          verification_state: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name: string
          id?: string
          identity_liveness_verified_at?: string | null
          personal_photo_url?: string | null
          service_profile_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
          verification_state?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          identity_liveness_verified_at?: string | null
          personal_photo_url?: string | null
          service_profile_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          verification_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_staff_service_profile_id_fkey"
            columns: ["service_profile_id"]
            isOneToOne: false
            referencedRelation: "service_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_staff_availability: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          staff_id: string
          start_time: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          staff_id: string
          start_time: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          staff_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_staff_availability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      service_staff_blockouts: {
        Row: {
          ends_at: string
          id: string
          reason: string | null
          staff_id: string
          starts_at: string
        }
        Insert: {
          ends_at: string
          id?: string
          reason?: string | null
          staff_id: string
          starts_at: string
        }
        Update: {
          ends_at?: string
          id?: string
          reason?: string | null
          staff_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_staff_blockouts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      service_staff_claim_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          staff_id: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          staff_id: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          staff_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_staff_claim_tokens_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      service_staff_offerings: {
        Row: {
          created_at: string
          offering_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          offering_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          offering_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_staff_offerings_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_staff_offerings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          active: boolean
          city_id: string | null
          created_at: string
          id: string
          last_checked_at: string | null
          name: string
          source_type: string
          url: string
        }
        Insert: {
          active?: boolean
          city_id?: string | null
          created_at?: string
          id?: string
          last_checked_at?: string | null
          name: string
          source_type: string
          url: string
        }
        Update: {
          active?: boolean
          city_id?: string | null
          created_at?: string
          id?: string
          last_checked_at?: string | null
          name?: string
          source_type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_accounts: {
        Row: {
          accepted_at: string | null
          approved_at: string | null
          business_id: string
          completion_percent: number
          contact_name: string
          created_at: string
          id: string
          invitation_status: string
          invited_at: string
          onboarding_status: string
          partner_id: string | null
          prospect_id: string | null
          review_items: Json
          review_note: string | null
          review_requested_at: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          approved_at?: string | null
          business_id: string
          completion_percent?: number
          contact_name: string
          created_at?: string
          id?: string
          invitation_status?: string
          invited_at?: string
          onboarding_status?: string
          partner_id?: string | null
          prospect_id?: string | null
          review_items?: Json
          review_note?: string | null
          review_requested_at?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          approved_at?: string | null
          business_id?: string
          completion_percent?: number
          contact_name?: string
          created_at?: string
          id?: string
          invitation_status?: string
          invited_at?: string
          onboarding_status?: string
          partner_id?: string | null
          prospect_id?: string | null
          review_items?: Json
          review_note?: string | null
          review_requested_at?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_accounts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "safari_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_accounts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "ai_sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_followup_prep_runs: {
        Row: {
          checked_count: number
          completed_at: string
          error_message: string | null
          id: string
          prepared_count: number
          skipped_count: number
          started_at: string
          status: string
        }
        Insert: {
          checked_count?: number
          completed_at?: string
          error_message?: string | null
          id?: string
          prepared_count?: number
          skipped_count?: number
          started_at?: string
          status: string
        }
        Update: {
          checked_count?: number
          completed_at?: string
          error_message?: string | null
          id?: string
          prepared_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      supplier_onboarding_followup_drafts: {
        Row: {
          comparison: Json | null
          id: string
          message: string
          missing_requirements: Json
          prepared_at: string
          recipient_email: string
          status: string
          subject: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          comparison?: Json | null
          id?: string
          message: string
          missing_requirements?: Json
          prepared_at?: string
          recipient_email: string
          status?: string
          subject: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          comparison?: Json | null
          id?: string
          message?: string
          missing_requirements?: Json
          prepared_at?: string
          recipient_email?: string
          status?: string
          subject?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_onboarding_followup_drafts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_onboarding_followups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          missing_requirements: Json
          next_followup_due_at: string | null
          recipient_email: string
          sent_at: string
          status: string
          subject: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          missing_requirements?: Json
          next_followup_due_at?: string | null
          recipient_email: string
          sent_at?: string
          status?: string
          subject: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          missing_requirements?: Json
          next_followup_due_at?: string | null
          recipient_email?: string
          sent_at?: string
          status?: string
          subject?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_onboarding_followups_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_scout_jobs: {
        Row: {
          attempt_count: number
          category: string
          city: string
          claimed_at: string | null
          completed_at: string | null
          contact_ready_count: number
          created_at: string
          id: string
          inserted_count: number
          last_error: string | null
          max_attempts: number
          needs_research_count: number
          provider_response_id: string | null
          provider_status: string | null
          qualified_count: number
          queued_at: string
          status: string
        }
        Insert: {
          attempt_count?: number
          category: string
          city: string
          claimed_at?: string | null
          completed_at?: string | null
          contact_ready_count?: number
          created_at?: string
          id?: string
          inserted_count?: number
          last_error?: string | null
          max_attempts?: number
          needs_research_count?: number
          provider_response_id?: string | null
          provider_status?: string | null
          qualified_count?: number
          queued_at?: string
          status?: string
        }
        Update: {
          attempt_count?: number
          category?: string
          city?: string
          claimed_at?: string | null
          completed_at?: string | null
          contact_ready_count?: number
          created_at?: string
          id?: string
          inserted_count?: number
          last_error?: string | null
          max_attempts?: number
          needs_research_count?: number
          provider_response_id?: string | null
          provider_status?: string | null
          qualified_count?: number
          queued_at?: string
          status?: string
        }
        Relationships: []
      }
      transfer_booking_pricing_ledger: {
        Row: {
          booking_status: string
          checkout_intent_key: string | null
          confirmed_at: string | null
          created_at: string
          customer_currency: string
          customer_user_id: string
          exchange_rate: number | null
          id: string
          markup_percent: number
          metadata: Json
          paid_at: string | null
          payment_initiation_started_at: string | null
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string
          prepared_booking_id: string
          provider: string
          provider_booking_reference: string | null
          retail_amount: number
          supplier_amount: number
          supplier_currency: string
          supplier_settlement_status: string
          updated_at: string
        }
        Insert: {
          booking_status?: string
          checkout_intent_key?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_currency: string
          customer_user_id: string
          exchange_rate?: number | null
          id?: string
          markup_percent?: number
          metadata?: Json
          paid_at?: string | null
          payment_initiation_started_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          prepared_booking_id: string
          provider?: string
          provider_booking_reference?: string | null
          retail_amount: number
          supplier_amount: number
          supplier_currency: string
          supplier_settlement_status?: string
          updated_at?: string
        }
        Update: {
          booking_status?: string
          checkout_intent_key?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_currency?: string
          customer_user_id?: string
          exchange_rate?: number | null
          id?: string
          markup_percent?: number
          metadata?: Json
          paid_at?: string | null
          payment_initiation_started_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          prepared_booking_id?: string
          provider?: string
          provider_booking_reference?: string | null
          retail_amount?: number
          supplier_amount?: number
          supplier_currency?: string
          supplier_settlement_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      travel_refund_review_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          from_resolution: string | null
          from_status: string | null
          id: number
          ledger_id: string
          metadata: Json
          notes_snapshot: string | null
          product: string
          review_id: string
          to_resolution: string | null
          to_status: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          from_resolution?: string | null
          from_status?: string | null
          id?: never
          ledger_id: string
          metadata?: Json
          notes_snapshot?: string | null
          product: string
          review_id: string
          to_resolution?: string | null
          to_status: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          from_resolution?: string | null
          from_status?: string | null
          id?: never
          ledger_id?: string
          metadata?: Json
          notes_snapshot?: string | null
          product?: string
          review_id?: string
          to_resolution?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_refund_review_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "travel_refund_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_refund_reviews: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          ledger_id: string
          notes: string | null
          product: string
          provider: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          ledger_id: string
          notes?: string | null
          product: string
          provider: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          ledger_id?: string
          notes?: string | null
          product?: string
          provider?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      trip_items: {
        Row: {
          appointment_id: string | null
          booking_id: string | null
          city_id: string | null
          created_at: string
          driver_transfer_request_id: string | null
          end_at: string | null
          event_id: string | null
          food_order_id: string | null
          hotel_booking_pricing_ledger_id: string | null
          id: string
          item_kind: string
          local_request_id: string | null
          notes: string | null
          offering_id: string | null
          position: number
          start_at: string | null
          title: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          booking_id?: string | null
          city_id?: string | null
          created_at?: string
          driver_transfer_request_id?: string | null
          end_at?: string | null
          event_id?: string | null
          food_order_id?: string | null
          hotel_booking_pricing_ledger_id?: string | null
          id?: string
          item_kind: string
          local_request_id?: string | null
          notes?: string | null
          offering_id?: string | null
          position?: number
          start_at?: string | null
          title?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          booking_id?: string | null
          city_id?: string | null
          created_at?: string
          driver_transfer_request_id?: string | null
          end_at?: string | null
          event_id?: string | null
          food_order_id?: string | null
          hotel_booking_pricing_ledger_id?: string | null
          id?: string
          item_kind?: string
          local_request_id?: string | null
          notes?: string | null
          offering_id?: string | null
          position?: number
          start_at?: string | null
          title?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "service_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_driver_transfer_request_id_fkey"
            columns: ["driver_transfer_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transfer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_food_order_id_fkey"
            columns: ["food_order_id"]
            isOneToOne: false
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_hotel_booking_pricing_ledger_id_fkey"
            columns: ["hotel_booking_pricing_ledger_id"]
            isOneToOne: false
            referencedRelation: "hotel_booking_pricing_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_item_kind_fkey"
            columns: ["item_kind"]
            isOneToOne: false
            referencedRelation: "inventory_kinds"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "trip_items_local_request_id_fkey"
            columns: ["local_request_id"]
            isOneToOne: false
            referencedRelation: "local_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_package_checkout_attempts: {
        Row: {
          checked_at: string
          component_checks: Json
          component_count: number
          created_at: string
          currency: string
          expires_at: string | null
          hold_summary: Json
          id: string
          quote_id: string
          status: string
          subtotal: number
          traveler_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          checked_at?: string
          component_checks?: Json
          component_count?: number
          created_at?: string
          currency: string
          expires_at?: string | null
          hold_summary?: Json
          id?: string
          quote_id: string
          status?: string
          subtotal: number
          traveler_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          checked_at?: string
          component_checks?: Json
          component_count?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          hold_summary?: Json
          id?: string
          quote_id?: string
          status?: string
          subtotal?: number
          traveler_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_package_checkout_attempts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trip_package_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_package_checkout_attempts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_package_payment_intents: {
        Row: {
          amount: number
          checkout_attempt_id: string
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          provider: string
          provider_payload: Json
          provider_reference: string | null
          quote_id: string
          status: string
          traveler_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          checkout_attempt_id: string
          created_at?: string
          currency: string
          id?: string
          idempotency_key: string
          provider: string
          provider_payload?: Json
          provider_reference?: string | null
          quote_id: string
          status?: string
          traveler_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          checkout_attempt_id?: string
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          provider?: string
          provider_payload?: Json
          provider_reference?: string | null
          quote_id?: string
          status?: string
          traveler_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_package_payment_intents_checkout_attempt_id_fkey"
            columns: ["checkout_attempt_id"]
            isOneToOne: false
            referencedRelation: "trip_package_checkout_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_package_payment_intents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trip_package_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_package_payment_intents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_package_quotes: {
        Row: {
          component_count: number
          components: Json
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          pricing_basis: string
          status: string
          subtotal: number
          traveler_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          component_count?: number
          components?: Json
          created_at?: string
          currency: string
          expires_at?: string | null
          id?: string
          pricing_basis?: string
          status?: string
          subtotal: number
          traveler_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          component_count?: number
          components?: Json
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          pricing_basis?: string
          status?: string
          subtotal?: number
          traveler_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_package_quotes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cover_image_url: string | null
          created_at: string
          destination_city_id: string | null
          end_on: string | null
          id: string
          share_token: string | null
          start_on: string | null
          status: string
          title: string | null
          traveler_id: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          destination_city_id?: string | null
          end_on?: string | null
          id?: string
          share_token?: string | null
          start_on?: string | null
          status?: string
          title?: string | null
          traveler_id: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          destination_city_id?: string | null
          end_on?: string | null
          id?: string
          share_token?: string | null
          start_on?: string | null
          status?: string
          title?: string | null
          traveler_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_destination_city_id_fkey"
            columns: ["destination_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          accessibility: boolean
          category: string | null
          created_at: string
          driver_id: string
          id: string
          insurance_compliance_status: string
          insurance_document_path: string | null
          insurance_document_uploaded_at: string | null
          insurance_expires_on: string | null
          insurance_policy_number: string | null
          luggage_capacity: number | null
          make_model: string | null
          passenger_capacity: number | null
          provider_id: string | null
          registration_compliance_status: string
          registration_document_path: string | null
          registration_document_uploaded_at: string | null
          registration_expires_on: string | null
          registration_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accessibility?: boolean
          category?: string | null
          created_at?: string
          driver_id: string
          id?: string
          insurance_compliance_status?: string
          insurance_document_path?: string | null
          insurance_document_uploaded_at?: string | null
          insurance_expires_on?: string | null
          insurance_policy_number?: string | null
          luggage_capacity?: number | null
          make_model?: string | null
          passenger_capacity?: number | null
          provider_id?: string | null
          registration_compliance_status?: string
          registration_document_path?: string | null
          registration_document_uploaded_at?: string | null
          registration_expires_on?: string | null
          registration_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accessibility?: boolean
          category?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          insurance_compliance_status?: string
          insurance_document_path?: string | null
          insurance_document_uploaded_at?: string | null
          insurance_expires_on?: string | null
          insurance_policy_number?: string | null
          luggage_capacity?: number | null
          make_model?: string | null
          passenger_capacity?: number | null
          provider_id?: string | null
          registration_compliance_status?: string
          registration_document_path?: string | null
          registration_document_uploaded_at?: string | null
          registration_expires_on?: string | null
          registration_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_compliance_overview"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_cases: {
        Row: {
          created_at: string
          expires_at: string | null
          external_id: string | null
          id: string
          notes: string | null
          provider: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          subject_id: string
          subject_type: string
          updated_at: string
          verification_level: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          notes?: string | null
          provider?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          subject_id: string
          subject_type: string
          updated_at?: string
          verification_level?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          notes?: string | null
          provider?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          subject_id?: string
          subject_type?: string
          updated_at?: string
          verification_level?: string
        }
        Relationships: []
      }
      verification_events: {
        Row: {
          actor: string | null
          case_id: string
          created_at: string
          event_type: string
          external_ref: string | null
          from_status: string | null
          id: string
          metadata: Json
          provider: string | null
          provider_event_id: string | null
          reason: string | null
          to_status: string | null
        }
        Insert: {
          actor?: string | null
          case_id: string
          created_at?: string
          event_type: string
          external_ref?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          provider?: string | null
          provider_event_id?: string | null
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          actor?: string | null
          case_id?: string
          created_at?: string
          event_type?: string
          external_ref?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          provider?: string | null
          provider_event_id?: string | null
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "verification_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_evidence: {
        Row: {
          case_id: string
          created_at: string
          evidence_type: string
          expires_at: string | null
          external_ref: string | null
          id: string
          metadata: Json
          provider: string
          rejection_reason: string | null
          reviewed_at: string | null
          status: string
          storage_ref: string | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          evidence_type: string
          expires_at?: string | null
          external_ref?: string | null
          id?: string
          metadata?: Json
          provider?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string
          storage_ref?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          evidence_type?: string
          expires_at?: string | null
          external_ref?: string | null
          id?: string
          metadata?: Json
          provider?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string
          storage_ref?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "verification_cases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      driver_compliance_overview: {
        Row: {
          display_name: string | null
          driver_id: string | null
          driving_license_expires_on: string | null
          driving_license_number: string | null
          driving_license_status: string | null
          insurance_expires_on: string | null
          insurance_policy_number: string | null
          insurance_status: string | null
          make_model: string | null
          registration_expires_on: string | null
          registration_number: string | null
          registration_status: string | null
          service_status: string | null
          vehicle_id: string | null
          verification_state: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_supplier_after_review: {
        Args: { p_supplier_id: string }
        Returns: undefined
      }
      apply_driver_verification_state: {
        Args: { p_case_id: string; p_driver_id: string; p_state: string }
        Returns: undefined
      }
      apply_service_payment_webhook: {
        Args: {
          p_appointment_id: string
          p_paid_at?: string
          p_payment_reference: string
          p_refunded_amount?: number
          p_status: string
        }
        Returns: {
          cancellation_reason: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_fee_amount: number
          customer_fee_percent: number
          customer_name: string
          customer_notes: string | null
          customer_phone: string | null
          customer_total_amount: number
          customer_user_id: string | null
          ends_at: string
          id: string
          offering_id: string
          paid_at: string | null
          payment_reference: string | null
          payment_status: string
          payout_minimum: number
          price: number
          provider_net_amount: number
          provider_notes: string | null
          public_id: string
          service_fee_amount: number
          service_fee_minimum: number
          service_fee_percent: number
          service_profile_id: string
          staff_id: string
          starts_at: string
          status: string
          trip_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_service_provider_payout_result:
        | {
            Args: {
              p_conversation_id: string
              p_metadata?: Json
              p_payout_id: string
              p_result_code: number
              p_result_description: string
              p_succeeded: boolean
              p_transaction_receipt: string
            }
            Returns: {
              appointment_id: string
              approval_user_id: string | null
              approved_at: string | null
              approved_by: string | null
              conversation_id: string | null
              created_at: string
              currency: string
              eligible_at: string | null
              failure_reason: string | null
              gross_amount: number
              id: string
              metadata: Json
              mpesa_conversation_id: string | null
              mpesa_result_code: number | null
              mpesa_result_description: string | null
              mpesa_transaction_id: string | null
              originator_conversation_id: string | null
              paid_at: string | null
              payout_destination_phone: string | null
              payout_destination_verified_at: string | null
              payout_minimum: number
              payout_phone: string | null
              payout_phone_verified_at: string | null
              payout_phone_verified_by: string | null
              payout_provider: string | null
              payout_reference: string | null
              platform_fee_amount: number
              platform_fee_percent: number
              processing_at: string | null
              processor_fee_amount: number
              provider_net_amount: number
              provider_phone: string | null
              provider_user_id: string | null
              refund_amount: number
              result_code: string | null
              result_description: string | null
              service_profile_id: string
              status: string
              transaction_receipt: string | null
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "service_provider_payouts"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_conversation_id: string
              p_reference: string
              p_result_code: string
              p_result_description: string
              p_status: string
              payout_id: string
            }
            Returns: {
              appointment_id: string
              approval_user_id: string | null
              approved_at: string | null
              approved_by: string | null
              conversation_id: string | null
              created_at: string
              currency: string
              eligible_at: string | null
              failure_reason: string | null
              gross_amount: number
              id: string
              metadata: Json
              mpesa_conversation_id: string | null
              mpesa_result_code: number | null
              mpesa_result_description: string | null
              mpesa_transaction_id: string | null
              originator_conversation_id: string | null
              paid_at: string | null
              payout_destination_phone: string | null
              payout_destination_verified_at: string | null
              payout_minimum: number
              payout_phone: string | null
              payout_phone_verified_at: string | null
              payout_phone_verified_by: string | null
              payout_provider: string | null
              payout_reference: string | null
              platform_fee_amount: number
              platform_fee_percent: number
              processing_at: string | null
              processor_fee_amount: number
              provider_net_amount: number
              provider_phone: string | null
              provider_user_id: string | null
              refund_amount: number
              result_code: string | null
              result_description: string | null
              service_profile_id: string
              status: string
              transaction_receipt: string | null
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "service_provider_payouts"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      approve_service_provider_payout: {
        Args: { p_payout_id: string }
        Returns: {
          appointment_id: string
          approval_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          eligible_at: string | null
          failure_reason: string | null
          gross_amount: number
          id: string
          metadata: Json
          mpesa_conversation_id: string | null
          mpesa_result_code: number | null
          mpesa_result_description: string | null
          mpesa_transaction_id: string | null
          originator_conversation_id: string | null
          paid_at: string | null
          payout_destination_phone: string | null
          payout_destination_verified_at: string | null
          payout_minimum: number
          payout_phone: string | null
          payout_phone_verified_at: string | null
          payout_phone_verified_by: string | null
          payout_provider: string | null
          payout_reference: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          processing_at: string | null
          processor_fee_amount: number
          provider_net_amount: number
          provider_phone: string | null
          provider_user_id: string | null
          refund_amount: number
          result_code: string | null
          result_description: string | null
          service_profile_id: string
          status: string
          transaction_receipt: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_provider_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_service_provider_payout_as_admin: {
        Args: { p_admin_user_id: string; p_payout_id: string }
        Returns: {
          appointment_id: string
          approval_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          eligible_at: string | null
          failure_reason: string | null
          gross_amount: number
          id: string
          metadata: Json
          mpesa_conversation_id: string | null
          mpesa_result_code: number | null
          mpesa_result_description: string | null
          mpesa_transaction_id: string | null
          originator_conversation_id: string | null
          paid_at: string | null
          payout_destination_phone: string | null
          payout_destination_verified_at: string | null
          payout_minimum: number
          payout_phone: string | null
          payout_phone_verified_at: string | null
          payout_phone_verified_by: string | null
          payout_provider: string | null
          payout_reference: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          processing_at: string | null
          processor_fee_amount: number
          provider_net_amount: number
          provider_phone: string | null
          provider_user_id: string | null
          refund_amount: number
          result_code: string | null
          result_description: string | null
          service_profile_id: string
          status: string
          transaction_receipt: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_provider_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_service_appointment_to_trip: {
        Args: {
          p_appointment_id: string
          p_traveler_id: string
          p_trip_id: string
        }
        Returns: {
          appointment_id: string | null
          booking_id: string | null
          city_id: string | null
          created_at: string
          driver_transfer_request_id: string | null
          end_at: string | null
          event_id: string | null
          food_order_id: string | null
          hotel_booking_pricing_ledger_id: string | null
          id: string
          item_kind: string
          local_request_id: string | null
          notes: string | null
          offering_id: string | null
          position: number
          start_at: string | null
          title: string | null
          trip_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trip_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_driver_transfer_request: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          currency: string
          destination_label: string
          driver_id: string
          id: string
          notes: string | null
          passenger_count: number
          pickup_label: string
          quoted_amount: number | null
          requested_at: string
          status: string
          transfer_rate_id: string | null
          traveler_id: string
          trip_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "driver_transfer_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_next_ai_scout_job: {
        Args: never
        Returns: {
          attempt_count: number
          category: string
          id: string
          location: string
          max_attempts: number
        }[]
      }
      claim_next_supplier_scout_job: {
        Args: never
        Returns: {
          attempt_count: number
          category: string
          city: string
          claimed_at: string | null
          completed_at: string | null
          contact_ready_count: number
          created_at: string
          id: string
          inserted_count: number
          last_error: string | null
          max_attempts: number
          needs_research_count: number
          provider_response_id: string | null
          provider_status: string | null
          qualified_count: number
          queued_at: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "supplier_scout_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_service_provider_payout: {
        Args: { p_payout_id: string }
        Returns: {
          appointment_id: string
          approval_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          eligible_at: string | null
          failure_reason: string | null
          gross_amount: number
          id: string
          metadata: Json
          mpesa_conversation_id: string | null
          mpesa_result_code: number | null
          mpesa_result_description: string | null
          mpesa_transaction_id: string | null
          originator_conversation_id: string | null
          paid_at: string | null
          payout_destination_phone: string | null
          payout_destination_verified_at: string | null
          payout_minimum: number
          payout_phone: string | null
          payout_phone_verified_at: string | null
          payout_phone_verified_by: string | null
          payout_provider: string | null
          payout_reference: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          processing_at: string | null
          processor_fee_amount: number
          provider_net_amount: number
          provider_phone: string | null
          provider_user_id: string | null
          refund_amount: number
          result_code: string | null
          result_description: string | null
          service_profile_id: string
          status: string
          transaction_receipt: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_provider_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_concierge_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      create_service_appointment: {
        Args: {
          p_customer_email: string
          p_customer_name: string
          p_customer_notes?: string
          p_customer_phone: string
          p_customer_user_id: string
          p_offering_id: string
          p_service_profile_id: string
          p_staff_id: string
          p_starts_at: string
        }
        Returns: {
          cancellation_reason: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_fee_amount: number
          customer_fee_percent: number
          customer_name: string
          customer_notes: string | null
          customer_phone: string | null
          customer_total_amount: number
          customer_user_id: string | null
          ends_at: string
          id: string
          offering_id: string
          paid_at: string | null
          payment_reference: string | null
          payment_status: string
          payout_minimum: number
          price: number
          provider_net_amount: number
          provider_notes: string | null
          public_id: string
          service_fee_amount: number
          service_fee_minimum: number
          service_fee_percent: number
          service_profile_id: string
          staff_id: string
          starts_at: string
          status: string
          trip_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_service_payment_ledger_entry: {
        Args: { p_appointment_id: string }
        Returns: {
          appointment_id: string
          created_at: string
          currency: string
          customer_fee_amount: number
          customer_fee_percent: number
          customer_total_amount: number
          gross_amount: number
          id: string
          paid_at: string | null
          payment_reference: string | null
          payout_minimum: number
          platform_fee_amount: number
          platform_fee_percent: number
          provider_net_amount: number
          provider_reference: string | null
          refunded_amount: number
          service_fee_minimum: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_payment_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_service_provider_payout_entry: {
        Args: { p_appointment_id: string }
        Returns: {
          appointment_id: string
          approval_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          eligible_at: string | null
          failure_reason: string | null
          gross_amount: number
          id: string
          metadata: Json
          mpesa_conversation_id: string | null
          mpesa_result_code: number | null
          mpesa_result_description: string | null
          mpesa_transaction_id: string | null
          originator_conversation_id: string | null
          paid_at: string | null
          payout_destination_phone: string | null
          payout_destination_verified_at: string | null
          payout_minimum: number
          payout_phone: string | null
          payout_phone_verified_at: string | null
          payout_phone_verified_by: string | null
          payout_provider: string | null
          payout_reference: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          processing_at: string | null
          processor_fee_amount: number
          provider_net_amount: number
          provider_phone: string | null
          provider_user_id: string | null
          refund_amount: number
          result_code: string | null
          result_description: string | null
          service_profile_id: string
          status: string
          transaction_receipt: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_provider_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_service_provider_payout_for_completed_appointment: {
        Args: { p_appointment_id: string }
        Returns: string
      }
      detach_service_appointment_from_trip: {
        Args: { p_item_id: string; p_traveler_id: string; p_trip_id: string }
        Returns: {
          appointment_id: string | null
          booking_id: string | null
          city_id: string | null
          created_at: string
          driver_transfer_request_id: string | null
          end_at: string | null
          event_id: string | null
          food_order_id: string | null
          hotel_booking_pricing_ledger_id: string | null
          id: string
          item_kind: string
          local_request_id: string | null
          notes: string | null
          offering_id: string | null
          position: number
          start_at: string | null
          title: string | null
          trip_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trip_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_old_events: { Args: never; Returns: undefined }
      finalize_restaurant_refund: {
        Args: {
          p_amount: number
          p_refund_id: string
          p_refund_reference: string
        }
        Returns: {
          status: string
          success: boolean
        }[]
      }
      generate_completed_service_provider_payouts: {
        Args: never
        Returns: number
      }
      get_admin_role: { Args: never; Returns: string }
      hold_service_provider_payout: {
        Args: { p_payout_id: string; p_reason: string }
        Returns: {
          appointment_id: string
          approval_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          eligible_at: string | null
          failure_reason: string | null
          gross_amount: number
          id: string
          metadata: Json
          mpesa_conversation_id: string | null
          mpesa_result_code: number | null
          mpesa_result_description: string | null
          mpesa_transaction_id: string | null
          originator_conversation_id: string | null
          paid_at: string | null
          payout_destination_phone: string | null
          payout_destination_verified_at: string | null
          payout_minimum: number
          payout_phone: string | null
          payout_phone_verified_at: string | null
          payout_phone_verified_by: string | null
          payout_provider: string | null
          payout_reference: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          processing_at: string | null
          processor_fee_amount: number
          provider_net_amount: number
          provider_phone: string | null
          provider_user_id: string | null
          refund_amount: number
          result_code: string | null
          result_description: string | null
          service_profile_id: string
          status: string
          transaction_receipt: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_provider_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      invoke_ai_scout_worker: { Args: never; Returns: number }
      invoke_supplier_scout_worker: { Args: never; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      lease_ai_scout_running_jobs: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempt_count: number
          category: string
          id: string
          location: string
          max_attempts: number
          provider_response_id: string
          provider_status: string
          worker_stage: string
        }[]
      }
      prepare_service_provider_payout: {
        Args: { payout_id: string }
        Returns: {
          appointment_id: string
          approval_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          eligible_at: string | null
          failure_reason: string | null
          gross_amount: number
          id: string
          metadata: Json
          mpesa_conversation_id: string | null
          mpesa_result_code: number | null
          mpesa_result_description: string | null
          mpesa_transaction_id: string | null
          originator_conversation_id: string | null
          paid_at: string | null
          payout_destination_phone: string | null
          payout_destination_verified_at: string | null
          payout_minimum: number
          payout_phone: string | null
          payout_phone_verified_at: string | null
          payout_phone_verified_by: string | null
          payout_provider: string | null
          payout_reference: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          processing_at: string | null
          processor_fee_amount: number
          provider_net_amount: number
          provider_phone: string | null
          provider_user_id: string | null
          refund_amount: number
          result_code: string | null
          result_description: string | null
          service_profile_id: string
          status: string
          transaction_receipt: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_provider_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reconcile_service_provider_payouts: { Args: never; Returns: number }
      refresh_driver_compliance: { Args: never; Returns: number }
      release_ai_scout_lease: { Args: { p_owner: string }; Returns: boolean }
      reorder_trip_items: {
        Args: { p_item_ids: string[]; p_traveler_id: string; p_trip_id: string }
        Returns: undefined
      }
      requeue_stale_ai_scout_jobs: {
        Args: { p_stale_minutes?: number }
        Returns: number
      }
      requeue_transient_ai_scout_failures: { Args: never; Returns: number }
      reschedule_service_appointment: {
        Args: {
          p_appointment_id: string
          p_customer_user_id: string
          p_note?: string
          p_starts_at: string
        }
        Returns: {
          cancellation_reason: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_fee_amount: number
          customer_fee_percent: number
          customer_name: string
          customer_notes: string | null
          customer_phone: string | null
          customer_total_amount: number
          customer_user_id: string | null
          ends_at: string
          id: string
          offering_id: string
          paid_at: string | null
          payment_reference: string | null
          payment_status: string
          payout_minimum: number
          price: number
          provider_net_amount: number
          provider_notes: string | null
          public_id: string
          service_fee_amount: number
          service_fee_minimum: number
          service_fee_percent: number
          service_profile_id: string
          staff_id: string
          starts_at: string
          status: string
          trip_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_to_driver_transfer_request: {
        Args: { p_decision: string; p_request_id: string }
        Returns: {
          created_at: string
          currency: string
          destination_label: string
          driver_id: string
          id: string
          notes: string | null
          passenger_count: number
          pickup_label: string
          quoted_amount: number | null
          requested_at: string
          status: string
          transfer_rate_id: string | null
          traveler_id: string
          trip_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "driver_transfer_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      service_provider_verification_ready: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      set_service_provider_payout_status: {
        Args: {
          p_failure_reason?: string
          p_payout_id: string
          p_provider?: string
          p_reference?: string
          p_status: string
        }
        Returns: {
          appointment_id: string
          approval_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          eligible_at: string | null
          failure_reason: string | null
          gross_amount: number
          id: string
          metadata: Json
          mpesa_conversation_id: string | null
          mpesa_result_code: number | null
          mpesa_result_description: string | null
          mpesa_transaction_id: string | null
          originator_conversation_id: string | null
          paid_at: string | null
          payout_destination_phone: string | null
          payout_destination_verified_at: string | null
          payout_minimum: number
          payout_phone: string | null
          payout_phone_verified_at: string | null
          payout_phone_verified_by: string | null
          payout_provider: string | null
          payout_reference: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          processing_at: string | null
          processor_fee_amount: number
          provider_net_amount: number
          provider_phone: string | null
          provider_user_id: string | null
          refund_amount: number
          result_code: string | null
          result_description: string | null
          service_profile_id: string
          status: string
          transaction_receipt: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_provider_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_supplier_for_review: {
        Args: { p_supplier_id: string; p_user_id: string }
        Returns: number
      }
      supplier_completion: { Args: { p_business_id: string }; Returns: number }
      transition_service_appointment_status: {
        Args: {
          p_actor_type: string
          p_actor_user_id?: string
          p_appointment_id: string
          p_note?: string
          p_to_status: string
        }
        Returns: {
          cancellation_reason: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_fee_amount: number
          customer_fee_percent: number
          customer_name: string
          customer_notes: string | null
          customer_phone: string | null
          customer_total_amount: number
          customer_user_id: string | null
          ends_at: string
          id: string
          offering_id: string
          paid_at: string | null
          payment_reference: string | null
          payment_status: string
          payout_minimum: number
          price: number
          provider_net_amount: number
          provider_notes: string | null
          public_id: string
          service_fee_amount: number
          service_fee_minimum: number
          service_fee_percent: number
          service_profile_id: string
          staff_id: string
          starts_at: string
          status: string
          trip_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      try_acquire_ai_scout_lease: {
        Args: { p_lease_seconds?: number; p_owner: string }
        Returns: boolean
      }
      verify_ai_scout_worker_token: {
        Args: { p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
