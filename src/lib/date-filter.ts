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

/** Local calendar date (never UTC) shifted by a number of days. */
export const isoDay = (offsetDays = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export type CustomRange = { from: string; to: string };

/** True when a requested date (YYYY-MM-DD) belongs to the chosen filter. */
export function matchesDateFilter(
  date: string,
  key: DateFilterKey,
  custom?: CustomRange,
): boolean {
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
