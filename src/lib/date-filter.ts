/**
 * One shared date filter for every staff screen (orders, kitchen, history) so
 * "today / tomorrow / upcoming" always mean the same thing everywhere.
 */

export type DateFilterKey = "today" | "tomorrow" | "week" | "upcoming" | "past" | "all" | "custom";

export const DATE_FILTERS: { key: DateFilterKey; ar: string; en: string }[] = [
  { key: "today", ar: "اليوم", en: "Today" },
  { key: "tomorrow", ar: "غداً", en: "Tomorrow" },
  { key: "week", ar: "هذا الأسبوع", en: "Next 7 days" },
  { key: "upcoming", ar: "قادمة", en: "Upcoming" },
  { key: "past", ar: "سابقة", en: "Past" },
  { key: "all", ar: "الكل", en: "All" },
  { key: "custom", ar: "تاريخ محدد", en: "Custom" },
];

/**
 * Today's calendar date in Jordan (Asia/Amman) YYYY-MM-DD.
 * Fixed explicitly to Asia/Amman so Serverless runtimes in UTC
 * never shift orders between 00:00 and 03:00 local time.
 */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Calendar date (YYYY-MM-DD) shifted by a number of days in Jordan timezone (Asia/Amman).
 */
export function isoDay(offsetDays = 0): string {
  if (offsetDays === 0) return todayIso();
  const todayStr = todayIso();
  const parts = todayStr.split("-").map(Number);
  const y = parts[0] ?? 2026;
  const m = parts[1] ?? 1;
  const d = (parts[2] ?? 1) + offsetDays;
  const shiftedDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shiftedDate);
}

/**
 * Jordan calendar date (YYYY-MM-DD) of an instant, in Jordan time (Asia/Amman).
 */
export const jordanDay = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

/** Today's calendar date in Jordan (YYYY-MM-DD). */
export const jordanToday = (): string => todayIso();

export type CustomRange = { from: string; to: string };

/** True when a requested date (YYYY-MM-DD) belongs to the chosen filter. */
export function matchesDateFilter(date: string, key: DateFilterKey, custom?: CustomRange): boolean {
  const today = isoDay(0);
  switch (key) {
    case "today":
      return date === today;
    case "tomorrow":
      return date === isoDay(1);
    case "week":
      return date >= today && date <= isoDay(7);
    case "upcoming":
      return date > today;
    case "past":
      return date < today;
    case "custom": {
      const from = custom?.from || "";
      const to = custom?.to || from;
      if (!from) return true;
      return date >= from && date <= to;
    }
    case "all":
    default:
      return true;
  }
}
