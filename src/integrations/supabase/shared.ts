/**
 * Shared Supabase URL/key resolution and fetch adapter used across browser,
 * SSR middleware, and admin clients so fallback project settings live in one place.
 */

export const DEFAULT_SUPABASE_URL = "https://dmvwdkxcltnomigoqtue.supabase.co";
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4o-FrhbFZSg-sCqYdA9s6g_qBDFmxNj";

function firstNonEmpty(values: Array<unknown>): string | undefined {
  for (const raw of values) {
    if (typeof raw === "string" && raw.trim() !== "") {
      return raw.trim();
    }
  }
  return undefined;
}

export function resolveSupabaseUrl(): string {
  const metaEnv =
    typeof import.meta !== "undefined" ? ((import.meta as { env?: Record<string, unknown> }).env ?? {}) : {};
  const procEnv = typeof process !== "undefined" ? process.env ?? {} : {};
  return (
    firstNonEmpty([
      procEnv["SUPABASE_URL"],
      procEnv["VITE_SUPABASE_URL"],
      procEnv["NEXT_PUBLIC_SUPABASE_URL"],
      metaEnv["VITE_SUPABASE_URL"],
      metaEnv["SUPABASE_URL"],
    ]) ?? DEFAULT_SUPABASE_URL
  ).replace(/\/+$/, "");
}

export function resolveSupabasePublishableKey(): string {
  const metaEnv =
    typeof import.meta !== "undefined" ? ((import.meta as { env?: Record<string, unknown> }).env ?? {}) : {};
  const procEnv = typeof process !== "undefined" ? process.env ?? {} : {};
  return (
    firstNonEmpty([
      metaEnv["VITE_SUPABASE_PUBLISHABLE_KEY"],
      procEnv["SUPABASE_PUBLISHABLE_KEY"],
      procEnv["VITE_SUPABASE_PUBLISHABLE_KEY"],
    ]) ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY
  );
}

/**
 * Wraps fetch to inject the `apikey` header and strip `Authorization: Bearer <key>`
 * when using opaque `sb_publishable_` / `sb_secret_` API keys (which are not JWTs).
 */
export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  const isOpaqueKey =
    supabaseKey.startsWith("sb_publishable_") || supabaseKey.startsWith("sb_secret_");

  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isOpaqueKey && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}
