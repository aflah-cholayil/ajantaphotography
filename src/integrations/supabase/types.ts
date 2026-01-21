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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      albums: {
        Row: {
          client_id: string
          cover_image_key: string | null
          created_at: string
          description: string | null
          face_processing_completed_at: string | null
          face_processing_started_at: string | null
          face_processing_status: string | null
          id: string
          ready_at: string | null
          status: Database["public"]["Enums"]["album_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          cover_image_key?: string | null
          created_at?: string
          description?: string | null
          face_processing_completed_at?: string | null
          face_processing_started_at?: string | null
          face_processing_status?: string | null
          id?: string
          ready_at?: string | null
          status?: Database["public"]["Enums"]["album_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          cover_image_key?: string | null
          created_at?: string
          description?: string | null
          face_processing_completed_at?: string | null
          face_processing_started_at?: string | null
          face_processing_status?: string | null
          id?: string
          ready_at?: string | null
          status?: Database["public"]["Enums"]["album_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          admin_notes: string | null
          client_email: string
          client_name: string
          created_at: string
          event_date: string | null
          event_type: string
          id: string
          message: string | null
          phone: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          client_email: string
          client_name: string
          created_at?: string
          event_date?: string | null
          event_type: string
          id?: string
          message?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          client_email?: string
          client_name?: string
          created_at?: string
          event_date?: string | null
          event_type?: string
          id?: string
          message?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          event_date: string | null
          event_name: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          event_name: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          event_name?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          phone?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      detected_faces: {
        Row: {
          album_id: string
          bounding_box: Json | null
          confidence: number | null
          created_at: string
          external_image_id: string | null
          face_id: string | null
          id: string
          media_id: string
          person_id: string | null
        }
        Insert: {
          album_id: string
          bounding_box?: Json | null
          confidence?: number | null
          created_at?: string
          external_image_id?: string | null
          face_id?: string | null
          id?: string
          media_id: string
          person_id?: string | null
        }
        Update: {
          album_id?: string
          bounding_box?: Json | null
          confidence?: number | null
          created_at?: string
          external_image_id?: string | null
          face_id?: string | null
          id?: string
          media_id?: string
          person_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "detected_faces_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detected_faces_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detected_faces_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          client_id: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          template_type: string
          to_email: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          template_type: string
          to_email: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          template_type?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      event_questionnaires: {
        Row: {
          additional_instructions: string | null
          album_required: boolean | null
          booking_id: string
          confirmed: boolean | null
          created_at: string
          cultural_notes: string | null
          drone_coverage: boolean | null
          event_date: string | null
          event_end_time: string | null
          event_start_time: string | null
          event_type: string | null
          expected_delivery_timeline: string | null
          id: string
          important_family_members: string | null
          is_editable: boolean
          is_locked: boolean
          must_capture_moments: string | null
          number_of_days: number | null
          photography_required: boolean | null
          photography_style: string[] | null
          primary_contact_names: string | null
          reference_links: string[] | null
          status: Database["public"]["Enums"]["questionnaire_status"]
          submitted_at: string | null
          token: string
          updated_at: string
          venue_location: string | null
          venue_name: string | null
          venue_rules: string | null
          video_types: string[] | null
          videography_required: boolean | null
          vip_focus_list: string | null
        }
        Insert: {
          additional_instructions?: string | null
          album_required?: boolean | null
          booking_id: string
          confirmed?: boolean | null
          created_at?: string
          cultural_notes?: string | null
          drone_coverage?: boolean | null
          event_date?: string | null
          event_end_time?: string | null
          event_start_time?: string | null
          event_type?: string | null
          expected_delivery_timeline?: string | null
          id?: string
          important_family_members?: string | null
          is_editable?: boolean
          is_locked?: boolean
          must_capture_moments?: string | null
          number_of_days?: number | null
          photography_required?: boolean | null
          photography_style?: string[] | null
          primary_contact_names?: string | null
          reference_links?: string[] | null
          status?: Database["public"]["Enums"]["questionnaire_status"]
          submitted_at?: string | null
          token?: string
          updated_at?: string
          venue_location?: string | null
          venue_name?: string | null
          venue_rules?: string | null
          video_types?: string[] | null
          videography_required?: boolean | null
          vip_focus_list?: string | null
        }
        Update: {
          additional_instructions?: string | null
          album_required?: boolean | null
          booking_id?: string
          confirmed?: boolean | null
          created_at?: string
          cultural_notes?: string | null
          drone_coverage?: boolean | null
          event_date?: string | null
          event_end_time?: string | null
          event_start_time?: string | null
          event_type?: string | null
          expected_delivery_timeline?: string | null
          id?: string
          important_family_members?: string | null
          is_editable?: boolean
          is_locked?: boolean
          must_capture_moments?: string | null
          number_of_days?: number | null
          photography_required?: boolean | null
          photography_style?: string[] | null
          primary_contact_names?: string | null
          reference_links?: string[] | null
          status?: Database["public"]["Enums"]["questionnaire_status"]
          submitted_at?: string | null
          token?: string
          updated_at?: string
          venue_location?: string | null
          venue_name?: string | null
          venue_rules?: string | null
          video_types?: string[] | null
          videography_required?: boolean | null
          vip_focus_list?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_questionnaires_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          album_id: string
          created_at: string
          duration: number | null
          file_name: string
          height: number | null
          id: string
          mime_type: string
          s3_key: string
          s3_preview_key: string | null
          size: number
          sort_order: number | null
          type: Database["public"]["Enums"]["media_type"]
          width: number | null
        }
        Insert: {
          album_id: string
          created_at?: string
          duration?: number | null
          file_name: string
          height?: number | null
          id?: string
          mime_type: string
          s3_key: string
          s3_preview_key?: string | null
          size: number
          sort_order?: number | null
          type?: Database["public"]["Enums"]["media_type"]
          width?: number | null
        }
        Update: {
          album_id?: string
          created_at?: string
          duration?: number | null
          file_name?: string
          height?: number | null
          id?: string
          mime_type?: string
          s3_key?: string
          s3_preview_key?: string | null
          size?: number
          sort_order?: number | null
          type?: Database["public"]["Enums"]["media_type"]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      media_favorites: {
        Row: {
          album_id: string
          created_at: string
          id: string
          media_id: string
          user_id: string
        }
        Insert: {
          album_id: string
          created_at?: string
          id?: string
          media_id: string
          user_id: string
        }
        Update: {
          album_id?: string
          created_at?: string
          id?: string
          media_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_favorites_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_favorites_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          album_id: string
          created_at: string
          face_thumbnail_key: string | null
          id: string
          is_hidden: boolean | null
          name: string | null
          photo_count: number | null
          updated_at: string
        }
        Insert: {
          album_id: string
          created_at?: string
          face_thumbnail_key?: string | null
          id?: string
          is_hidden?: boolean | null
          name?: string | null
          photo_count?: number | null
          updated_at?: string
        }
        Update: {
          album_id?: string
          created_at?: string
          face_thumbnail_key?: string | null
          id?: string
          is_hidden?: boolean | null
          name?: string | null
          photo_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          last_login: string | null
          must_change_password: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          must_change_password?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          must_change_password?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_type: string
          created_at: string
          expires_at: string
          id: string
          ip_address: string
        }
        Insert: {
          action_type: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address: string
        }
        Update: {
          action_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      share_links: {
        Row: {
          album_id: string
          allow_download: boolean
          created_at: string
          download_count: number
          expires_at: string | null
          id: string
          password_hash: string | null
          token: string
          view_count: number
        }
        Insert: {
          album_id: string
          allow_download?: boolean
          created_at?: string
          download_count?: number
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          token?: string
          view_count?: number
        }
        Update: {
          album_id?: string
          allow_download?: boolean
          created_at?: string
          download_count?: number
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "share_links_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      works: {
        Row: {
          category: Database["public"]["Enums"]["work_category"]
          created_at: string
          description: string | null
          height: number | null
          id: string
          mime_type: string | null
          s3_key: string
          s3_preview_key: string | null
          show_on_gallery: boolean
          show_on_home: boolean
          size: number | null
          sort_order: number | null
          status: Database["public"]["Enums"]["work_status"]
          title: string
          type: Database["public"]["Enums"]["work_type"]
          updated_at: string
          width: number | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["work_category"]
          created_at?: string
          description?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          s3_key: string
          s3_preview_key?: string | null
          show_on_gallery?: boolean
          show_on_home?: boolean
          size?: number | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["work_status"]
          title: string
          type?: Database["public"]["Enums"]["work_type"]
          updated_at?: string
          width?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["work_category"]
          created_at?: string
          description?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          s3_key?: string
          s3_preview_key?: string | null
          show_on_gallery?: boolean
          show_on_home?: boolean
          size?: number | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["work_status"]
          title?: string
          type?: Database["public"]["Enums"]["work_type"]
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_users_view: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string | null
          is_active: boolean | null
          last_login: string | null
          name: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_view_admin_data: { Args: { _user_id: string }; Returns: boolean }
      cleanup_expired_rate_limits: { Args: never; Returns: undefined }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      album_status: "pending" | "ready"
      app_role: "admin" | "client" | "owner" | "editor" | "viewer"
      booking_status: "new" | "contacted" | "confirmed" | "cancelled"
      email_status: "sent" | "failed" | "pending"
      media_type: "photo" | "video"
      questionnaire_status: "not_sent" | "sent" | "completed"
      work_category: "wedding" | "pre-wedding" | "event" | "candid" | "other"
      work_status: "active" | "hidden"
      work_type: "photo" | "video"
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
      album_status: ["pending", "ready"],
      app_role: ["admin", "client", "owner", "editor", "viewer"],
      booking_status: ["new", "contacted", "confirmed", "cancelled"],
      email_status: ["sent", "failed", "pending"],
      media_type: ["photo", "video"],
      questionnaire_status: ["not_sent", "sent", "completed"],
      work_category: ["wedding", "pre-wedding", "event", "candid", "other"],
      work_status: ["active", "hidden"],
      work_type: ["photo", "video"],
    },
  },
} as const
