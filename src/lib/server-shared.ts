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
 */
export const STORAGE_URL =
  /^https?:\/\/[a-z0-9.-]+\/storage\/v1\/object\/(?:sign|public|authenticated)\/[\w./-]+(?:\?[\w=%&.-]*)?$/i;

/**
 * Validates that an image URL points to a legitimate Supabase Storage object (signed or public)
 * dynamically adapting to the environment's configured Supabase project or any standard storage path,
 * while strictly blocking Base64/data URLs and oversized strings.
 */
export function isValidStorageUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2500) return false;
  if (trimmed.startsWith("data:") || trimmed.includes(";base64,")) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;

  const dynamicBase = getSupabaseStorageBaseUrl();
  if (dynamicBase && trimmed.startsWith(dynamicBase)) {
    return /\/storage\/v1\/object\/(?:sign|public|authenticated)\/[\w./-]/i.test(trimmed);
  }

  return /\/storage\/v1\/object\/(?:sign|public|authenticated)\/[\w./-]/i.test(trimmed);
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
