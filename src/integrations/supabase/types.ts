export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action_description: string
          action_type: string
          admin_telegram_id: string
          affected_record_id: string | null
          affected_table: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action_description: string
          action_type: string
          admin_telegram_id: string
          affected_record_id?: string | null
          affected_table?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action_description?: string
          action_type?: string
          admin_telegram_id?: string
          affected_record_id?: string | null
          affected_table?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: []
      }
      auto_reply_templates: {
        Row: {
          conditions: Json | null
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean
          message_template: string
          name: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          message_template: string
          name: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          message_template?: string
          name?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string
          currency: string
          display_order: number | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          created_at?: string
          currency?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          currency?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bot_content: {
        Row: {
          content_key: string
          content_type: string
          content_value: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          last_modified_by: string | null
          updated_at: string
        }
        Insert: {
          content_key: string
          content_type?: string
          content_value: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_modified_by?: string | null
          updated_at?: string
        }
        Update: {
          content_key?: string
          content_type?: string
          content_value?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_modified_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          setting_key: string
          setting_type: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          setting_key: string
          setting_type?: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          setting_key?: string
          setting_type?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_users: {
        Row: {
          created_at: string
          current_plan_id: string | null
          first_name: string | null
          follow_up_count: number | null
          id: string
          is_admin: boolean | null
          is_vip: boolean
          last_follow_up: string | null
          last_name: string | null
          notes: string | null
          subscription_expires_at: string | null
          telegram_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          current_plan_id?: string | null
          first_name?: string | null
          follow_up_count?: number | null
          id?: string
          is_admin?: boolean | null
          is_vip?: boolean
          last_follow_up?: string | null
          last_name?: string | null
          notes?: string | null
          subscription_expires_at?: string | null
          telegram_id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          current_plan_id?: string | null
          first_name?: string | null
          follow_up_count?: number | null
          id?: string
          is_admin?: boolean | null
          is_vip?: boolean
          last_follow_up?: string | null
          last_name?: string | null
          notes?: string | null
          subscription_expires_at?: string | null
          telegram_id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_users_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_messages: {
        Row: {
          content: string | null
          created_at: string | null
          delivery_status: string | null
          failed_deliveries: number | null
          id: string
          media_file_id: string | null
          scheduled_at: string | null
          sent_at: string | null
          successful_deliveries: number | null
          target_audience: Json | null
          title: string
          total_recipients: number | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivery_status?: string | null
          failed_deliveries?: number | null
          id?: string
          media_file_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          successful_deliveries?: number | null
          target_audience?: Json | null
          title: string
          total_recipients?: number | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivery_status?: string | null
          failed_deliveries?: number | null
          id?: string
          media_file_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          successful_deliveries?: number | null
          target_audience?: Json | null
          title?: string
          total_recipients?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_messages_media_file_id_fkey"
            columns: ["media_file_id"]
            isOneToOne: false
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_tracking: {
        Row: {
          conversion_data: Json | null
          conversion_type: string
          conversion_value: number | null
          created_at: string
          funnel_step: number | null
          id: string
          plan_id: string | null
          promo_code: string | null
          telegram_user_id: string
        }
        Insert: {
          conversion_data?: Json | null
          conversion_type: string
          conversion_value?: number | null
          created_at?: string
          funnel_step?: number | null
          id?: string
          plan_id?: string | null
          promo_code?: string | null
          telegram_user_id: string
        }
        Update: {
          conversion_data?: Json | null
          conversion_type?: string
          conversion_value?: number | null
          created_at?: string
          funnel_step?: number | null
          id?: string
          plan_id?: string | null
          promo_code?: string | null
          telegram_user_id?: string
        }
        Relationships: []
      }
      daily_analytics: {
        Row: {
          button_clicks: Json | null
          conversion_rates: Json | null
          created_at: string
          date: string
          id: string
          new_users: number | null
          revenue: number | null
          top_promo_codes: Json | null
          total_users: number | null
          updated_at: string
        }
        Insert: {
          button_clicks?: Json | null
          conversion_rates?: Json | null
          created_at?: string
          date: string
          id?: string
          new_users?: number | null
          revenue?: number | null
          top_promo_codes?: Json | null
          total_users?: number | null
          updated_at?: string
        }
        Update: {
          button_clicks?: Json | null
          conversion_rates?: Json | null
          created_at?: string
          date?: string
          id?: string
          new_users?: number | null
          revenue?: number | null
          top_promo_codes?: Json | null
          total_users?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      education_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      education_enrollments: {
        Row: {
          completion_date: string | null
          created_at: string
          enrollment_date: string
          enrollment_status: string
          id: string
          notes: string | null
          package_id: string
          payment_amount: number | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
          progress_percentage: number | null
          receipt_file_path: string | null
          receipt_telegram_file_id: string | null
          start_date: string | null
          student_email: string | null
          student_first_name: string | null
          student_last_name: string | null
          student_phone: string | null
          student_telegram_id: string
          student_telegram_username: string | null
          updated_at: string
        }
        Insert: {
          completion_date?: string | null
          created_at?: string
          enrollment_date?: string
          enrollment_status?: string
          id?: string
          notes?: string | null
          package_id: string
          payment_amount?: number | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          progress_percentage?: number | null
          receipt_file_path?: string | null
          receipt_telegram_file_id?: string | null
          start_date?: string | null
          student_email?: string | null
          student_first_name?: string | null
          student_last_name?: string | null
          student_phone?: string | null
          student_telegram_id: string
          student_telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          completion_date?: string | null
          created_at?: string
          enrollment_date?: string
          enrollment_status?: string
          id?: string
          notes?: string | null
          package_id?: string
          payment_amount?: number | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          progress_percentage?: number | null
          receipt_file_path?: string | null
          receipt_telegram_file_id?: string | null
          start_date?: string | null
          student_email?: string | null
          student_first_name?: string | null
          student_last_name?: string | null
          student_phone?: string | null
          student_telegram_id?: string
          student_telegram_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_enrollments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "education_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      education_packages: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string
          current_students: number | null
          description: string | null
          detailed_description: string | null
          difficulty_level: string | null
          duration_weeks: number
          enrollment_deadline: string | null
          features: string[] | null
          id: string
          instructor_bio: string | null
          instructor_image_url: string | null
          instructor_name: string | null
          is_active: boolean
          is_featured: boolean
          is_lifetime: boolean
          learning_outcomes: string[] | null
          max_students: number | null
          name: string
          price: number
          requirements: string[] | null
          starts_at: string | null
          thumbnail_url: string | null
          updated_at: string
          video_preview_url: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string
          current_students?: number | null
          description?: string | null
          detailed_description?: string | null
          difficulty_level?: string | null
          duration_weeks: number
          enrollment_deadline?: string | null
          features?: string[] | null
          id?: string
          instructor_bio?: string | null
          instructor_image_url?: string | null
          instructor_name?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_lifetime?: boolean
          learning_outcomes?: string[] | null
          max_students?: number | null
          name: string
          price: number
          requirements?: string[] | null
          starts_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_preview_url?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string
          current_students?: number | null
          description?: string | null
          detailed_description?: string | null
          difficulty_level?: string | null
          duration_weeks?: number
          enrollment_deadline?: string | null
          features?: string[] | null
          id?: string
          instructor_bio?: string | null
          instructor_image_url?: string | null
          instructor_name?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_lifetime?: boolean
          learning_outcomes?: string[] | null
          max_students?: number | null
          name?: string
          price?: number
          requirements?: string[] | null
          starts_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_preview_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "education_packages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "education_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      media_files: {
        Row: {
          caption: string | null
          created_at: string | null
          file_path: string
          file_size: number | null
          file_type: string
          filename: string
          id: string
          telegram_file_id: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          file_path: string
          file_size?: number | null
          file_type: string
          filename: string
          id?: string
          telegram_file_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string
          filename?: string
          id?: string
          telegram_file_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          payment_method: string
          payment_provider_id: string | null
          plan_id: string
          status: string
          updated_at: string
          user_id: string
          webhook_data: Json | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          payment_method: string
          payment_provider_id?: string | null
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
          webhook_data?: Json | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          payment_method?: string
          payment_provider_id?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          webhook_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "bot_users"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_analytics: {
        Row: {
          created_at: string
          discount_amount: number | null
          event_type: string
          final_amount: number | null
          id: string
          plan_id: string | null
          promo_code: string
          telegram_user_id: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          event_type: string
          final_amount?: number | null
          id?: string
          plan_id?: string | null
          promo_code: string
          telegram_user_id: string
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          event_type?: string
          final_amount?: number | null
          id?: string
          plan_id?: string | null
          promo_code?: string
          telegram_user_id?: string
        }
        Relationships: []
      }
      promotion_usage: {
        Row: {
          id: string
          promotion_id: string
          telegram_user_id: string
          used_at: string
        }
        Insert: {
          id?: string
          promotion_id: string
          telegram_user_id: string
          used_at?: string
        }
        Update: {
          id?: string
          promotion_id?: string
          telegram_user_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usage_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          code: string
          created_at: string
          current_uses: number | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          updated_at?: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          currency: string
          duration_months: number
          features: string[] | null
          id: string
          is_lifetime: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          duration_months: number
          features?: string[] | null
          id?: string
          is_lifetime?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          duration_months?: number
          features?: string[] | null
          id?: string
          is_lifetime?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_interactions: {
        Row: {
          created_at: string
          id: string
          interaction_data: Json | null
          interaction_type: string
          page_context: string | null
          session_id: string | null
          telegram_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_data?: Json | null
          interaction_type: string
          page_context?: string | null
          session_id?: string | null
          telegram_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interaction_data?: Json | null
          interaction_type?: string
          page_context?: string | null
          session_id?: string | null
          telegram_user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          awaiting_input: string | null
          created_at: string
          end_reason: string | null
          ended_at: string | null
          id: string
          is_active: boolean
          last_activity: string
          package_data: Json | null
          promo_data: Json | null
          session_data: Json | null
          telegram_user_id: string
        }
        Insert: {
          awaiting_input?: string | null
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean
          last_activity?: string
          package_data?: Json | null
          promo_data?: Json | null
          session_data?: Json | null
          telegram_user_id: string
        }
        Update: {
          awaiting_input?: string | null
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean
          last_activity?: string
          package_data?: Json | null
          promo_data?: Json | null
          session_data?: Json | null
          telegram_user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          bank_details: string | null
          created_at: string
          id: string
          is_active: boolean | null
          payment_instructions: string | null
          payment_method: string | null
          payment_status: string | null
          plan_id: string | null
          receipt_file_path: string | null
          receipt_telegram_file_id: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          telegram_user_id: string
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          bank_details?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          payment_instructions?: string | null
          payment_method?: string | null
          payment_status?: string | null
          plan_id?: string | null
          receipt_file_path?: string | null
          receipt_telegram_file_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          telegram_user_id: string
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          bank_details?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          payment_instructions?: string | null
          payment_method?: string | null
          payment_status?: string | null
          plan_id?: string | null
          receipt_file_path?: string | null
          receipt_telegram_file_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          telegram_user_id?: string
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_surveys: {
        Row: {
          created_at: string
          id: string
          main_goal: string
          monthly_budget: string
          recommended_plan_id: string | null
          survey_completed_at: string | null
          telegram_user_id: string
          trading_frequency: string
          trading_level: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          main_goal: string
          monthly_budget: string
          recommended_plan_id?: string | null
          survey_completed_at?: string | null
          telegram_user_id: string
          trading_frequency: string
          trading_level: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          main_goal?: string
          monthly_budget?: string
          recommended_plan_id?: string | null
          survey_completed_at?: string | null
          telegram_user_id?: string
          trading_frequency?: string
          trading_level?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_daily_analytics: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
    Enums: {},
  },
} as const
