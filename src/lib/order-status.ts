/**
 * Unified Order Status metadata and types for Delish Bakery.
 * Provides consistent status keys, bilingual labels, icons, and badge styles
 * across Orders Workspace, Calendar, Kitchen KDS, and Admin dashboards.
 */

export type OrderStatus =
  | "new"
  | "confirmed"
  | "baking"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "delivered"
  | "cancelled";

/** Backwards-compatible alias for sales functions */
export type SalesStatus = OrderStatus;

export interface StatusMetaItem {
  key: OrderStatus;
  ar: string;
  en: string;
  icon: string;
  chip: string;
  dot: string;
  badgeBg: string;
  badgeText: string;
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusMetaItem> = {
  new: {
    key: "new",
    ar: "قيد الانتظار",
    en: "Pending",
    icon: "🆕",
    chip: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700",
    dot: "bg-amber-500",
    badgeBg: "bg-amber-600",
    badgeText: "text-white",
  },
  confirmed: {
    key: "confirmed",
    ar: "مؤكد",
    en: "Confirmed",
    icon: "⚡",
    chip: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-700",
    dot: "bg-blue-500",
    badgeBg: "bg-blue-600",
    badgeText: "text-white",
  },
  baking: {
    key: "baking",
    ar: "قيد التنفيذ والكريمة",
    en: "In production",
    icon: "👩‍🍳",
    chip: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-700",
    dot: "bg-purple-500",
    badgeBg: "bg-purple-600",
    badgeText: "text-white",
  },
  ready: {
    key: "ready",
    ar: "جاهز بالمحل",
    en: "Ready at store",
    icon: "🎂",
    chip: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-700",
    dot: "bg-emerald-500",
    badgeBg: "bg-emerald-600",
    badgeText: "text-white",
  },
  out_for_delivery: {
    key: "out_for_delivery",
    ar: "مع السائق للتوصيل",
    en: "Out for delivery",
    icon: "🛵",
    chip: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-700",
    dot: "bg-orange-500",
    badgeBg: "bg-orange-600",
    badgeText: "text-white",
  },
  completed: {
    key: "completed",
    ar: "مكتمل ومستلم",
    en: "Completed",
    icon: "✅",
    chip: "bg-green-100 text-green-900 border-green-300 dark:bg-slate-900/60 dark:text-slate-200 dark:border-slate-700",
    dot: "bg-green-500",
    badgeBg: "bg-slate-600",
    badgeText: "text-white",
  },
  delivered: {
    key: "delivered",
    ar: "تم التسليم",
    en: "Delivered",
    icon: "📦",
    chip: "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-700",
    dot: "bg-teal-500",
    badgeBg: "bg-teal-600",
    badgeText: "text-white",
  },
  cancelled: {
    key: "cancelled",
    ar: "ملغي",
    en: "Canceled",
    icon: "❌",
    chip: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-700",
    dot: "bg-rose-500",
    badgeBg: "bg-rose-600",
    badgeText: "text-white",
  },
};

export const ORDER_STATUS_LIST: OrderStatus[] = [
  "new",
  "confirmed",
  "baking",
  "ready",
  "out_for_delivery",
  "completed",
  "delivered",
  "cancelled",
];

export function getStatusMeta(status: string | null | undefined): StatusMetaItem {
  if (status && status in ORDER_STATUS_META) {
    return ORDER_STATUS_META[status as OrderStatus];
  }
  return {
    key: "new",
    ar: status || "غير محدد",
    en: status || "Unknown",
    icon: "❓",
    chip: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    badgeBg: "bg-muted",
    badgeText: "text-foreground",
  };
}
