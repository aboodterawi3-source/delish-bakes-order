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

/** Signed link returned by uploadDesignImage for photos kept in Cloud storage. */
export const STORAGE_URL =
  /^https:\/\/zmeijwtivmniqpwyxezk\.supabase\.co\/storage\/v1\/object\/sign\/order-designs\/[\w./-]+\?[\w=%&.-]+$/i;

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
