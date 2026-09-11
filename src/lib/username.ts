/**
 * Staff sign in uses a name, not an email address. Supabase Auth always needs an
 * email, so each name maps deterministically to an internal address that is never
 * shown to staff and never receives mail.
 */
export const STAFF_EMAIL_DOMAIN = "delish.local";

/** Lowercase, email-safe form of a staff name. */
export function normalizeUsername(raw: string): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

export function usernameToEmail(raw: string): string {
  const name = normalizeUsername(raw);
  return `${name}@${STAFF_EMAIL_DOMAIN}`;
}

/** Turns an internal address back into the name staff typed. */
export function emailToUsername(email: string | null | undefined): string {
  if (!email) return "—";
  return email.endsWith(`@${STAFF_EMAIL_DOMAIN}`) ? email.slice(0, -`@${STAFF_EMAIL_DOMAIN}`.length) : email;
}
