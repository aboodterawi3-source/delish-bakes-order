/**
 * Single source of truth for server-side input cleaning. Replaces the
 * copy-pasted `clean`/`text` helpers so every endpoint enforces the same rules.
 */

export const PHONE_PATTERN = /^[0-9+\s-]{7,25}$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trims, strips line breaks and enforces a maximum length. Returns null when empty. */
export function cleanText(value: unknown, max: number): string | null {
  const trimmed = typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim() : "";
  if (!trimmed) return null;
  if (trimmed.length > max) throw new Error("نص طويل جداً · Text is too long");
  return trimmed;
}

/** Real calendar date check: rejects 2026-99-99 and 2026-02-31. */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** HH:MM or HH:MM:SS with valid ranges. */
export function isValidTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  return hours < 24 && minutes < 60 && seconds < 60;
}

/** Today's date in Jordan (the business timezone) as YYYY-MM-DD. */
export function jordanToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Customer-facing date window: from yesterday (clock skew) up to one year ahead. */
export function isReasonableOrderDate(value: string, now: Date = new Date()): boolean {
  if (!isValidIsoDate(value)) return false;
  const today = new Date(`${jordanToday(now)}T00:00:00Z`).getTime();
  const target = new Date(`${value}T00:00:00Z`).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return target >= today - dayMs && target <= today + 365 * dayMs;
}
