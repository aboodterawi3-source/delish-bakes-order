// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  createSupabaseFetch,
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
} from "./shared";

export function hasSupabaseServiceRoleKey(): boolean {
  const raw = (
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SERVICE_KEY"] ||
    ""
  ).trim();
  return Boolean(raw) && !raw.startsWith("sb_publishable_");
}

export function assertSupabaseServiceRoleKey(): void {
  if (!hasSupabaseServiceRoleKey()) {
    throw new Error(
      "إعدادات الخادم غير مكتملة (SUPABASE_SERVICE_ROLE_KEY غير مضبوط) · Server configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is required",
    );
  }
}

function createSupabaseAdminClient() {
  const SUPABASE_URL = resolveSupabaseUrl();
  const rawServiceKey =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SERVICE_KEY"];
  const SUPABASE_SERVICE_ROLE_KEY =
    rawServiceKey && rawServiceKey.trim() !== ""
      ? rawServiceKey.trim()
      : resolveSupabasePublishableKey();

  if (!hasSupabaseServiceRoleKey()) {
    console.warn(
      "[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not configured; falling back to publishable key (admin.auth and RLS-bypassing queries require SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
// Load inside server handlers: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
// Top-level import is safe only in other .server.ts modules - route files and *.functions.ts ship to the client bundle.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
