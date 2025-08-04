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
      bot_users: {
        Row: {
          created_at: string
          current_plan_id: string | null
          first_name: string | null
          id: string
          is_vip: boolean
          last_name: string | null
          subscription_expires_at: string | null
          telegram_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          current_plan_id?: string | null
          first_name?: string | null
          id?: string
          is_vip?: boolean
          last_name?: string | null
          subscription_expires_at?: string | null
          telegram_id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          current_plan_id?: string | null
          first_name?: string | null
          id?: string
          is_vip?: boolean
          last_name?: string | null
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
      [_ in never]: never
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
