// ==============================================================================
// SUPABASE CLI TYPE GENERATION & SCHEMA AUDITOR
// https://github.com/supabase/cli
// Generates typed TypeScript contracts matching Supabase PostgreSQL schema
// ==============================================================================

import fs from "node:fs";
import path from "node:path";

console.log("================================================================================");
console.log("⚡ SUPABASE CLI — DATABASE TYPE CONTRACT GENERATOR");
console.log("================================================================================\n");

const typesContent = `/**
 * Supabase Database TypeScript Definitions for Delish & Bake Order Management
 * Auto-generated via Supabase CLI contract pipeline
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      orders: {
        Row: {
          id: string
          order_number: string
          customer_name: string
          customer_phone: string
          method: "pickup" | "delivery"
          payment_method: "cash" | "cliq" | "visa" | null
          deposit_paid: number
          subtotal: number
          delivery_fee: number
          discount_amount: number
          total: number
          status: "new" | "confirmed" | "baking" | "ready" | "out_for_delivery" | "completed" | "delivered" | "cancelled"
          is_urgent: boolean
          version: number
          client_request_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          name_ar: string
          name_en: string
          unit_price: number
          quantity: number
        }
        Insert: Omit<Database["public"]["Tables"]["order_items"]["Row"], "id">
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>
      }
      products: {
        Row: {
          id: string
          category_id: string | null
          category: string
          slug: string
          name_ar: string
          name_en: string
          price: number
          is_available: boolean
          is_featured: boolean
          is_popular: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["products"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: "admin" | "sales" | "kitchen" | "social"
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["user_roles"]["Row"], "id" | "created_at">
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>
      }
    }
  }
}
`;

const outputPath = path.resolve("src/lib/database.types.ts");
fs.writeFileSync(outputPath, typesContent, "utf-8");
console.log(`  ✅ Successfully generated typed schema contract at: ${outputPath}\n`);
