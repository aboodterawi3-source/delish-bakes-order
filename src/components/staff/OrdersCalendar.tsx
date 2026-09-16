import { memo, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import type { SalesOrder, SalesStatus } from "@/lib/sales.functions";

/** Compact card colours, keyed by order status (Google-Calendar style chips). */
const TONE: Record<SalesStatus, string> = {
  new: "border-peach-coral bg-peach text-cocoa-deep",
  confirmed: "border-peach-coral bg-peach text-cocoa-deep",
  baking: "border-peach-coral bg-peach-coral text-primary-foreground",
  ready: "border-gold bg-gold text-primary-foreground",
  out_for_delivery: "border-primary bg-primary text-primary-foreground",
  completed: "border-gold bg-tint-pistachio text-cocoa-deep",
  delivered: "border-gold bg-tint-pistachio text-cocoa-deep",
  cancelled: "border-destructive bg-destructive text-destructive-foreground line-through",
};

const WEEKDAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const MONTHS = [
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

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Short product tag: first item name shortened, prefixed by its quantity. */
const productTag = (order: SalesOrder) => {
  const first = order.items[0];
  if (!first) return order.order_name?.trim().slice(0, 10) || "طلب";
  const words = first.name_ar.trim().split(/\s+/).slice(0, 2).join(" ");
  return `${first.quantity}×${words.slice(0, 12)}`;
};

/** Short order code: the numeric tail of the order number. */
const codeTag = (order: SalesOrder) =>
  `${order.staff_code ? `${order.staff_code}/` : ""}${order.order_number.replace(/^DL-/i, "")}`;

type Props = {
  orders: SalesOrder[];
  onOpen: (id: string) => void;
};

/** Monthly grid of orders, grouped by requested (delivery/pickup) date. */
export const OrdersCalendar = memo(function OrdersCalendar({ orders, onOpen }: Props) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const byDate = useMemo(() => {
    const map = new Map<string, SalesOrder[]>();
    for (const order of orders) {
      const key = order.requested_date?.slice(0, 10);
      if (!key) continue;
      const bucket = map.get(key) ?? [];
      bucket.push(order);
      map.set(key, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.requested_time.localeCompare(b.requested_time));
    }
    return map;
  }, [orders]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const lead = first.getDay();
    const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const total = Math.ceil((lead + days) / 7) * 7;
    return Array.from({ length: total }, (_, index) => {
      const dayNumber = index - lead + 1;
      if (dayNumber < 1 || dayNumber > days) return null;
      return { day: dayNumber, key: iso(cursor.year, cursor.month, dayNumber) };
    });
  }, [cursor]);

  const today = iso(now.getFullYear(), now.getMonth(), now.getDate());

  const shift = (delta: number) =>
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  return (
    <section className="mt-5 min-w-0" aria-label="تقويم الطلبات الشهري">
      <header className="mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="الشهر السابق"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="الشهر التالي"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <h3 className="min-w-0 truncate text-center font-display text-base font-bold text-foreground">
          {MONTHS[cursor.month]} {cursor.year}
        </h3>
        <button
          type="button"
          onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" /> اليوم
        </button>
      </header>

      <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-muted/40 p-1.5">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 gap-1.5 pb-1.5 text-center text-[11px] font-bold text-muted-foreground">
            {WEEKDAYS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell, index) => {
              if (!cell) return <div key={`empty-${index}`} className="h-44 rounded-md bg-muted/60" />;
              const dayOrders = byDate.get(cell.key) ?? [];
              const isToday = cell.key === today;
              return (
                <div
                  key={cell.key}
                  className={`flex h-44 min-w-0 flex-col overflow-hidden rounded-md border ${
                    isToday ? "border-primary bg-primary/5" : "border-border bg-background"
                  }`}
                >
                  <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2 text-[11px] font-bold text-muted-foreground">
                    <span className={isToday ? "grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground" : ""}>{cell.day}</span>
                    {dayOrders.length ? <span aria-label={`${dayOrders.length} طلب`}>{dayOrders.length}</span> : null}
                  </div>
                  <ul className="no-scrollbar grid min-h-0 flex-1 content-start gap-1 overflow-y-auto p-1">
                    {dayOrders.map((order) => (
                      <li key={order.id} className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpen(order.id)}
                          title={`${order.order_number} · ${order.customer_name}`}
                          className={`grid w-full min-w-0 gap-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-start text-[10px] font-bold leading-tight shadow-sm ${TONE[order.status]}`}
                        >
                          <span className="flex min-w-0 items-center justify-between gap-1">
                            <span className="inline-flex min-w-0 items-center gap-1 truncate">
                              <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                              {order.requested_time.slice(0, 5)}
                            </span>
                            <span className="shrink-0" dir="ltr">{order.last_edited_at ? "✏️ " : ""}{codeTag(order)}</span>
                          </span>
                          <span className="block truncate font-medium">{productTag(order)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
});
