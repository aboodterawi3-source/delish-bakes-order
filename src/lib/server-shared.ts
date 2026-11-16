import { resolveSupabaseUrl } from "../integrations/supabase/shared.ts";
import type { OrderModification } from "./order-modifications.ts";
import { isValidUuid } from "./validators.ts";

/**
 * Shared server types, utilities, and guards for Delish Bakery server functions.
 */

export type ServerAuthContext = {
  supabase: any;
  userId: string;
  claims: Record<string, unknown>;
};

export type { OrderModification };

/**
 * Retrieves the numeric employee staff code for a given authenticated user ID.
 */
export async function getStaffCodeForUser(supabase: any, userId: string): Promise<number | null> {
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
  return resolveSupabaseUrl();
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

/**
 * Parses and validates one or more newline-separated storage URLs (up to `maxCount`),
 * returning only valid deduplicated URLs.
 */
export function parseValidStorageUrls(
  raw: unknown,
  allowAnyStorageHost = false,
  maxCount = 10,
): string[] {
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\r\n]+/)
      : [];
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (isValidStorageUrl(trimmed) || (allowAnyStorageHost && STORAGE_URL.test(trimmed))) {
      seen.add(trimmed);
      valid.push(trimmed);
      if (valid.length >= maxCount) break;
    }
  }
  return valid;
}

/**
 * Validates and serializes one or more storage URLs into a newline-separated string
 * compatible with the `design_image_url` text column.
 */
export function serializeValidStorageUrls(
  raw: unknown,
  allowAnyStorageHost = false,
  maxCount = 10,
): string | null {
  const valid = parseValidStorageUrls(raw, allowAnyStorageHost, maxCount);
  return valid.length > 0 ? valid.join("\n") : null;
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

export { isValidUuid };

/**
 * Builds the `products` write payload for CMS saves: preserves existing product
 * slugs across updates (preventing broken links and unique-slug collisions) while
 * assigning a slug on insert.
 */
export function buildCmsProductWritePayload<T extends Record<string, unknown>>({
  id,
  slug,
  row,
}: {
  id: string | null | undefined;
  slug: string;
  row: T;
}): T & { slug?: string } {
  if (id) {
    return { ...row };
  }
  return { ...row, slug };
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks
 * when comparing secret setup tokens or HMAC hex digests.
 */
export function timingSafeEqualString(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Paginates through Supabase Auth admin.listUsers so staff listings and duplicate
 * checks do not silently truncate once total accounts exceed 200.
 */
export async function listAllAuthUsers(
  supabaseAdmin: any,
  maxPages = 10,
  perPage = 200,
): Promise<{ users: any[]; error: any }> {
  const allUsers: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      return { users: allUsers, error };
    }
    const batch = data?.users ?? [];
    allUsers.push(...batch);
    if (batch.length < perPage) break;
  }
  return { users: allUsers, error: null };
}
