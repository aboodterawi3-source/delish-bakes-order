import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Clock, Filter, MapPin, Store, Truck } from "lucide-react";
import { toast } from "sonner";
import { CalendarOrderDetailModal } from "@/components/staff/CalendarOrderDetailModal";
import { ImageLightbox } from "@/components/staff/ImageLightbox";
import { OrderStatusBadge } from "@/components/staff/OrderStatusBadge";
import {
  MONTHS_AR,
  WEEKDAYS_AR,
  computeHourlyMultiColumnLayout,
  formatMinutesArabic,
  parseTimeInMinutes,
  statusCardStyle,
  toLocalIsoDate,
  type CalendarOrder,
  type CalendarViewMode,
} from "@/components/staff/calendar-layout";
import { jd } from "@/lib/currency";
import { todayIso } from "@/lib/date-filter";
import { orderLabel } from "@/lib/order-label";
import { ORDER_STATUS_META } from "@/lib/order-status";
import { updateSalesOrder, type OrderPatch, type SalesStatus } from "@/lib/sales.functions";

export type { CalendarOrder, CalendarViewMode };

export interface OrdersCalendarProps {
  orders: CalendarOrder[];
  onOpen: (id: string) => void;
  onPatch?: (input: OrderPatch) => void;
  isKitchen?: boolean;
  onKitchenStage?: (id: string, stage: "new" | "baking" | "ready") => void;
  onPrintKitchenTicket?: (order: CalendarOrder) => void;
}

export const OrdersCalendar = memo(function OrdersCalendar({
  orders,
  onOpen,
  onPatch,
  isKitchen,
  onKitchenStage,
  onPrintKitchenTicket,
}: OrdersCalendarProps) {
  const updateOrderServerFn = useServerFn(updateSalesOrder);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [statusFilter, setStatusFilter] = useState<SalesStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<CalendarOrder | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Touch Long-Press Dragging State
  const [dragging, setDragging] = useState<{
    order: CalendarOrder;
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
  const dateISO = useMemo(() => toLocalIsoDate(currentDate), [currentDate]);

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
  const handlePointerDown = (e: React.PointerEvent, ord: CalendarOrder) => {
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

      // Perform mutation and report real success/failure
      if (onPatch) {
        onPatch({ orderId: orderToMove.id, requested_time: targetTimeStr });
        toast.success(`✨ تم نقل الطلب إلى الساعة ${displayTime} بنجاح`);
      } else {
        updateOrderServerFn({
          data: { orderId: orderToMove.id, requested_time: targetTimeStr },
        })
          .then(() => {
            toast.success(`✨ تم نقل الطلب إلى الساعة ${displayTime} بنجاح`);
          })
          .catch(() => {
            toast.error("تعذر تحديث موعد الطلب");
          });
      }
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
      const iso = toLocalIsoDate(d);
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
      const iso = toLocalIsoDate(d);
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
    const todayISO = todayIso();
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const d = new Date(year, month, dayNum);
      const iso = toLocalIsoDate(d);
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
      const iso = toLocalIsoDate(d);
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

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lg transition-all select-none"
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
          <div className="flex items-center rounded-xl border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`min-h-8 rounded-lg px-3 text-xs font-bold transition-all ${
                viewMode === "month"
                  ? "border border-border bg-background text-primary shadow-sm"
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
                  ? "border border-border bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🕒 يوم بالساعات
            </button>
          </div>
        </div>
      </div>

      {/* STATUS QUICK FILTER STRIP */}
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-border bg-background p-2 text-xs">
        <span className="flex shrink-0 items-center gap-1 pl-1 font-bold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> تصفية:
        </span>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all ${
            statusFilter === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          الكل ({orders.length})
        </button>
        {(Object.keys(ORDER_STATUS_META) as SalesStatus[]).map((st) => {
          const cfg = ORDER_STATUS_META[st];
          const count = orders.filter((o) => o.status === st).length;
          if (count === 0 && statusFilter !== st) return null;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold transition-all ${
                statusFilter === st
                  ? `${cfg.badgeBg} ${cfg.badgeText} border-transparent shadow-sm`
                  : `border-border bg-background text-foreground hover:bg-muted`
              }`}
            >
              {cfg.ar} {cfg.icon} ({count})
            </button>
          );
        })}
      </div>

      {/* 2. DAY VIEW: HORIZONTAL WEEKDAY SELECTOR STRIP */}
      {viewMode === "day" ? (
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-border bg-muted/20 p-2 text-center">
          {surroundingDays.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setCurrentDate(d.date)}
              className={`flex min-w-[72px] shrink-0 flex-col items-center justify-center rounded-xl p-2 transition-all ${
                d.isSelected
                  ? "bg-primary font-black text-primary-foreground shadow-md ring-2 ring-primary/40"
                  : d.isToday
                    ? "border border-primary/30 bg-primary/10 font-bold text-primary"
                    : "border border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <span className="text-[11px] opacity-80">{d.dayName}</span>
              <span className="text-base leading-tight font-black">{d.dayNum}</span>
              {d.count > 0 ? (
                <span
                  className={`py-0.2 mt-1 rounded-full px-1.5 text-[10px] font-bold ${
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
          <div className="grid border-collapse grid-cols-7">
            {monthGridDays.map((cell, idx) => (
              <div
                key={cell.iso + idx}
                onClick={() => {
                  setCurrentDate(cell.date);
                  setViewMode("day");
                }}
                className={`group min-h-[110px] cursor-pointer border-b border-l border-border p-1.5 transition-colors hover:bg-muted/30 ${
                  !cell.isCurrentMonth ? "bg-muted/10 opacity-50" : "bg-background"
                }`}
              >
                {/* Cell Date Pill */}
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      cell.isToday
                        ? "bg-primary font-black text-primary-foreground shadow-sm"
                        : cell.isCurrentMonth
                          ? "text-foreground group-hover:bg-accent"
                          : "text-muted-foreground"
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {cell.orders.length > 0 ? (
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {cell.orders.length} طلبات
                    </span>
                  ) : null}
                </div>

                {/* Order Chips */}
                <div className="space-y-1">
                  {cell.orders.slice(0, 3).map((ord) => {
                    const cfg = statusCardStyle(ord.status);
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
                        className={`truncate rounded-lg border px-1.5 py-1 text-[11px] font-bold shadow-2xs transition-transform hover:scale-[1.02] ${cfg.bg} ${cfg.border} ${cfg.text}`}
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
          <div
            className="relative max-h-[640px] overflow-x-hidden overflow-y-auto"
            ref={timelineRef}
          >
            {/* Hourly Rows Grid */}
            <div className="relative min-h-[1296px] w-full border-b border-border">
              {/* 18 Hours Rows (06:00 AM to 11:00 PM) */}
              {Array.from({ length: 18 }).map((_, hourIndex) => {
                const hourNum = 6 + hourIndex; // 6 to 23
                const label = formatMinutesArabic(hourNum * 60);

                return (
                  <div
                    key={hourNum}
                    className="relative flex h-[72px] border-b border-border/60 text-xs font-semibold text-muted-foreground"
                  >
                    {/* Time Label Column */}
                    <div className="w-16 shrink-0 border-l border-border/60 bg-muted/10 p-2 text-left font-mono font-bold select-none sm:w-20">
                      {label}
                    </div>

                    {/* Hourly Horizontal Guide Line */}
                    <div className="relative flex-1">
                      <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/40" />
                    </div>
                  </div>
                );
              })}

              {/* TARGET HOUR DROP HIGHLIGHT BOX (When Dragging on Touch) */}
              {dragging ? (
                <div
                  style={{ top: `${(dragging.targetHour - 6) * 72}px`, height: "72px" }}
                  className="pointer-events-none absolute inset-x-0 right-16 z-20 flex animate-pulse items-center justify-between rounded-xl border-2 border-dashed border-primary bg-primary/20 px-4 shadow-lg transition-all sm:right-20"
                >
                  <span className="rounded-full bg-background px-3 py-1 text-xs font-black text-primary shadow-sm">
                    🎯 نقل الطلب إلى الساعة {formatMinutesArabic(dragging.targetHour * 60)}
                  </span>
                  <span className="text-xs font-bold text-primary">اترك الإصبع للإسقاط</span>
                </div>
              ) : null}

              {/* LIVE CURRENT TIME INDICATOR BAR */}
              {currentDate.toDateString() === new Date().toDateString()
                ? (() => {
                    const now = new Date();
                    const currentMins = now.getHours() * 60 + now.getMinutes();
                    const startMins = 6 * 60;
                    if (currentMins >= startMins && currentMins <= 23 * 60) {
                      const topPx = ((currentMins - startMins) / 60) * 72;
                      return (
                        <div
                          style={{ top: `${topPx}px` }}
                          className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                        >
                          <div className="mr-14 flex w-full items-center gap-1 sm:mr-18">
                            <div className="h-3 w-3 rounded-full bg-rose-500 shadow-sm ring-4 ring-rose-500/20" />
                            <div className="h-0.5 w-full bg-rose-500 shadow-xs" />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                : null}

              {/* POSITIONED MULTI-COLUMN EVENT CARDS WITH TOUCH LONG-PRESS DRAG */}
              <div className="absolute top-0 right-16 bottom-0 left-0 z-10 sm:right-20">
                {positionedDayOrders.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm font-bold text-muted-foreground">
                    لا توجد طلبات مسجلة لهذا اليوم 🎉
                  </div>
                ) : (
                  positionedDayOrders.map((pos) => {
                    const ord = pos.order;
                    const cfg = statusCardStyle(ord.status);
                    const code = orderLabel(ord.order_number, ord.staff_code);
                    const mainItem = ord.items?.[0]?.name_ar ?? "كيكة مخصصة";
                    const locationText =
                      ord.method === "delivery" ? (ord.area ?? "توصيل") : "استلام من المحل";
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
                        className={`order-item absolute flex cursor-grab flex-col justify-between overflow-hidden rounded-xl border p-2.5 shadow-md transition-all hover:z-30 hover:scale-[1.01] active:cursor-grabbing ${cfg.bg} ${cfg.border} ${cfg.text} ${
                          isBeingDragged ? "scale-95 border-dashed border-primary opacity-30" : ""
                        }`}
                      >
                        {/* Card Header: Code + Status Badge */}
                        <div className="pointer-events-none flex items-center justify-between gap-1">
                          <span className="dir-ltr inline-flex items-center gap-1 rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-[11px] font-black">
                            {code}
                          </span>
                          <OrderStatusBadge status={ord.status} size="sm" />
                        </div>

                        {/* Card Body: Customer & Location */}
                        <div className="pointer-events-none mt-1 space-y-0.5">
                          <div className="flex items-center gap-1 truncate text-xs font-black">
                            {ord.method === "delivery" ? (
                              <Truck className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                            ) : (
                              <Store className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                            )}
                            <span className="truncate">{ord.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-1 truncate text-[11px] font-bold opacity-90">
                            <MapPin className="h-3 w-3 shrink-0" /> {locationText} • {mainItem}
                          </div>
                        </div>

                        {/* Card Footer: Time slot */}
                        <div className="pointer-events-none mt-1 flex items-center justify-between text-[10px] font-bold opacity-75">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {timeWindow}
                          </span>
                          {!isKitchen && (ord.total ?? 0) > 0 ? (
                            <span>{jd(ord.total)}</span>
                          ) : isKitchen ? (
                            <span>
                              {ord.items.length
                                ? `${ord.items.reduce((s, it) => s + it.quantity, 0)} قطع`
                                : ""}
                            </span>
                          ) : null}
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
          className="scale-105 rotate-2 rounded-2xl border-2 border-primary bg-card p-3 shadow-2xl ring-4 ring-primary/40 transition-transform"
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-1 text-xs font-black text-primary">
            <span>{orderLabel(dragging.order.order_number, dragging.order.staff_code)}</span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              سحب ✋
            </span>
          </div>
          <div className="mt-1 truncate text-xs font-black text-foreground">
            {dragging.order.customer_name}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-primary">
            <Clock className="h-3 w-3" /> نقل إلى: {formatMinutesArabic(dragging.targetHour * 60)}
          </div>
        </div>
      ) : null}

      {selectedOrder ? (
        <CalendarOrderDetailModal
          order={selectedOrder}
          isKitchen={isKitchen}
          onClose={() => setSelectedOrder(null)}
          onOpenFullDetails={onOpen}
          onZoomImage={(url) => setZoomImage(url)}
          onKitchenStage={onKitchenStage}
          onUpdateStatus={(nextStatus) =>
            setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus } : null))
          }
          onPrintKitchenTicket={onPrintKitchenTicket}
        />
      ) : null}

      <ImageLightbox src={zoomImage} onClose={() => setZoomImage(null)} />
    </div>
  );
});
