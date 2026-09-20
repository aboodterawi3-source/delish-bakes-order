import { memo, useMemo, useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  Maximize2,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Printer,
  Sparkles,
  Store,
  Truck,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { updateSalesOrder, type OrderPatch, type SalesOrder, type SalesStatus } from "@/lib/sales.functions";
import { orderLabel } from "@/lib/order-label";
import { esc, printDocument } from "@/lib/print";

export type CalendarViewMode = "month" | "day";

const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS_AR = [
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

export const STATUS_CONFIG: Record<
  SalesStatus,
  {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    ar: string;
  }
> = {
  new: {
    bg: "bg-amber-50/90 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-700",
    text: "text-amber-950 dark:text-amber-200",
    badgeBg: "bg-amber-500",
    badgeText: "text-white",
    ar: "جديد 🆕",
  },
  confirmed: {
    bg: "bg-sky-50/90 dark:bg-sky-950/40",
    border: "border-sky-300 dark:border-sky-700",
    text: "text-sky-950 dark:text-sky-200",
    badgeBg: "bg-sky-500",
    badgeText: "text-white",
    ar: "مؤكد 🤝",
  },
  baking: {
    bg: "bg-amber-100/90 dark:bg-amber-900/50",
    border: "border-amber-400 dark:border-amber-600",
    text: "text-amber-950 dark:text-amber-100",
    badgeBg: "bg-amber-600",
    badgeText: "text-white",
    ar: "قيد التجهيز 🎂",
  },
  ready: {
    bg: "bg-emerald-50/90 dark:bg-emerald-950/40",
    border: "border-emerald-400 dark:border-emerald-700",
    text: "text-emerald-950 dark:text-emerald-200",
    badgeBg: "bg-emerald-600",
    badgeText: "text-white",
    ar: "جاهز ✨",
  },
  out_for_delivery: {
    bg: "bg-blue-50/90 dark:bg-blue-950/40",
    border: "border-blue-400 dark:border-blue-700",
    text: "text-blue-950 dark:text-blue-200",
    badgeBg: "bg-blue-600",
    badgeText: "text-white",
    ar: "خرج للتوصيل 🚗",
  },
  completed: {
    bg: "bg-slate-100/80 dark:bg-slate-900/60",
    border: "border-slate-300 dark:border-slate-700",
    text: "text-slate-800 dark:text-slate-200",
    badgeBg: "bg-slate-600",
    badgeText: "text-white",
    ar: "مكتمل ✅",
  },
  delivered: {
    bg: "bg-teal-50/90 dark:bg-teal-950/40",
    border: "border-teal-400 dark:border-teal-700",
    text: "text-teal-950 dark:text-teal-200",
    badgeBg: "bg-teal-600",
    badgeText: "text-white",
    ar: "تم التسليم 📦",
  },
  cancelled: {
    bg: "bg-rose-50/90 dark:bg-rose-950/40",
    border: "border-rose-300 dark:border-rose-700",
    text: "text-rose-950 dark:text-rose-200",
    badgeBg: "bg-rose-600",
    badgeText: "text-white",
    ar: "ملغى ❌",
  },
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: "نقداً عند الاستلام 💵",
  cliq: "كليك (CliQ) 📲",
  visa: "بطاقة ائتمان 💳",
};

/** Parse HH:mm time string to minutes from midnight */
function parseTimeInMinutes(timeStr: string): number {
  if (!timeStr) return 9 * 60; // default 9:00 AM
  const parts = timeStr.split(":").map(Number);
  const h = parts[0];
  const m = parts[1];
  if (h === undefined || isNaN(h)) return 9 * 60;
  return h * 60 + (m === undefined || isNaN(m) ? 0 : m);
}

/** Format time in minutes to 12-hour Arabic format (e.g. 9:00 ص) */
function formatMinutesArabic(totalMins: number): string {
  let h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const period = h >= 12 ? "م" : "ص";
  h = h % 12;
  if (h === 0) h = 12;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${h}:${mStr} ${period}`;
}

/** Positioned Order layout metadata for multi-column same-hour scheduling */
interface PositionedOrder {
  order: SalesOrder;
  startMinutes: number; // minutes from 06:00 AM
  durationMinutes: number;
  colIndex: number;
  totalCols: number;
  topPx: number;
  heightPx: number;
}

/**
 * Calculates multi-column parallel sub-column layout for orders occurring at the same hour
 * timeline bounds: 06:00 AM to 11:00 PM (18 hours total = 1080 mins)
 */
function computeHourlyMultiColumnLayout(orders: SalesOrder[], pixelsPerHour = 72): PositionedOrder[] {
  const START_DAY_MINUTES = 6 * 60; // 06:00 AM
  const DEFAULT_DURATION = 60; // 1 hour block height

  const items = orders.map((order) => {
    const rawMins = parseTimeInMinutes(order.requested_time);
    const startM = Math.max(0, rawMins - START_DAY_MINUTES);
    const dur = DEFAULT_DURATION;
    return {
      order,
      start: startM,
      end: startM + dur,
      colIndex: 0,
      totalCols: 1,
    };
  });

  // Sort by start time, then by longer duration first
  items.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Find overlapping clusters
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

/** Print single order receipt */
function printOrderReceipt(order: SalesOrder) {
  const payLabel = order.payment_method ? (PAYMENT_METHOD_MAP[order.payment_method] ?? order.payment_method) : "—";
  const remaining = order.total - order.deposit_paid;
  const itemsRows = (order.items ?? [])
    .map(
      (item) => `
    <div class="item">
      <div class="row"><b>${esc(item.name_ar)} x${item.quantity}</b><b>${(item.unit_price * item.quantity).toFixed(2)}</b></div>
      ${item.options_ar?.length ? `<div class="opt">${esc(item.options_ar.join(" ، "))}</div>` : ""}
      ${item.notes ? `<div class="note">ملاحظة: ${esc(item.notes)}</div>` : ""}
    </div>`,
    )
    .join("");

  const body = `
    <h1>ديليش كيك DELISH BAKES</h1>
    <div style="text-align:center;font-weight:700">بون الطلب الإداري</div>
    <div class="line"></div>
    <div class="row"><span>رقم الأوردر:</span><b>${esc(orderLabel(order.order_number, order.staff_code))}</b></div>
    <div class="row"><span>تاريخ وموعد التسليم:</span><span>${esc(order.requested_date)} ${esc(order.requested_time.slice(0, 5))}</span></div>
    <div class="row"><span>العميل:</span><span>${esc(order.customer_name)} (${esc(order.customer_phone)})</span></div>
    <div class="row"><span>نوع التسليم:</span><span>${order.method === "delivery" ? `توصيل: ${esc(order.area ?? "")} ${esc(order.address ?? "")}` : "استلام من المحل"}</span></div>
    ${order.inscription ? `<div class="line"></div><div class="note">✍️ الكتابة: ${esc(order.inscription)}</div>` : ""}
    ${order.notes ? `<div class="note">📝 ملاحظات: ${esc(order.notes)}</div>` : ""}
    <div class="line"></div>
    ${itemsRows}
    <div class="line"></div>
    <div class="row"><span>المجموع الفرعي</span><span>${order.subtotal.toFixed(2)} د.أ</span></div>
    ${order.delivery_fee ? `<div class="row"><span>أجرة التوصيل</span><span>${order.delivery_fee.toFixed(2)} د.أ</span></div>` : ""}
    ${order.discount_amount ? `<div class="row"><span>الخصم</span><span>-${order.discount_amount.toFixed(2)} د.أ</span></div>` : ""}
    <div class="row"><b>الإجمالي</b><b>${order.total.toFixed(2)} د.أ</b></div>
    <div class="row"><span>المدفوع</span><span>${order.deposit_paid.toFixed(2)} د.أ</span></div>
    <div class="row"><b>المتبقي</b><b>${remaining.toFixed(2)} د.أ</b></div>
    <div class="row"><span>طريقة الدفع</span><span>${esc(payLabel)}</span></div>
    <div class="line"></div>
    <div style="text-align:center">شكراً لاختياركم ديليش 🤍</div>
  `;

  if (!printDocument(`إيصال ${order.order_number}`, body, "b{font-size:13px}")) {
    toast.error("تعذر فتح نافذة الطباعة");
  }
}

export interface OrdersCalendarProps {
  orders: SalesOrder[];
  onOpen: (id: string) => void;
  onPatch?: (input: OrderPatch) => void;
}

export const OrdersCalendar = memo(function OrdersCalendar({ orders, onOpen, onPatch }: OrdersCalendarProps) {
  const updateOrderServerFn = useServerFn(updateSalesOrder);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [statusFilter, setStatusFilter] = useState<SalesStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Touch Long-Press Dragging State
  const [dragging, setDragging] = useState<{
    order: SalesOrder;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    targetHour: number; // 6 to 23
  } | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingActive = useRef<boolean>(false);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  // Active YYYY-MM-DD
  const dateISO = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    const d = String(currentDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [currentDate]);

  // Status Filtered orders
  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  // Orders for current active date
  const dayOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.requested_date === dateISO);
  }, [filteredOrders, dateISO]);

  // Compute multi-column positioning for day view
  const positionedDayOrders = useMemo(() => {
    return computeHourlyMultiColumnLayout(dayOrders, 72);
  }, [dayOrders]);

  // Touch / Pointer Handlers for 300ms Long-Press Touch Dragging
  const handlePointerDown = (e: React.PointerEvent, ord: SalesOrder) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const startX = e.clientX;
    const startY = e.clientY;
    startPos.current = { x: startX, y: startY };
    isDraggingActive.current = false;
    const targetElement = e.currentTarget as HTMLElement;

    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    longPressTimer.current = setTimeout(() => {
      // Haptic Vibration feedback on touch screens
      if (typeof window !== "undefined" && window.navigator?.vibrate) {
        try {
          window.navigator.vibrate(40);
        } catch {
          /* ignore */
        }
      }

      isDraggingActive.current = true;
      try {
        targetElement.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const initialHour = Math.floor(parseTimeInMinutes(ord.requested_time) / 60);
      const clampedHour = Math.min(Math.max(initialHour, 6), 23);

      setDragging({
        order: ord,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        targetHour: clampedHour,
      });
    }, 300);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingActive.current && longPressTimer.current) {
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (dx > 6 || dy > 6) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      return;
    }

    if (isDraggingActive.current && dragging) {
      e.preventDefault();
      const currentX = e.clientX;
      const currentY = e.clientY;

      let targetHour = dragging.targetHour;
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const relativeY = currentY - rect.top;
        const rawHour = 6 + Math.floor(relativeY / 72);
        targetHour = Math.min(Math.max(rawHour, 6), 23);
      }

      setDragging((prev) => (prev ? { ...prev, currentX, currentY, targetHour } : null));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isDraggingActive.current && dragging) {
      e.preventDefault();
      const finalHour = dragging.targetHour;
      const orderToMove = dragging.order;
      const targetTimeStr = `${String(finalHour).padStart(2, "0")}:00:00`;
      const displayTime = formatMinutesArabic(finalHour * 60);

      isDraggingActive.current = false;
      setDragging(null);

      // Perform mutation
      if (onPatch) {
        onPatch({ orderId: orderToMove.id, requested_time: targetTimeStr });
      } else {
        updateOrderServerFn({ data: { orderId: orderToMove.id, requested_time: targetTimeStr } }).catch(() => {
          toast.error("تعذر تحديث موعد الطلب");
        });
      }

      toast.success(`✨ تم نقل الطلب إلى الساعة ${displayTime} بنجاح`);
      return;
    }

    isDraggingActive.current = false;
  };

  // Navigation helpers
  const handleToday = () => setCurrentDate(new Date());

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === "month") {
      next.setMonth(next.getMonth() - 1);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === "month") {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  // Surrounding 7 days strip for Day Timeline View
  const surroundingDays = useMemo(() => {
    const result = [];
    const base = new Date(currentDate);
    base.setDate(base.getDate() - 3);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      result.push({
        date: d,
        iso,
        dayNum: d.getDate(),
        dayName: WEEKDAYS_AR[d.getDay()],
        isToday: new Date().toDateString() === d.toDateString(),
        isSelected: currentDate.toDateString() === d.toDateString(),
        count: filteredOrders.filter((o) => o.requested_date === iso).length,
      });
    }
    return result;
  }, [currentDate, filteredOrders]);

  // Month grid days calculation
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const grid = [];

    // Prev month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const d = new Date(year, month - 1, dayNum);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      grid.push({
        date: d,
        iso,
        dayNum,
        isCurrentMonth: false,
        isToday: false,
        orders: filteredOrders.filter((o) => o.requested_date === iso),
      });
    }

    // Current month days
    const todayISO = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const d = new Date(year, month, dayNum);
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      grid.push({
        date: d,
        iso,
        dayNum,
        isCurrentMonth: true,
        isToday: iso === todayISO,
        orders: filteredOrders.filter((o) => o.requested_date === iso),
      });
    }

    // Next month padding
    const remaining = 42 - grid.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      grid.push({
        date: d,
        iso,
        dayNum: i,
        isCurrentMonth: false,
        isToday: false,
        orders: filteredOrders.filter((o) => o.requested_date === iso),
      });
    }

    return grid;
  }, [currentDate, filteredOrders]);

  // Clean customer phone number for WhatsApp
  const getCleanPhone = (phoneStr: string) => {
    let clean = phoneStr.replace(/\D/g, "");
    if (clean.startsWith("07")) clean = "962" + clean.slice(1);
    return clean;
  };

  return (
    <div
      className="flex flex-col rounded-2xl border border-border bg-card shadow-lg text-card-foreground overflow-hidden transition-all select-none"
      dir="rtl"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 1. CALENDAR CONTROL HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 p-3 sm:p-4">
        {/* Left (RTL): Navigation & Title */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/20 active:scale-95"
          >
            اليوم
          </button>
          <div className="flex items-center rounded-xl border border-border bg-background p-0.5 shadow-sm">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-sm font-black text-foreground sm:text-base">
            {viewMode === "month"
              ? `${MONTHS_AR[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : `${WEEKDAYS_AR[currentDate.getDay()]}، ${currentDate.getDate()} ${MONTHS_AR[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          </h2>
        </div>

        {/* Right (RTL): View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-muted p-1 border border-border">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`min-h-8 rounded-lg px-3 text-xs font-bold transition-all ${
                viewMode === "month"
                  ? "bg-background text-primary shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📅 شهر
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`min-h-8 rounded-lg px-3 text-xs font-bold transition-all ${
                viewMode === "day"
                  ? "bg-background text-primary shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🕒 يوم بالساعات
            </button>
          </div>
        </div>
      </div>

      {/* STATUS QUICK FILTER STRIP */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-background p-2 text-xs no-scrollbar">
        <span className="flex items-center gap-1 font-bold text-muted-foreground pl-1 shrink-0">
          <Filter className="h-3.5 w-3.5" /> تصفية:
        </span>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all ${
            statusFilter === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          الكل ({orders.length})
        </button>
        {(Object.keys(STATUS_CONFIG) as SalesStatus[]).map((st) => {
          const cfg = STATUS_CONFIG[st];
          const count = orders.filter((o) => o.status === st).length;
          if (count === 0 && statusFilter !== st) return null;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold border transition-all ${
                statusFilter === st
                  ? `${cfg.badgeBg} ${cfg.badgeText} border-transparent shadow-sm`
                  : `border-border bg-background text-foreground hover:bg-muted`
              }`}
            >
              {cfg.ar} ({count})
            </button>
          );
        })}
      </div>

      {/* 2. DAY VIEW: HORIZONTAL WEEKDAY SELECTOR STRIP */}
      {viewMode === "day" ? (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-muted/20 p-2 text-center no-scrollbar">
          {surroundingDays.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setCurrentDate(d.date)}
              className={`flex shrink-0 min-w-[72px] flex-col items-center justify-center rounded-xl p-2 transition-all ${
                d.isSelected
                  ? "bg-primary text-primary-foreground font-black shadow-md ring-2 ring-primary/40"
                  : d.isToday
                  ? "bg-primary/10 text-primary border border-primary/30 font-bold"
                  : "bg-background border border-border text-foreground hover:bg-muted"
              }`}
            >
              <span className="text-[11px] opacity-80">{d.dayName}</span>
              <span className="text-base font-black leading-tight">{d.dayNum}</span>
              {d.count > 0 ? (
                <span
                  className={`mt-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    d.isSelected ? "bg-white/20 text-white" : "bg-primary/20 text-primary"
                  }`}
                >
                  {d.count} طلب
                </span>
              ) : (
                <span className="mt-1 h-3 text-[10px] opacity-40">—</span>
              )}
            </button>
          ))}
        </div>
      ) : null}

      {/* 3. CALENDAR CONTENT AREA */}
      {viewMode === "month" ? (
        /* MONTH GRID VIEW */
        <div className="flex flex-col">
          {/* Weekday Labels Header */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-black text-muted-foreground">
            {WEEKDAYS_AR.map((wd) => (
              <div key={wd} className="py-2.5">
                {wd}
              </div>
            ))}
          </div>

          {/* 7-Column Grid */}
          <div className="grid grid-cols-7 border-collapse">
            {monthGridDays.map((cell, idx) => (
              <div
                key={cell.iso + idx}
                onClick={() => {
                  setCurrentDate(cell.date);
                  setViewMode("day");
                }}
                className={`group min-h-[110px] border-b border-l border-border p-1.5 transition-colors cursor-pointer hover:bg-muted/30 ${
                  !cell.isCurrentMonth ? "bg-muted/10 opacity-50" : "bg-background"
                }`}
              >
                {/* Cell Date Pill */}
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      cell.isToday
                        ? "bg-primary text-primary-foreground font-black shadow-sm"
                        : cell.isCurrentMonth
                        ? "text-foreground group-hover:bg-accent"
                        : "text-muted-foreground"
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {cell.orders.length > 0 ? (
                    <span className="text-[10px] font-bold text-muted-foreground">{cell.orders.length} طلبات</span>
                  ) : null}
                </div>

                {/* Order Chips */}
                <div className="space-y-1">
                  {cell.orders.slice(0, 3).map((ord) => {
                    const cfg = STATUS_CONFIG[ord.status] ?? STATUS_CONFIG.new;
                    const code = orderLabel(ord.order_number, ord.staff_code);
                    const timeStr = ord.requested_time ? ord.requested_time.slice(0, 5) : "";
                    const firstItem = ord.items?.[0]?.name_ar ?? "كيكة";

                    return (
                      <div
                        key={ord.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(ord);
                        }}
                        className={`truncate rounded-lg border px-1.5 py-1 text-[11px] font-bold transition-transform hover:scale-[1.02] shadow-2xs ${cfg.bg} ${cfg.border} ${cfg.text}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="shrink-0 font-black">{timeStr}</span>
                          <span className="truncate">{code}</span>
                        </div>
                        <div className="truncate text-[10px] opacity-80">
                          {ord.area ? ord.area : firstItem}
                        </div>
                      </div>
                    );
                  })}
                  {cell.orders.length > 3 ? (
                    <div className="text-center text-[10px] font-bold text-primary hover:underline">
                      +{cell.orders.length - 3} طلبات أخرى
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* DAY HOURLY TIMELINE VIEW (06:00 AM to 11:00 PM) WITH TOUCH LONG-PRESS DRAG & DROP */
        <div className="relative flex flex-col bg-background">
          <div className="max-h-[640px] overflow-y-auto overflow-x-hidden relative" ref={timelineRef}>
            {/* Hourly Rows Grid */}
            <div className="relative min-h-[1296px] w-full border-b border-border">
              {/* 18 Hours Rows (06:00 AM to 11:00 PM) */}
              {Array.from({ length: 18 }).map((_, hourIndex) => {
                const hourNum = 6 + hourIndex; // 6 to 23
                const label = formatMinutesArabic(hourNum * 60);

                return (
                  <div
                    key={hourNum}
                    className="flex h-[72px] border-b border-border/60 text-xs font-semibold text-muted-foreground relative"
                  >
                    {/* Time Label Column */}
                    <div className="w-16 sm:w-20 shrink-0 border-l border-border/60 bg-muted/10 p-2 text-left font-mono font-bold select-none">
                      {label}
                    </div>

                    {/* Hourly Horizontal Guide Line */}
                    <div className="flex-1 relative">
                      <div className="absolute inset-x-0 top-0 border-t border-dashed border-border/40 pointer-events-none" />
                    </div>
                  </div>
                );
              })}

              {/* TARGET HOUR DROP HIGHLIGHT BOX (When Dragging on Touch) */}
              {dragging ? (
                <div
                  style={{ top: `${(dragging.targetHour - 6) * 72}px`, height: "72px" }}
                  className="absolute inset-x-0 right-16 sm:right-20 z-20 flex items-center justify-between bg-primary/20 border-2 border-dashed border-primary px-4 rounded-xl shadow-lg pointer-events-none transition-all animate-pulse"
                >
                  <span className="text-xs font-black text-primary bg-background px-3 py-1 rounded-full shadow-sm">
                    🎯 نقل الطلب إلى الساعة {formatMinutesArabic(dragging.targetHour * 60)}
                  </span>
                  <span className="text-xs font-bold text-primary">اترك الإصبع للإسقاط</span>
                </div>
              ) : null}

              {/* LIVE CURRENT TIME INDICATOR BAR */}
              {currentDate.toDateString() === new Date().toDateString() ? (
                (() => {
                  const now = new Date();
                  const currentMins = now.getHours() * 60 + now.getMinutes();
                  const startMins = 6 * 60;
                  if (currentMins >= startMins && currentMins <= 23 * 60) {
                    const topPx = ((currentMins - startMins) / 60) * 72;
                    return (
                      <div
                        style={{ top: `${topPx}px` }}
                        className="absolute inset-x-0 z-20 flex items-center pointer-events-none"
                      >
                        <div className="mr-14 sm:mr-18 flex items-center gap-1 w-full">
                          <div className="h-3 w-3 rounded-full bg-rose-500 ring-4 ring-rose-500/20 shadow-sm" />
                          <div className="h-0.5 w-full bg-rose-500 shadow-xs" />
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()
              ) : null}

              {/* POSITIONED MULTI-COLUMN EVENT CARDS WITH TOUCH LONG-PRESS DRAG */}
              <div className="absolute top-0 bottom-0 right-16 sm:right-20 left-0 z-10">
                {positionedDayOrders.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm font-bold text-muted-foreground">
                    لا توجد طلبات مسجلة لهذا اليوم 🎉
                  </div>
                ) : (
                  positionedDayOrders.map((pos) => {
                    const ord = pos.order;
                    const cfg = STATUS_CONFIG[ord.status] ?? STATUS_CONFIG.new;
                    const code = orderLabel(ord.order_number, ord.staff_code);
                    const mainItem = ord.items?.[0]?.name_ar ?? "كيكة مخصصة";
                    const locationText = ord.method === "delivery" ? ord.area ?? "توصيل" : "استلام من المحل";
                    const timeWindow = `${formatMinutesArabic(parseTimeInMinutes(ord.requested_time))} - ${formatMinutesArabic(parseTimeInMinutes(ord.requested_time) + 60)}`;

                    // RTL Sub-column placement logic
                    const widthPercent = 100 / pos.totalCols;
                    const rightPercent = pos.colIndex * widthPercent;
                    const isBeingDragged = dragging?.order.id === ord.id;

                    return (
                      <div
                        key={ord.id}
                        onPointerDown={(e) => handlePointerDown(e, ord)}
                        onClick={() => {
                          if (!isDraggingActive.current) {
                            setSelectedOrder(ord);
                          }
                        }}
                        style={{
                          top: `${pos.topPx}px`,
                          height: `${pos.heightPx}px`,
                          right: `${rightPercent}%`,
                          width: `calc(${widthPercent}% - 4px)`,
                          touchAction: "none",
                          userSelect: "none",
                          WebkitUserSelect: "none",
                          WebkitTouchCallout: "none",
                        }}
                        className={`order-item absolute rounded-xl border p-2.5 shadow-md cursor-grab active:cursor-grabbing transition-all hover:scale-[1.01] hover:z-30 overflow-hidden flex flex-col justify-between ${cfg.bg} ${cfg.border} ${cfg.text} ${
                          isBeingDragged ? "opacity-30 scale-95 border-dashed border-primary" : ""
                        }`}
                      >
                        {/* Card Header: Code + Status Badge */}
                        <div className="flex items-center justify-between gap-1 pointer-events-none">
                          <span className="inline-flex items-center gap-1 rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-[11px] font-black dir-ltr">
                            {code}
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${cfg.badgeBg} ${cfg.badgeText}`}>
                            {cfg.ar}
                          </span>
                        </div>

                        {/* Card Body: Customer & Location */}
                        <div className="mt-1 space-y-0.5 pointer-events-none">
                          <div className="flex items-center gap-1 text-xs font-black truncate">
                            {ord.method === "delivery" ? <Truck className="h-3.5 w-3.5 text-blue-600 shrink-0" /> : <Store className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                            <span className="truncate">{ord.customer_name}</span>
                          </div>
                          <div className="text-[11px] font-bold opacity-90 truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" /> {locationText} • {mainItem}
                          </div>
                        </div>

                        {/* Card Footer: Time slot */}
                        <div className="mt-1 flex items-center justify-between text-[10px] font-bold opacity-75 pointer-events-none">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {timeWindow}
                          </span>
                          <span>{ord.total.toFixed(2)} د.أ</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING GHOST CARD PREVIEW DURING TOUCH DRAG */}
      {dragging ? (
        <div
          style={{
            position: "fixed",
            left: dragging.currentX - 110,
            top: dragging.currentY - 35,
            width: "220px",
            zIndex: 99999,
            pointerEvents: "none",
          }}
          className="rounded-2xl border-2 border-primary bg-card p-3 shadow-2xl ring-4 ring-primary/40 rotate-2 scale-105 transition-transform"
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-1 text-xs font-black text-primary">
            <span>{orderLabel(dragging.order.order_number, dragging.order.staff_code)}</span>
            <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
              سحب ✋
            </span>
          </div>
          <div className="text-xs font-black text-foreground mt-1 truncate">
            {dragging.order.customer_name}
          </div>
          <div className="text-[11px] font-bold text-primary mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" /> نقل إلى: {formatMinutesArabic(dragging.targetHour * 60)}
          </div>
        </div>
      ) : null}

      {/* 4. STRUCTURED ORDER DETAILS MODAL / SHEET */}
      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card text-card-foreground shadow-2xl transition-all">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    {selectedOrder.area ?? (selectedOrder.method === "delivery" ? "توصيل" : "استلام محل")} • {orderLabel(selectedOrder.order_number, selectedOrder.staff_code)}
                  </h3>
                  <p className="text-xs font-bold text-muted-foreground">
                    نافذة التسليم: {formatMinutesArabic(parseTimeInMinutes(selectedOrder.requested_time))} - {formatMinutesArabic(parseTimeInMinutes(selectedOrder.requested_time) + 60)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Status & Code Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-3 border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">حالة الأوردر:</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${(STATUS_CONFIG[selectedOrder.status] ?? STATUS_CONFIG.new).badgeBg} ${(STATUS_CONFIG[selectedOrder.status] ?? STATUS_CONFIG.new).badgeText}`}>
                    {(STATUS_CONFIG[selectedOrder.status] ?? STATUS_CONFIG.new).ar}
                  </span>
                </div>
                {selectedOrder.staff_code ? (
                  <span className="text-xs font-bold text-muted-foreground">
                    كود الموظف: <b className="text-foreground">{selectedOrder.staff_code}</b>
                  </span>
                ) : null}
              </div>

              {/* Customer & Direct Action Buttons */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-muted-foreground">العميل</span>
                    <h4 className="text-base font-black text-foreground">{selectedOrder.customer_name}</h4>
                  </div>
                  <span className="font-mono text-sm font-bold text-muted-foreground">{selectedOrder.customer_phone}</span>
                </div>

                {/* 1-Tap Call & WhatsApp Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={`tel:${selectedOrder.customer_phone}`}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    <Phone className="h-4 w-4" /> 📞 اتصال مباشر
                  </a>
                  <a
                    href={`https://wa.me/${getCleanPhone(selectedOrder.customer_phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-sm hover:bg-emerald-600 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" /> 💬 واتساب
                  </a>
                </div>
              </div>

              {/* Date & Fulfillment */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <h4 className="text-xs font-black text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" /> موعد ونوع التسليم
                </h4>
                <div className="text-sm font-bold text-foreground">
                  📅 {selectedOrder.requested_date} — الساعة {formatMinutesArabic(parseTimeInMinutes(selectedOrder.requested_time))}
                </div>
                <div className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  {selectedOrder.method === "delivery" ? (
                    <>
                      <Truck className="h-4 w-4 text-blue-500" /> توصيل إلى: {selectedOrder.area ?? "منطقة غير محددة"} {selectedOrder.address ? `— ${selectedOrder.address}` : ""} (أجرة: {selectedOrder.delivery_fee.toFixed(2)} د.أ)
                    </>
                  ) : (
                    <>
                      <Store className="h-4 w-4 text-amber-500" /> استلام مباشر من الفرع/المحل
                    </>
                  )}
                </div>
              </div>

              {/* Items & Options */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <h4 className="text-xs font-black text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> تفاصيل الكيك والمنتجات
                </h4>
                <div className="divide-y divide-border">
                  {selectedOrder.items?.map((it) => (
                    <div key={it.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between text-sm font-bold">
                        <span>{it.name_ar} (x{it.quantity})</span>
                        <span>{(it.unit_price * it.quantity).toFixed(2)} د.أ</span>
                      </div>
                      {it.options_ar?.length ? (
                        <div className="text-xs font-semibold text-muted-foreground mt-0.5">
                          الخيارات: {it.options_ar.join(" ، ")}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Inscription Text */}
              {selectedOrder.inscription ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                  <h4 className="text-xs font-black text-primary mb-1">✍️ الكتابة على الكيك / القاعدة:</h4>
                  <p className="text-sm font-bold text-foreground bg-background p-2.5 rounded-xl border border-border">
                    "{selectedOrder.inscription}"
                  </p>
                </div>
              ) : null}

              {/* Notes & Design Reference Image */}
              {selectedOrder.notes || selectedOrder.design_image_url ? (
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <h4 className="text-xs font-black text-muted-foreground">📝 ملاحظات خاصة وصورة التصميم</h4>
                  {selectedOrder.notes ? (
                    <p className="text-xs font-bold text-foreground bg-muted p-2.5 rounded-xl">{selectedOrder.notes}</p>
                  ) : null}
                  {selectedOrder.design_image_url ? (
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground block mb-1">صورة التصميم المرفقة:</span>
                      <img
                        src={selectedOrder.design_image_url}
                        alt="Design Reference"
                        onClick={() => setZoomImage(selectedOrder.design_image_url)}
                        className="h-28 w-28 rounded-xl object-cover border border-border cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Financial Calculation & Payment */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-xs font-bold">
                <h4 className="text-xs font-black text-muted-foreground mb-2">💵 الحساب المالي وطريقة الدفع</h4>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المجموع الفرعي:</span>
                  <span>{selectedOrder.subtotal.toFixed(2)} د.أ</span>
                </div>
                {selectedOrder.delivery_fee > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">أجرة التوصيل:</span>
                    <span>+{selectedOrder.delivery_fee.toFixed(2)} د.أ</span>
                  </div>
                ) : null}
                {selectedOrder.discount_amount > 0 ? (
                  <div className="flex justify-between text-rose-600">
                    <span>الخصم:</span>
                    <span>-{selectedOrder.discount_amount.toFixed(2)} د.أ</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm font-black pt-1 border-t border-border">
                  <span>الإجمالي النهائي:</span>
                  <span className="text-primary">{selectedOrder.total.toFixed(2)} د.أ</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>المدفوع (العربون):</span>
                  <span>{selectedOrder.deposit_paid.toFixed(2)} د.أ</span>
                </div>
                <div className="flex justify-between text-amber-600 font-black text-sm">
                  <span>المتبقي المطلوب:</span>
                  <span>{(selectedOrder.total - selectedOrder.deposit_paid).toFixed(2)} د.أ</span>
                </div>
                <div className="pt-2 border-t border-border flex items-center justify-between text-muted-foreground">
                  <span>طريقة الدفع:</span>
                  <span className="font-bold text-foreground">
                    {selectedOrder.payment_method ? (PAYMENT_METHOD_MAP[selectedOrder.payment_method] ?? selectedOrder.payment_method) : "لم تحدد"}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Bottom Action Controls */}
            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t border-border bg-card/95 p-4 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  const id = selectedOrder.id;
                  setSelectedOrder(null);
                  onOpen(id);
                }}
                className="flex flex-1 min-h-11 items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-sm hover:opacity-90 transition-opacity"
              >
                <Pencil className="h-4 w-4" /> ✏️ تعديل كامل الطلب
              </button>
              <button
                type="button"
                onClick={() => printOrderReceipt(selectedOrder)}
                className="flex flex-1 min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-muted text-foreground font-bold text-xs hover:bg-accent transition-colors"
              >
                <Printer className="h-4 w-4" /> 🖨️ طباعة البون
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* IMAGE ZOOM MODAL */}
      {zoomImage ? (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={zoomImage} alt="Zoomed view" className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
