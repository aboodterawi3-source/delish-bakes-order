import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  createSupabaseFetch,
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
} from "./shared";

function createSupabaseClient() {
  const SUPABASE_URL = resolveSupabaseUrl();
  const SUPABASE_PUBLISHABLE_KEY = resolveSupabasePublishableKey();

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
