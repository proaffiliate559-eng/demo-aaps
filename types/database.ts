
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_audit_log": {
                  Row: {
                    "action": string,"admin_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": string,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"admin_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"target_user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"target_user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_usage": {
                  Row: {
                    "created_at": string,"error_code": string | null,"estimated_cost": number,"feature": string,"id": string,"provider": string,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error_code"?: string | null,"estimated_cost"?: number,"feature": string,"id"?: string,"provider": string,"status": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"error_code"?: string | null,"estimated_cost"?: number,"feature"?: string,"id"?: string,"provider"?: string,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"chat_conversations": {
                  Row: {
                    "created_at": string,"id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"chat_messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"role": string
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "chat_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"content_reports": {
                  Row: {
                    "created_at": string,"id": string,"outfit_id": string | null,"reason": string,"reporter_id": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"outfit_id"?: string | null,"reason": string,"reporter_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"outfit_id"?: string | null,"reason"?: string,"reporter_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_reports_outfit_id_fkey"
      columns: ["outfit_id"]
isOneToOne: false
      referencedRelation: "outfits"
      referencedColumns: ["id"]
    }
                  ]
                },"outfit_feedback": {
                  Row: {
                    "created_at": string,"feedback": string | null,"id": string,"outfit_id": string,"rating": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"feedback"?: string | null,"id"?: string,"outfit_id": string,"rating": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"feedback"?: string | null,"id"?: string,"outfit_id"?: string,"rating"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outfit_feedback_outfit_id_fkey"
      columns: ["outfit_id"]
isOneToOne: false
      referencedRelation: "outfits"
      referencedColumns: ["id"]
    }
                  ]
                },"outfits": {
                  Row: {
                    "created_at": string,"description": string | null,"estimated_budget": number | null,"generated_image_path": string | null,"id": string,"is_mock": boolean,"mood": string,"name": string,"occasion": string,"outfit_data": NonNullable<Json>,"provider": string,"request_id": string,"style": string,"tier": string,"user_id": string,"weather": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"estimated_budget"?: number | null,"generated_image_path"?: string | null,"id"?: string,"is_mock"?: boolean,"mood": string,"name": string,"occasion": string,"outfit_data": NonNullable<Json>,"provider": string,"request_id": string,"style": string,"tier": string,"user_id": string,"weather"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"estimated_budget"?: number | null,"generated_image_path"?: string | null,"id"?: string,"is_mock"?: boolean,"mood"?: string,"name"?: string,"occasion"?: string,"outfit_data"?: NonNullable<Json>,"provider"?: string,"request_id"?: string,"style"?: string,"tier"?: string,"user_id"?: string,"weather"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"created_at": string,"currency": string,"failure_reason": string | null,"id": string,"plan_id": string,"razorpay_order_id": string,"razorpay_payment_id": string | null,"status": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"created_at"?: string,"currency"?: string,"failure_reason"?: string | null,"id"?: string,"plan_id": string,"razorpay_order_id": string,"razorpay_payment_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "amount_paise"?: number,"created_at"?: string,"currency"?: string,"failure_reason"?: string | null,"id"?: string,"plan_id"?: string,"razorpay_order_id"?: string,"razorpay_payment_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "created_at": string,"features": NonNullable<Json>,"generation_limit": number,"id": string,"is_active": boolean,"name": string,"period": string,"price": number,"saved_limit": number | null,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"features"?: NonNullable<Json>,"generation_limit": number,"id"?: string,"is_active"?: boolean,"name": string,"period": string,"price": number,"saved_limit"?: number | null,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"features"?: NonNullable<Json>,"generation_limit"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"period"?: string,"price"?: number,"saved_limit"?: number | null,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "age_group": string | null,"budget_max": number | null,"budget_min": number | null,"country": string,"created_at": string,"display_name": string | null,"email": string | null,"favourite_colours": NonNullable<Json>,"gender_preference": string | null,"id": string,"language": string,"onboarding_completed_at": string | null,"preferred_styles": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "age_group"?: string | null,"budget_max"?: number | null,"budget_min"?: number | null,"country"?: string,"created_at"?: string,"display_name"?: string | null,"email"?: string | null,"favourite_colours"?: NonNullable<Json>,"gender_preference"?: string | null,"id": string,"language"?: string,"onboarding_completed_at"?: string | null,"preferred_styles"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "age_group"?: string | null,"budget_max"?: number | null,"budget_min"?: number | null,"country"?: string,"created_at"?: string,"display_name"?: string | null,"email"?: string | null,"favourite_colours"?: NonNullable<Json>,"gender_preference"?: string | null,"id"?: string,"language"?: string,"onboarding_completed_at"?: string | null,"preferred_styles"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"saved_outfits": {
                  Row: {
                    "created_at": string,"id": string,"outfit_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"outfit_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"outfit_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_outfits_outfit_id_fkey"
      columns: ["outfit_id"]
isOneToOne: false
      referencedRelation: "outfits"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "created_at": string,"expires_at": string | null,"id": string,"payment_reference": string | null,"plan_id": string,"started_at": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string | null,"id"?: string,"payment_reference"?: string | null,"plan_id": string,"started_at"?: string | null,"status": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string | null,"id"?: string,"payment_reference"?: string | null,"plan_id"?: string,"started_at"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"user_preferences": {
                  Row: {
                    "additional_preferences": string | null,"height_range": string | null,"id": string,"modesty_preference": string | null,"preferred_fit": string | null,"preferred_occasions": NonNullable<Json>,"preferred_sizes": NonNullable<Json>,"updated_at": string,"user_id": string,"weather_preference": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "additional_preferences"?: string | null,"height_range"?: string | null,"id"?: string,"modesty_preference"?: string | null,"preferred_fit"?: string | null,"preferred_occasions"?: NonNullable<Json>,"preferred_sizes"?: NonNullable<Json>,"updated_at"?: string,"user_id": string,"weather_preference"?: string | null
                  }
                  Update: {
                    "additional_preferences"?: string | null,"height_range"?: string | null,"id"?: string,"modesty_preference"?: string | null,"preferred_fit"?: string | null,"preferred_occasions"?: NonNullable<Json>,"preferred_sizes"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string,"weather_preference"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"wardrobe_items": {
                  Row: {
                    "brand": string | null,"category": string,"colour": string | null,"created_at": string,"id": string,"image_path": string | null,"name": string,"notes": string | null,"season": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"category": string,"colour"?: string | null,"created_at"?: string,"id"?: string,"image_path"?: string | null,"name": string,"notes"?: string | null,"season"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "brand"?: string | null,"category"?: string,"colour"?: string | null,"created_at"?: string,"id"?: string,"image_path"?: string | null,"name"?: string,"notes"?: string | null,"season"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"webhook_events": {
                  Row: {
                    "event": string,"id": string,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event": string,"id": string,"received_at"?: string
                  }
                  Update: {
                    "event"?: string,"id"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_ai_usage":
{ Args: { "p_days"?: number }; Returns: {
              "calls": number,"error_code": string,"feature": string,"provider": string,"status": string
            }[]
                           },
"admin_daily_activity":
{ Args: { "p_days"?: number }; Returns: {
              "ai_errors": number,"day": string,"generations": number,"signups": number
            }[]
                           },
"admin_list_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_search"?: string }; Returns: {
              "banned_until": string,"created_at": string,"display_name": string,"email": string,"generations": number,"id": string,"is_admin": boolean,"last_sign_in_at": string,"onboarded": boolean,"plan_slug": string,"total_count": number
            }[]
                           },
"admin_outfit_breakdown":
{ Args: { "p_days"?: number }; Returns: {
              "dimension": string,"requests": number,"value": string
            }[]
                           },
"admin_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"am_i_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"expire_subscriptions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"fulfil_payment":
{ Args: { "p_order_id": string,"p_payment_id": string }; Returns: Json
                           },
"generation_quota":
{ Args: { "p_user": string }; Returns: {
              "lim": number,"period": string,"period_start": string,"plan_name": string,"plan_slug": string,"resets_at": string,"used": number
            }[]
                           },
"is_admin":
{ Args: { "uid"?: string }; Returns: boolean
                           },
"my_generation_quota":
{ Args: Record<PropertyKey, never>; Returns: {
              "lim": number,"period": string,"period_start": string,"plan_name": string,"plan_slug": string,"resets_at": string,"used": number
            }[]
                           },
"recent_upload_count":
{ Args: { "p_user": string }; Returns: number
                           },
"reserve_generation":
{ Args: { "p_provider": string,"p_user": string }; Returns: string
                           }
          }
          Enums: {
            "app_role": "admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["admin"]
          }
        }
} as const
