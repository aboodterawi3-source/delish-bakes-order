/**
 * Shared server types, utilities, and guards for Delish Bakery server functions.
 */

export type ServerAuthContext = {
  supabase: any;
  userId: string;
  claims: Record<string, unknown>;
};

export type Ctx = ServerAuthContext;

export type OrderModification = {
  field: string;
  oldValue: string;
  newValue: string;
  updatedAt: string;
  acknowledgedAt?: string | null;
};

/**
 * Retrieves the numeric employee staff code for a given authenticated user ID.
 */
export async function getStaffCodeForUser(
  supabase: any,
  userId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("staff_codes")
    .select("staff_code")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.staff_code ? Number(data.staff_code) : null;
}

export const MAX_EXTRAS = 20;
export const MAX_EXTRA_LENGTH = 160;

/**
 * Resolves the Supabase base URL dynamically from environment variables,
 * supporting Node/Serverless runtimes and Vite browser environments.
 */
export function getSupabaseStorageBaseUrl(): string {
  const envUrl =
    (typeof process !== "undefined" &&
      (process.env?.["SUPABASE_URL"] ||
        process.env?.["VITE_SUPABASE_URL"] ||
        process.env?.["NEXT_PUBLIC_SUPABASE_URL"])) ||
    (typeof import.meta !== "undefined" &&
      ((import.meta as any)?.env?.VITE_SUPABASE_URL ||
        (import.meta as any)?.env?.SUPABASE_URL)) ||
    "";
  return envUrl ? String(envUrl).replace(/\/+$/, "") : "";
}

/**
 * Dynamic pattern matching any Supabase Storage URL (signed or public) across all environments/projects.
 * Accepts signed (/sign/) or public (/public/) objects with optional query parameters.
 * Host-agnostic on its own: use isValidStorageUrl to also pin the origin to this project.
 */
export const STORAGE_URL =
  /^https?:\/\/[a-z0-9.-]+\/storage\/v1\/object\/(?:sign|public|authenticated)\/[\w./-]+(?:\?[\w=%&.-]*)?$/i;

/** Path-only pattern for Storage objects; the origin is verified separately. */
const STORAGE_PATH = /^\/storage\/v1\/object\/(?:sign|public|authenticated)\/[\w./%-]+$/;

/**
 * Validates that an image URL points to a Storage object of THIS project (origin taken
 * from SUPABASE_URL), blocking foreign hosts, credentials in the URL, path traversal,
 * Base64/data URLs and oversized strings. Fails closed when the project URL is unknown.
 */
export function isValidStorageUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2500) return false;

  // Fail closed: without a configured project origin we cannot trust any URL.
  const base = getSupabaseStorageBaseUrl();
  if (!base) return false;

  let parsed: URL;
  let baseUrl: URL;
  try {
    parsed = new URL(trimmed);
    baseUrl = new URL(base);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  // Same origin as our own Supabase project — a foreign host is never accepted.
  if (parsed.origin !== baseUrl.origin) return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.pathname.includes("..")) return false;
  return STORAGE_PATH.test(parsed.pathname);
}

/** Extras are plain labels; keep them short, single-line and bounded. */
export const sanitizeExtraList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.replace(/[\r\n]+/g, " ").trim() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, MAX_EXTRAS)
    .map((entry) => entry.slice(0, MAX_EXTRA_LENGTH));
};

export const extraList = sanitizeExtraList;
