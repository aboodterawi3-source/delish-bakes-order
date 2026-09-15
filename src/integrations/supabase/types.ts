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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          discount_percent: number | null
          id: string
          modified_amount: number | null
          order_id: string | null
          order_number: string | null
          original_amount: number | null
          reason: string | null
          staff_name: string
          staff_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          discount_percent?: number | null
          id?: string
          modified_amount?: number | null
          order_id?: string | null
          order_number?: string | null
          original_amount?: number | null
          reason?: string | null
          staff_name: string
          staff_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          discount_percent?: number | null
          id?: string
          modified_amount?: number | null
          order_id?: string | null
          order_number?: string | null
          original_amount?: number | null
          reason?: string | null
          staff_name?: string
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_edit_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          order_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          order_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          order_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_edit_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          name_ar: string
          name_en: string
          notes: string | null
          options_ar: string[]
          options_en: string[]
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
          notes?: string | null
          options_ar?: string[]
          options_en?: string[]
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          notes?: string | null
          options_ar?: string[]
          options_en?: string[]
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          area: string | null
          cancel_reason: string | null
          card_note: string | null
          confirmation_message: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          customer_phone: string
          delivery_fee: number
          deposit_paid: number
          design_image_url: string | null
          discount_amount: number
          discount_percent: number
          driver_name: string | null
          driver_phone: string | null
          event_date: string | null
          final_photo_requested: boolean
          id: string
          inscription: string | null
          is_urgent: boolean
          method: Database["public"]["Enums"]["order_method"]
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          requested_date: string
          requested_time: string
          schedule_updated_at: string | null
          staff_notes: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          cancel_reason?: string | null
          card_note?: string | null
          confirmation_message?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          deposit_paid?: number
          design_image_url?: string | null
          discount_amount?: number
          discount_percent?: number
          driver_name?: string | null
          driver_phone?: string | null
          event_date?: string | null
          final_photo_requested?: boolean
          id?: string
          inscription?: string | null
          is_urgent?: boolean
          method?: Database["public"]["Enums"]["order_method"]
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          requested_date: string
          requested_time: string
          schedule_updated_at?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          area?: string | null
          cancel_reason?: string | null
          card_note?: string | null
          confirmation_message?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          deposit_paid?: number
          design_image_url?: string | null
          discount_amount?: number
          discount_percent?: number
          driver_name?: string | null
          driver_phone?: string | null
          event_date?: string | null
          final_photo_requested?: boolean
          id?: string
          inscription?: string | null
          is_urgent?: boolean
          method?: Database["public"]["Enums"]["order_method"]
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          requested_date?: string
          requested_time?: string
          schedule_updated_at?: string | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          category_id: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_featured: boolean
          is_popular: boolean
          name_ar: string
          name_en: string
          price: number
          priority_color: Database["public"]["Enums"]["priority_color"] | null
          rating: number
          rating_count: number
          sizes: Json
          slug: string
          sort_order: number
          tint: string | null
          updated_at: string
        }
        Insert: {
          category: string
          category_id?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          is_popular?: boolean
          name_ar: string
          name_en: string
          price?: number
          priority_color?: Database["public"]["Enums"]["priority_color"] | null
          rating?: number
          rating_count?: number
          sizes?: Json
          slug: string
          sort_order?: number
          tint?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          category_id?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          is_popular?: boolean
          name_ar?: string
          name_en?: string
          price?: number
          priority_color?: Database["public"]["Enums"]["priority_color"] | null
          rating?: number
          rating_count?: number
          sizes?: Json
          slug?: string
          sort_order?: number
          tint?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "storefront_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_product_permissions: {
        Row: {
          can_edit_price: boolean
          created_at: string
          id: string
          product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_edit_price?: boolean
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_edit_price?: boolean
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_permissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          allow_custom_discount: boolean
          allow_price_override: boolean
          created_at: string
          id: string
          max_discount_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_custom_discount?: boolean
          allow_price_override?: boolean
          created_at?: string
          id?: string
          max_discount_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_custom_discount?: boolean
          allow_price_override?: boolean
          created_at?: string
          id?: string
          max_discount_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      storefront_banner: {
        Row: {
          button_text: string
          created_at: string
          discount_text: string
          id: string
          image_url: string | null
          is_active: boolean
          singleton: boolean
          subtitle: string
          updated_at: string
        }
        Insert: {
          button_text?: string
          created_at?: string
          discount_text?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          singleton?: boolean
          subtitle?: string
          updated_at?: string
        }
        Update: {
          button_text?: string
          created_at?: string
          discount_text?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          singleton?: boolean
          subtitle?: string
          updated_at?: string
        }
        Relationships: []
      }
      storefront_categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name_ar: string
          name_en: string
          priority_color: Database["public"]["Enums"]["priority_color"] | null
          sort_order: number
          tint: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar: string
          name_en: string
          priority_color?: Database["public"]["Enums"]["priority_color"] | null
          sort_order?: number
          tint?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string
          name_en?: string
          priority_color?: Database["public"]["Enums"]["priority_color"] | null
          sort_order?: number
          tint?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_kitchen_order_items: {
        Args: { _order_ids: string[] }
        Returns: {
          id: string
          name_ar: string
          name_en: string
          notes: string
          options_ar: string[]
          options_en: string[]
          order_id: string
          product_id: string
          quantity: number
        }[]
      }
      get_kitchen_orders: {
        Args: never
        Returns: {
          created_at: string
          customer_name: string
          design_image_url: string
          id: string
          inscription: string
          is_urgent: boolean
          method: Database["public"]["Enums"]["order_method"]
          notes: string
          order_number: string
          requested_date: string
          requested_time: string
          schedule_updated_at: string
          status: Database["public"]["Enums"]["order_status"]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "sales" | "kitchen" | "social"
      order_method: "delivery" | "pickup"
      order_status:
        | "new"
        | "confirmed"
        | "baking"
        | "ready"
        | "delivered"
        | "cancelled"
        | "out_for_delivery"
        | "completed"
      payment_method: "cash" | "cliq" | "visa"
      priority_color:
        | "dark_red"
        | "warm_orange"
        | "golden_yellow"
        | "sky_blue"
        | "soft_green"
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
  public: {
    Enums: {
      app_role: ["admin", "sales", "kitchen", "social"],
      order_method: ["delivery", "pickup"],
      order_status: [
        "new",
        "confirmed",
        "baking",
        "ready",
        "delivered",
        "cancelled",
        "out_for_delivery",
        "completed",
      ],
      payment_method: ["cash", "cliq", "visa"],
      priority_color: [
        "dark_red",
        "warm_orange",
        "golden_yellow",
        "sky_blue",
        "soft_green",
      ],
    },
  },
} as const
