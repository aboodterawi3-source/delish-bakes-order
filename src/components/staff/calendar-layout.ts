import { getStatusMeta, type OrderStatus, type PaymentMethod } from "@/lib/order-status";
import type { OrderModification } from "@/lib/order-modifications";

export type CalendarViewMode = "month" | "day";

/** Shared order shape accepted by the calendar from both Sales and Kitchen views. */
export interface CalendarOrder {
  id: string;
  order_number: string;
  staff_code: number | null;
  customer_name: string;
  method: "delivery" | "pickup";
  requested_date: string;
  requested_time: string;
  status: string;
  inscription: string | null;
  card_note?: string | null | undefined;
  design_image_url: string | null;
  notes: string | null;
  schedule_updated_at: string | null;
  last_edited_at: string | null;
  modifications?: OrderModification[] | null | undefined;
  items: Array<{
    id: string;
    name_ar: string;
    quantity: number;
    options_ar: string[];
    notes: string | null;
    unit_price?: number;
  }>;
  customer_phone?: string;
  area?: string | null;
  address?: string | null;
  order_name?: string | null;
  sender_phone?: string | null;
  recipient_phone?: string | null;
  subtotal?: number;
  delivery_fee?: number;
  discount_amount?: number;
  total?: number;
  deposit_paid?: number;
  payment_method?: PaymentMethod | null;
}

export const WEEKDAYS_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];
export const MONTHS_AR = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول",
];

const CARD_SURFACE_BY_STATUS: Record<OrderStatus, { bg: string; border: string; text: string }> = {
  new: {
    bg: "bg-amber-50/90 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-700",
    text: "text-amber-950 dark:text-amber-200",
  },
  confirmed: {
    bg: "bg-sky-50/90 dark:bg-sky-950/40",
    border: "border-sky-300 dark:border-sky-700",
    text: "text-sky-950 dark:text-sky-200",
  },
  baking: {
    bg: "bg-amber-100/90 dark:bg-amber-900/50",
    border: "border-amber-400 dark:border-amber-600",
    text: "text-amber-950 dark:text-amber-100",
  },
  ready: {
    bg: "bg-emerald-50/90 dark:bg-emerald-950/40",
    border: "border-emerald-400 dark:border-emerald-700",
    text: "text-emerald-950 dark:text-emerald-200",
  },
  out_for_delivery: {
    bg: "bg-blue-50/90 dark:bg-blue-950/40",
    border: "border-blue-400 dark:border-blue-700",
    text: "text-blue-950 dark:text-blue-200",
  },
  completed: {
    bg: "bg-slate-100/80 dark:bg-slate-900/60",
    border: "border-slate-300 dark:border-slate-700",
    text: "text-slate-800 dark:text-slate-200",
  },
  delivered: {
    bg: "bg-teal-50/90 dark:bg-teal-950/40",
    border: "border-teal-400 dark:border-teal-700",
    text: "text-teal-950 dark:text-teal-200",
  },
  cancelled: {
    bg: "bg-rose-50/90 dark:bg-rose-950/40",
    border: "border-rose-300 dark:border-rose-700",
    text: "text-rose-950 dark:text-rose-200",
  },
};

export function statusCardStyle(status: string | null | undefined) {
  const meta = getStatusMeta(status);
  const surface = CARD_SURFACE_BY_STATUS[meta.key] ?? CARD_SURFACE_BY_STATUS.new;
  return { ...meta, ...surface };
}

export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse HH:mm time string to minutes from midnight. */
export function parseTimeInMinutes(timeStr: string): number {
  if (!timeStr) return 9 * 60;
  const parts = timeStr.split(":").map(Number);
  const h = parts[0];
  const m = parts[1];
  if (h === undefined || isNaN(h)) return 9 * 60;
  return h * 60 + (m === undefined || isNaN(m) ? 0 : m);
}

/** Format time in minutes to 12-hour Arabic format (e.g. 9:00 ص). */
export function formatMinutesArabic(totalMins: number): string {
  let h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const period = h >= 12 ? "م" : "ص";
  h = h % 12;
  if (h === 0) h = 12;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${h}:${mStr} ${period}`;
}

export interface PositionedOrder {
  order: CalendarOrder;
  startMinutes: number;
  durationMinutes: number;
  colIndex: number;
  totalCols: number;
  topPx: number;
  heightPx: number;
}

/** Calculates multi-column layout for overlapping orders on the 06:00-23:00 day timeline. */
export function computeHourlyMultiColumnLayout(
  orders: CalendarOrder[],
  pixelsPerHour = 72,
): PositionedOrder[] {
  const START_DAY_MINUTES = 6 * 60;
  const DEFAULT_DURATION = 60;

  const items = orders.map((order) => {
    const rawMins = parseTimeInMinutes(order.requested_time);
    const startM = Math.max(0, rawMins - START_DAY_MINUTES);
    return {
      order,
      start: startM,
      end: startM + DEFAULT_DURATION,
      colIndex: 0,
      totalCols: 1,
    };
  });

  items.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const clusters: (typeof items)[] = [];
  let currentCluster: typeof items = [];
  let clusterEnd = -1;

  for (const item of items) {
    if (currentCluster.length === 0 || item.start < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.end;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: PositionedOrder[] = [];

  for (const cluster of clusters) {
    const columns: (typeof items)[0][] = [];

    for (const item of cluster) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        if (col && col.end <= item.start) {
          columns[c] = item;
          item.colIndex = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        item.colIndex = columns.length;
        columns.push(item);
      }
    }

    const numCols = columns.length;
    for (const item of cluster) {
      const topPx = (item.start / 60) * pixelsPerHour;
      const heightPx = Math.max(54, ((item.end - item.start) / 60) * pixelsPerHour - 4);
      result.push({
        order: item.order,
        startMinutes: item.start,
        durationMinutes: item.end - item.start,
        colIndex: item.colIndex,
        totalCols: numCols,
        topPx,
        heightPx,
      });
    }
  }

  return result;
}
