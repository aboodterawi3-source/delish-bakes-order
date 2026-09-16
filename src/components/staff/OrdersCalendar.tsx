import { memo, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SalesOrder, SalesStatus } from "@/lib/sales.functions";

/** Compact card colours, keyed by order status (Google-Calendar style chips). */
const TONE: Record<SalesStatus, string> = {
  new: "bg-[#FDE2CF] text-[#7B3F00] border-[#EFA781]",
  confirmed: "bg-[#FDE2CF] text-[#7B3F00] border-[#EFA781]",
  baking: "bg-[#EFA781] text-white border-[#D98456]",
  ready: "bg-[#B8860B] text-white border-[#96700A]",
  out_for_delivery: "bg-[#8B4513] text-white border-[#6E360F]",
  completed: "bg-[#166534] text-white border-[#11512A]",
  delivered: "bg-[#166534] text-white border-[#11512A]",
  cancelled: "bg-red-600 text-white border-red-700 line-through",
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
const codeTag = (order: SalesOrder) => order.order_number.replace(/^DL-/i, "");

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
    <section className="mt-4 min-w-0">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="الشهر السابق"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="الشهر التالي"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <h3 className="font-serif text-base font-bold text-foreground">
          {MONTHS[cursor.month]} {cursor.year}
        </h3>
        <button
          type="button"
          onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}
          className="min-h-10 rounded-full border border-border px-3 text-xs font-bold text-foreground"
        >
          اليوم
        </button>
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-bold text-muted-foreground">
            {WEEKDAYS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              if (!cell) return <div key={`empty-${index}`} className="min-h-24 rounded-xl bg-muted/40" />;
              const dayOrders = byDate.get(cell.key) ?? [];
              const isToday = cell.key === today;
              return (
                <div
                  key={cell.key}
                  className={`min-h-24 rounded-xl border p-1 ${
                    isToday ? "border-primary bg-primary/5" : "border-border bg-background"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between px-1 text-[11px] font-bold text-muted-foreground">
                    <span>{cell.day}</span>
                    {dayOrders.length ? <span>{dayOrders.length}</span> : null}
                  </div>
                  <ul className="grid gap-1">
                    {dayOrders.map((order) => (
                      <li key={order.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(order.id)}
                          title={`${order.order_number} · ${order.customer_name}`}
                          className={`w-full truncate rounded-md border px-1.5 py-1 text-start text-[11px] font-bold ${TONE[order.status]}`}
                        >
                          {order.requested_time.slice(0, 5)} · {productTag(order)} · {codeTag(order)}
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
