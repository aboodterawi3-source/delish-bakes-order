import { memo, useMemo, useState, useEffect } from "react";
import {
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Filter,
  MapPin,
  Maximize2,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  User,
  X,
} from "lucide-react";
import type { SalesOrder, SalesStatus } from "@/lib/sales.functions";
import { orderLabel } from "@/lib/order-label";

export type CalendarViewMode = "month" | "week" | "day" | "agenda";

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
    bg: "bg-amber-50/90",
    border: "border-amber-300",
    text: "text-amber-950",
    badgeBg: "bg-amber-500",
    badgeText: "text-white",
    ar: "جديد 🆕",
  },
  confirmed: {
    bg: "bg-sky-50/90",
    border: "border-sky-300",
    text: "text-sky-950",
    badgeBg: "bg-sky-500",
    badgeText: "text-white",
    ar: "مؤكد 🤝",
  },
  baking: {
    bg: "bg-amber-100/90",
    border: "border-amber-400",
    text: "text-amber-950",
    badgeBg: "bg-amber-600",
    badgeText: "text-white",
    ar: "قيد التجهيز 🎂",
  },
  ready: {
    bg: "bg-emerald-50/90",
    border: "border-emerald-400",
    text: "text-emerald-950",
    badgeBg: "bg-emerald-600",
    badgeText: "text-white",
    ar: "جاهز ✨",
  },
  out_for_delivery: {
    bg: "bg-blue-50/90",
    border: "border-blue-400",
    text: "text-blue-950",
    badgeBg: "bg-blue-600",
    badgeText: "text-white",
    ar: "خرج للتوصيل 🚗",
  },
  completed: {
    bg: "bg-slate-100/80",
    border: "border-slate-300",
    text: "text-slate-800",
    badgeBg: "bg-slate-600",
    badgeText: "text-white",
    ar: "مكتمل ✅",
  },
  delivered: {
    bg: "bg-emerald-50/80",
    border: "border-emerald-300",
    text: "text-emerald-900",
    badgeBg: "bg-emerald-600",
    badgeText: "text-white",
    ar: "تم التسليم 🌸",
  },
  cancelled: {
    bg: "bg-red-50/90",
    border: "border-red-300",
    text: "text-red-900 line-through opacity-70",
    badgeBg: "bg-red-600",
    badgeText: "text-white",
    ar: "ملغى ❌",
  },
};

/** Formats YYYY-MM-DD into a JS Date object safely */
function parseIsoDate(isoStr: string): Date {
  const [y, m, d] = isoStr.split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}

/** Converts Date to YYYY-MM-DD string */
function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses time string ("14:30:00" or "09:15") into minutes from 00:00 midnight */
function parseTimeInMinutes(timeStr: string): number {
  if (!timeStr) return 9 * 60; // Default 09:00 AM
  const parts = timeStr.trim().split(":");
  const hours = Number(parts[0]) || 0;
  const minutes = Number(parts[1]) || 0;
  return hours * 60 + minutes;
}

/** Formats 24h time ("14:30") into readable 12h Arabic time string (2:30 م) */
function formatArabicTime(timeStr: string): string {
  if (!timeStr) return "—";
  const mins = parseTimeInMinutes(timeStr);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "م" : "ص";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Extracts cake / item tag for compact display */
function productSummaryTag(order: SalesOrder): string {
  const first = order.items[0];
  if (!first) return order.order_name?.trim() || "كيكة مميزة";
  const nameWords = first.name_ar.trim().split(/\s+/).slice(0, 3).join(" ");
  return `${first.quantity}× ${nameWords}`;
}

type Props = {
  orders: SalesOrder[];
  onOpen: (id: string) => void;
};

export const OrdersCalendar = memo(function OrdersCalendar({ orders, onOpen }: Props) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [drawerDate, setDrawerDate] = useState<string | null>(null);

  const todayIso = useMemo(() => formatIsoDate(new Date()), []);

  // Filter orders by quick status filter
  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    if (statusFilter === "preparing") {
      return orders.filter((o) => o.status === "new" || o.status === "confirmed" || o.status === "baking");
    }
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  // Group orders by YYYY-MM-DD
  const ordersByDate = useMemo(() => {
    const map = new Map<string, SalesOrder[]>();
    for (const order of filteredOrders) {
      const dateKey = order.requested_date?.slice(0, 10);
      if (!dateKey) continue;
      const list = map.get(dateKey) ?? [];
      list.push(order);
      map.set(dateKey, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => parseTimeInMinutes(a.requested_time) - parseTimeInMinutes(b.requested_time));
    }
    return map;
  }, [filteredOrders]);

  // Navigation Handlers
  const handleToday = () => setCursorDate(new Date());

  const handlePrev = () => {
    setCursorDate((curr) => {
      const d = new Date(curr);
      if (viewMode === "month") d.setMonth(d.getMonth() - 1);
      else if (viewMode === "week") d.setDate(d.getDate() - 7);
      else if (viewMode === "day") d.setDate(d.getDate() - 1);
      else d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNext = () => {
    setCursorDate((curr) => {
      const d = new Date(curr);
      if (viewMode === "month") d.setMonth(d.getMonth() + 1);
      else if (viewMode === "week") d.setDate(d.getDate() + 7);
      else if (viewMode === "day") d.setDate(d.getDate() + 1);
      else d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  // Heading Title
  const headerTitle = useMemo(() => {
    const year = cursorDate.getFullYear();
    const monthName = MONTHS_AR[cursorDate.getMonth()];
    if (viewMode === "month" || viewMode === "agenda") {
      return `${monthName} ${year}`;
    }
    if (viewMode === "day") {
      const dayName = WEEKDAYS_AR[cursorDate.getDay()];
      const dayNum = cursorDate.getDate();
      return `${dayName}، ${dayNum} ${monthName} ${year}`;
    }
    // Week mode range
    const startOfWeek = new Date(cursorDate);
    startOfWeek.setDate(cursorDate.getDate() - cursorDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${monthName} ${year}`;
  }, [cursorDate, viewMode]);

  return (
    <section className="mt-4 space-y-4 min-w-0" aria-label="تقويم الطلبات">
      {/* ----------------- Top Controls Header ----------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#EFE8DC] bg-white p-3.5 sm:p-4 shadow-xs">
        {/* Left Navigation Controls (RTL) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#EFE8DC] bg-[#FAF5EB] px-3.5 text-xs font-bold text-[#6E3917] hover:bg-[#FEF7EB] active:scale-95 transition-all cursor-pointer"
          >
            <CalendarDays className="h-4 w-4 text-[#B8801C]" />
            <span>اليوم</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="السابق"
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#EFE8DC] bg-white text-[#4A3B32] hover:bg-[#FAF5EB] active:scale-95 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="التالي"
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#EFE8DC] bg-white text-[#4A3B32] hover:bg-[#FAF5EB] active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-sm font-black text-[#26160F] sm:text-base ms-1">
            {headerTitle}
          </h2>
        </div>

        {/* Right View Switcher & Status Filter */}
        <div className="flex flex-wrap items-center gap-2.5 ms-auto sm:ms-0">
          {/* Status Quick Filter */}
          <div className="flex items-center gap-1 rounded-xl border border-[#EFE8DC] bg-[#FAF5EB] px-2.5 py-1">
            <Filter className="h-3.5 w-3.5 text-[#B8801C]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#26160F] outline-none cursor-pointer"
            >
              <option value="all">كل الطلبات</option>
              <option value="preparing">قيد التجهيز (جديد/مؤكد/مخبوز)</option>
              <option value="ready">جاهز للاستلام</option>
              <option value="out_for_delivery">خرج للتوصيل</option>
              <option value="completed">مكتمل / تم التسليم</option>
              <option value="cancelled">ملغى</option>
            </select>
          </div>

          {/* Segmented View Switcher */}
          <div className="flex items-center gap-1 rounded-2xl border border-[#EFE8DC] bg-[#FAF5EB] p-1">
            {(
              [
                { mode: "month", label: "شهر", icon: "📅" },
                { mode: "week", label: "أسبوع", icon: "📆" },
                { mode: "day", label: "يوم", icon: "🕒" },
                { mode: "agenda", label: "جدول", icon: "📋" },
              ] as const
            ).map((item) => {
              const active = viewMode === item.mode;
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => setViewMode(item.mode)}
                  className={`flex items-center gap-1 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-[#B8801C] text-white shadow-xs scale-105"
                      : "text-[#4A3B32] hover:bg-white/60"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ----------------- Active View Render ----------------- */}
      <div className="rounded-3xl border border-[#EFE8DC] bg-white p-2 sm:p-4 shadow-xs min-h-[500px]">
        {viewMode === "month" && (
          <MonthView
            cursorDate={cursorDate}
            ordersByDate={ordersByDate}
            todayIso={todayIso}
            onOpen={onOpen}
            onOpenDay={(dateStr) => setDrawerDate(dateStr)}
          />
        )}

        {viewMode === "week" && (
          <WeekView
            cursorDate={cursorDate}
            ordersByDate={ordersByDate}
            todayIso={todayIso}
            onOpen={onOpen}
          />
        )}

        {viewMode === "day" && (
          <DayView
            cursorDate={cursorDate}
            ordersByDate={ordersByDate}
            todayIso={todayIso}
            onOpen={onOpen}
          />
        )}

        {viewMode === "agenda" && (
          <AgendaView
            ordersByDate={ordersByDate}
            onOpen={onOpen}
          />
        )}
      </div>

      {/* ----------------- Day Orders Slide-Over Drawer ----------------- */}
      {drawerDate && (
        <DayDrawer
          dateStr={drawerDate}
          orders={ordersByDate.get(drawerDate) ?? []}
          onClose={() => setDrawerDate(null)}
          onOpenOrder={(id) => {
            setDrawerDate(null);
            onOpen(id);
          }}
        />
      )}
    </section>
  );
});

/* ============================================================================
   1. Month View Component (Traditional 7-column Calendar)
   ============================================================================ */

function MonthView({
  cursorDate,
  ordersByDate,
  todayIso,
  onOpen,
  onOpenDay,
}: {
  cursorDate: Date;
  ordersByDate: Map<string, SalesOrder[]>;
  todayIso: string;
  onOpen: (id: string) => void;
  onOpenDay: (dateStr: string) => void;
}) {
  const cells = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const leadEmpty = firstDay.getDay(); // Sunday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((leadEmpty + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - leadEmpty + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return null;
      const dateStr = formatIsoDate(new Date(year, month, dayNum));
      return { day: dayNum, dateStr };
    });
  }, [cursorDate]);

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <div className="min-w-[700px]">
        {/* Days of Week Row */}
        <div className="grid grid-cols-7 border-b border-[#EFE8DC] pb-2 text-center text-xs font-black text-[#6E3917]">
          {WEEKDAYS_AR.map((name) => (
            <div key={name} className="py-1">
              {name}
            </div>
          ))}
        </div>

        {/* 7-Column Grid */}
        <div className="grid grid-cols-7 gap-1 pt-1">
          {cells.map((cell, index) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[120px] rounded-2xl bg-[#FAF5EB]/40 border border-transparent"
                />
              );
            }

            const dayOrders = ordersByDate.get(cell.dateStr) ?? [];
            const isToday = cell.dateStr === todayIso;
            const maxVisible = 3;
            const visibleOrders = dayOrders.slice(0, maxVisible);
            const extraCount = dayOrders.length - maxVisible;

            return (
              <div
                key={cell.dateStr}
                onClick={() => onOpenDay(cell.dateStr)}
                className={`group flex min-h-[130px] flex-col justify-between rounded-2xl border p-1.5 transition-all cursor-pointer ${
                  isToday
                    ? "border-2 border-[#B8801C] bg-[#FEF7EB] shadow-xs"
                    : "border-[#EFE8DC] bg-white hover:border-[#B8801C]/50 hover:bg-[#FAF5EB]/50"
                }`}
              >
                {/* Cell Header */}
                <div className="flex items-center justify-between px-1">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black transition-transform group-hover:scale-110 ${
                      isToday
                        ? "bg-[#B8801C] text-white shadow-xs"
                        : "text-[#26160F]"
                    }`}
                  >
                    {cell.day}
                  </span>
                  {dayOrders.length > 0 && (
                    <span className="text-[10px] font-extrabold text-[#6E3917]/70">
                      {dayOrders.length} طلبات
                    </span>
                  )}
                </div>

                {/* Orders List Chips */}
                <div className="mt-1 space-y-1 flex-1">
                  {visibleOrders.map((order) => {
                    const style = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
                    const isDelivery = order.method === "delivery";

                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(order.id);
                        }}
                        className={`w-full rounded-xl border p-1 text-start text-[10px] font-bold leading-tight shadow-2xs transition-all hover:scale-[1.02] cursor-pointer ${style.bg} ${style.border} ${style.text}`}
                      >
                        <div className="flex items-center justify-between gap-1 truncate">
                          <span className="truncate flex items-center gap-1">
                            <Clock3 className="h-3 w-3 shrink-0 text-[#B8801C]" />
                            {formatArabicTime(order.requested_time)}
                          </span>
                          <span>{isDelivery ? "🚗" : "🏬"}</span>
                        </div>
                        <div className="truncate font-black mt-0.5">
                          {order.customer_name} • {productSummaryTag(order)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Extra Orders Pill */}
                {extraCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDay(cell.dateStr);
                    }}
                    className="mt-1 text-center text-[10px] font-black text-[#B8801C] hover:underline"
                  >
                    +{extraCount} طلبات أخرى
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   2. Week View Component (Vertical Hourly Timeline Grid 08:00 AM - 11:00 PM)
   ============================================================================ */

function WeekView({
  cursorDate,
  ordersByDate,
  todayIso,
  onOpen,
}: {
  cursorDate: Date;
  ordersByDate: Map<string, SalesOrder[]>;
  todayIso: string;
  onOpen: (id: string) => void;
}) {
  // Compute the 7 days of the week for the current cursor
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(cursorDate);
    startOfWeek.setDate(cursorDate.getDate() - cursorDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return {
        date: d,
        dateStr: formatIsoDate(d),
        dayName: WEEKDAYS_AR[i],
        dayNum: d.getDate(),
      };
    });
  }, [cursorDate]);

  // Hours array from 08:00 to 23:00 (15 hours)
  const hours = useMemo(() => Array.from({ length: 16 }, (_, i) => i + 8), []);

  // Live current time calculation (minutes from 08:00)
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const liveLineTop = useMemo(() => {
    const start = 8 * 60; // 08:00 AM
    if (currentMinutes < start || currentMinutes > 23 * 60) return null;
    return (currentMinutes - start) * (64 / 60); // 64px per hour
  }, [currentMinutes]);

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <div className="min-w-[760px]">
        {/* Header Row: Days of the Week */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[#EFE8DC] pb-2 text-center">
          <div className="text-[11px] font-bold text-[#4A3B32]/60 flex items-center justify-center">
            الوقت
          </div>
          {weekDays.map((day) => {
            const isToday = day.dateStr === todayIso;
            return (
              <div
                key={day.dateStr}
                className={`py-1 rounded-xl flex flex-col items-center ${
                  isToday ? "bg-[#FEF7EB]" : ""
                }`}
              >
                <span className="text-xs font-bold text-[#6E3917]">{day.dayName}</span>
                <span
                  className={`mt-0.5 grid h-7 w-7 place-items-center rounded-full text-xs font-black ${
                    isToday ? "bg-[#B8801C] text-white shadow-xs" : "text-[#26160F]"
                  }`}
                >
                  {day.dayNum}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scrollable Hourly Timeline Container */}
        <div className="relative max-h-[560px] overflow-y-auto pt-2 no-scrollbar">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
            {/* Time Labels Column */}
            <div className="space-y-12 text-center text-[10px] font-bold text-[#4A3B32]/70 pt-1">
              {hours.map((h) => {
                const period = h >= 12 ? "م" : "ص";
                const displayH = h % 12 === 0 ? 12 : h % 12;
                return (
                  <div key={h} className="h-16 flex items-start justify-center border-t border-transparent">
                    {displayH}:00 {period}
                  </div>
                );
              })}
            </div>

            {/* 7 Columns for the 7 Days */}
            {weekDays.map((day) => {
              const dayOrders = ordersByDate.get(day.dateStr) ?? [];
              const isToday = day.dateStr === todayIso;

              return (
                <div
                  key={day.dateStr}
                  className={`relative border-r border-[#EFE8DC] ${
                    isToday ? "bg-[#FEF7EB]/30" : ""
                  }`}
                  style={{ minHeight: `${hours.length * 64}px` }}
                >
                  {/* Grid Lines per hour */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="h-16 border-t border-[#EFE8DC]/60 hover:bg-[#FAF5EB]/40 transition-colors"
                    />
                  ))}

                  {/* Red/Gold Live Time Line Indicator */}
                  {isToday && liveLineTop !== null && (
                    <div
                      className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                      style={{ top: `${liveLineTop}px` }}
                    >
                      <div className="h-2 w-2 rounded-full bg-[#E11D48] -ms-1 shadow-xs" />
                      <div className="h-[2px] w-full bg-[#E11D48]" />
                    </div>
                  )}

                  {/* Positioned Event Blocks */}
                  {dayOrders.map((order) => {
                    const mins = parseTimeInMinutes(order.requested_time);
                    const startMins = 8 * 60; // 08:00 AM
                    const offsetMins = Math.max(0, mins - startMins);
                    const topPx = offsetMins * (64 / 60); // 64px per 60 minutes
                    const style = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
                    const isDelivery = order.method === "delivery";

                    return (
                      <div
                        key={order.id}
                        onClick={() => onOpen(order.id)}
                        style={{ top: `${topPx}px` }}
                        className={`absolute left-1 right-1 z-10 min-h-[52px] rounded-xl border p-1.5 shadow-xs transition-all hover:scale-[1.02] hover:z-30 cursor-pointer ${style.bg} ${style.border} ${style.text}`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-black border-b border-black/10 pb-0.5">
                          <span className="flex items-center gap-1">
                            <Clock3 className="h-3 w-3 text-[#B8801C]" />
                            {formatArabicTime(order.requested_time)}
                          </span>
                          <span>{isDelivery ? "🚗 توصيل" : "🏬 استلام"}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-extrabold truncate">
                          {order.customer_name}
                        </div>
                        <div className="text-[10px] font-bold opacity-80 truncate">
                          {productSummaryTag(order)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   3. Day View Component (Single Day Vertical Hourly Timeline 08:00 AM - 11:00 PM)
   ============================================================================ */

function DayView({
  cursorDate,
  ordersByDate,
  todayIso,
  onOpen,
}: {
  cursorDate: Date;
  ordersByDate: Map<string, SalesOrder[]>;
  todayIso: string;
  onOpen: (id: string) => void;
}) {
  const dateStr = useMemo(() => formatIsoDate(cursorDate), [cursorDate]);
  const isToday = dateStr === todayIso;
  const dayOrders = ordersByDate.get(dateStr) ?? [];

  const hours = useMemo(() => Array.from({ length: 16 }, (_, i) => i + 8), []);

  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const liveLineTop = useMemo(() => {
    const start = 8 * 60;
    if (currentMinutes < start || currentMinutes > 23 * 60) return null;
    return (currentMinutes - start) * (64 / 60);
  }, [currentMinutes]);

  return (
    <div className="space-y-3">
      {/* Day Overview Ribbon */}
      <div className="flex items-center justify-between rounded-2xl border border-[#EFE8DC] bg-[#FAF5EB] p-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-[#26160F]">
            جدول أوقات الطلبات ({dayOrders.length} طلبات)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-[#B8801C] px-3 py-1 text-xs font-bold text-white shadow-xs">
            {WEEKDAYS_AR[cursorDate.getDay()]}، {cursorDate.getDate()} {MONTHS_AR[cursorDate.getMonth()]}
          </span>
        </div>
      </div>

      {/* Hourly Timeline */}
      <div className="relative max-h-[580px] overflow-y-auto pt-2 no-scrollbar rounded-2xl border border-[#EFE8DC] bg-white p-2">
        <div className="grid grid-cols-[80px_1fr] relative">
          {/* Time Column */}
          <div className="space-y-12 text-center text-xs font-bold text-[#4A3B32]/70 pt-1">
            {hours.map((h) => {
              const period = h >= 12 ? "م" : "ص";
              const displayH = h % 12 === 0 ? 12 : h % 12;
              return (
                <div key={h} className="h-16 flex items-start justify-center">
                  {displayH}:00 {period}
                </div>
              );
            })}
          </div>

          {/* Timeline Column */}
          <div
            className={`relative border-r border-[#EFE8DC] ${
              isToday ? "bg-[#FEF7EB]/30" : ""
            }`}
            style={{ minHeight: `${hours.length * 64}px` }}
          >
            {/* Grid lines */}
            {hours.map((h) => (
              <div
                key={h}
                className="h-16 border-t border-[#EFE8DC]/60 hover:bg-[#FAF5EB]/40 transition-colors"
              />
            ))}

            {/* Live Indicator */}
            {isToday && liveLineTop !== null && (
              <div
                className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                style={{ top: `${liveLineTop}px` }}
              >
                <div className="h-3 w-3 rounded-full bg-[#E11D48] -ms-1.5 shadow-md" />
                <div className="h-[2px] w-full bg-[#E11D48]" />
              </div>
            )}

            {/* Placed Order Event Cards */}
            {dayOrders.map((order) => {
              const mins = parseTimeInMinutes(order.requested_time);
              const startMins = 8 * 60;
              const offsetMins = Math.max(0, mins - startMins);
              const topPx = offsetMins * (64 / 60);
              const style = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
              const isDelivery = order.method === "delivery";

              return (
                <div
                  key={order.id}
                  onClick={() => onOpen(order.id)}
                  style={{ top: `${topPx}px` }}
                  className={`absolute left-2 right-2 z-10 rounded-2xl border p-3 shadow-md transition-all hover:scale-[1.01] hover:z-30 cursor-pointer ${style.bg} ${style.border} ${style.text}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-black text-[#B8801C]">
                        <Clock3 className="h-4 w-4" />
                        {formatArabicTime(order.requested_time)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${style.badgeBg} ${style.badgeText}`}>
                        {style.ar}
                      </span>
                    </div>
                    <span className="text-xs font-black">
                      {isDelivery ? "🚗 توصيل عمّان" : "🏬 استلام فرع الشميساني"}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#26160F]">
                        {order.customer_name} ({order.customer_phone})
                      </h4>
                      <p className="text-xs font-bold text-[#6E3917]/80 mt-0.5">
                        🎂 {productSummaryTag(order)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(order.id);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-xl bg-white/90 border border-black/10 px-3 text-xs font-bold text-[#26160F] shadow-2xs hover:bg-white cursor-pointer"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>إدارة الطلب</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   4. Agenda View Component (Chronological List View Grouped by Date)
   ============================================================================ */

function AgendaView({
  ordersByDate,
  onOpen,
}: {
  ordersByDate: Map<string, SalesOrder[]>;
  onOpen: (id: string) => void;
}) {
  const sortedDates = useMemo(() => {
    return Array.from(ordersByDate.keys()).sort();
  }, [ordersByDate]);

  if (sortedDates.length === 0) {
    return (
      <div className="py-16 text-center text-sm font-bold text-[#4A3B32]/70">
        لا توجد طلبات مسجلة في هذه الفترة 🌸
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((dateStr) => {
        const d = parseIsoDate(dateStr);
        const dayName = WEEKDAYS_AR[d.getDay()];
        const dayOrders = ordersByDate.get(dateStr) ?? [];

        return (
          <div key={dateStr} className="space-y-3">
            {/* Agenda Group Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-2xl border border-[#EFE8DC] bg-[#FAF5EB] px-4 py-2.5 shadow-2xs backdrop-blur-md">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#B8801C]" />
                <span className="font-extrabold text-sm text-[#26160F]">
                  {dayName}، {d.getDate()} {MONTHS_AR[d.getMonth()]} {d.getFullYear()}
                </span>
              </div>
              <span className="rounded-full bg-[#B8801C] px-2.5 py-0.5 text-xs font-bold text-white">
                {dayOrders.length} طلبات
              </span>
            </div>

            {/* Group Orders Cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {dayOrders.map((order) => {
                const style = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
                const isDelivery = order.method === "delivery";

                return (
                  <div
                    key={order.id}
                    onClick={() => onOpen(order.id)}
                    className={`rounded-2xl border p-4 shadow-xs transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer ${style.bg} ${style.border} ${style.text}`}
                  >
                    <div className="flex items-center justify-between border-b border-black/10 pb-2">
                      <span className="inline-flex items-center gap-1.5 font-black text-xs text-[#B8801C]">
                        <Clock3 className="h-4 w-4" />
                        {formatArabicTime(order.requested_time)}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${style.badgeBg} ${style.badgeText}`}>
                        {style.ar}
                      </span>
                    </div>

                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-black text-sm text-[#26160F]">
                          {order.customer_name} ({order.customer_phone})
                        </h4>
                        <p className="text-xs font-bold text-[#6E3917]/80 mt-1">
                          🎂 {productSummaryTag(order)}
                        </p>
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-black/10 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#26160F]">
                        {isDelivery ? "🚗 توصيل" : "🏬 استلام"}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-black/10 flex items-center justify-between text-xs">
                      <span className="font-bold text-[#6E3917]">
                        رقم الطلب: <span dir="ltr">{orderLabel(order.order_number, order.staff_code)}</span>
                      </span>
                      <span className="font-black text-[#B8801C] hover:underline">
                        عرض التفاصيل 👁️
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
   5. Day Drawer Component (Slide-Over Drawer for Selected Date)
   ============================================================================ */

function DayDrawer({
  dateStr,
  orders,
  onClose,
  onOpenOrder,
}: {
  dateStr: string;
  orders: SalesOrder[];
  onClose: () => void;
  onOpenOrder: (id: string) => void;
}) {
  const dateObj = parseIsoDate(dateStr);
  const dayName = WEEKDAYS_AR[dateObj.getDay()];
  const monthName = MONTHS_AR[dateObj.getMonth()];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity">
      <div
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div
        dir="rtl"
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-s border-[#EFE8DC]"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#EFE8DC] bg-[#FAF5EB] p-4 sm:p-5">
          <div>
            <h3 className="text-base font-black text-[#26160F]">
              طلبات يوم {dayName}
            </h3>
            <p className="text-xs text-[#6E3917] mt-0.5">
              {dateObj.getDate()} {monthName} {dateObj.getFullYear()} ({orders.length} طلبات)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#EFE8DC] bg-white text-[#26160F] hover:bg-[#FEF7EB] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {orders.length === 0 ? (
            <div className="py-16 text-center text-xs font-bold text-[#4A3B32]/70">
              لا توجد طلبات مسجلة لهذا اليوم 🌸
            </div>
          ) : (
            orders.map((order) => {
              const style = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
              const isDelivery = order.method === "delivery";

              return (
                <div
                  key={order.id}
                  onClick={() => onOpenOrder(order.id)}
                  className={`rounded-2xl border p-4 shadow-xs transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer ${style.bg} ${style.border} ${style.text}`}
                >
                  <div className="flex items-center justify-between border-b border-black/10 pb-2">
                    <span className="inline-flex items-center gap-1 font-black text-xs text-[#B8801C]">
                      <Clock3 className="h-4 w-4" />
                      {formatArabicTime(order.requested_time)}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${style.badgeBg} ${style.badgeText}`}>
                      {style.ar}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1">
                    <h4 className="font-extrabold text-sm text-[#26160F]">
                      {order.customer_name} ({order.customer_phone})
                    </h4>
                    <p className="text-xs font-bold text-[#6E3917]/80">
                      🎂 {productSummaryTag(order)}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-black/10 flex items-center justify-between text-xs">
                    <span className="font-bold">
                      {isDelivery ? "🚗 توصيل" : "🏬 استلام"}
                    </span>
                    <span className="font-black text-[#B8801C]">
                      إدارة الطلب 👁️
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
