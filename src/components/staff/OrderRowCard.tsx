import { memo } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Clock,
  MessageCircle,
  Pencil,
  Printer,
} from "lucide-react";

import { OrderStatusBadge } from "@/components/staff/OrderStatusBadge";
import { sendCustomerWhatsApp, sendScheduleConfirmation } from "@/components/staff/orders-actions";
import { jd } from "@/lib/currency";
import { orderLabel } from "@/lib/order-label";
import { printCustomerReceipt } from "@/lib/receipt-templates";
import type { SalesOrder } from "@/lib/sales.functions";

interface OrderRowCardProps {
  order: SalesOrder;
  onOpen: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onEditOrder?: ((id: string) => void) | undefined;
  onQuickPaid: () => void;
  isCollecting?: boolean;
}

export const OrderRowCard = memo(function OrderRowCard({
  order,
  onOpen,
  onMove,
  onEditOrder,
  onQuickPaid,
  isCollecting,
}: OrderRowCardProps) {
  const remaining = Math.max(order.total - order.deposit_paid, 0);
  const refundDue = Math.max(order.deposit_paid - order.total, 0);
  const isOverpaid = refundDue > 0.001;

  return (
    <div className="space-y-3 rounded-3xl border border-border/80 bg-card p-3.5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} showDot size="md" />
          <span className="text-sm font-black text-foreground">
            {orderLabel(order.order_number, order.staff_code)}
          </span>
          <span className="max-w-[200px] truncate text-xs font-bold text-foreground">
            {order.order_name?.trim() || order.customer_name}
          </span>
          {order.last_edited_at && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-600">
              <Pencil className="h-2.5 w-2.5" /> معدّل
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {order.requested_date}
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 font-black text-foreground">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            {order.requested_time.slice(0, 5)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-black text-foreground">{order.customer_name}</span>
            <span dir="ltr" className="font-bold text-muted-foreground">
              {order.customer_phone}
            </span>
            <span className="rounded-lg bg-secondary px-2 py-0.5 text-[11px] font-bold text-foreground">
              {order.method === "delivery"
                ? `🛵 توصيل (${order.area || "عمان"})`
                : "🏪 استلام محلي"}
            </span>
          </div>

          <div className="text-xs text-muted-foreground">
            {order.items.map((it) => `${it.quantity} × ${it.name_ar}`).join(" • ")}
          </div>

          {order.inscription && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-900 dark:text-amber-200">
              <span>✍️</span>
              <span>"{order.inscription}"</span>
            </div>
          )}

          {order.modifications && order.modifications.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              آخر تعديل: {order.modifications[order.modifications.length - 1]?.field}
            </div>
          )}
        </div>

        <div className="flex w-full shrink-0 items-end justify-between gap-1 border-t border-border/40 pt-2 sm:w-auto sm:flex-col sm:justify-start sm:border-0 sm:pt-0">
          <span className="text-base font-black text-foreground">{jd(order.total)}</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">مدفوع: {jd(order.deposit_paid)}</span>
            {isOverpaid ? (
              <span className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 font-black text-purple-600">
                مستحق إرجاع: {jd(refundDue)} 🔄
              </span>
            ) : (
              <span
                className={`font-black ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}
              >
                {remaining > 0 ? `باقي ${jd(remaining)}` : "مدفوع بالكامل ✓"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(order.id)}
            className="min-h-[40px] cursor-pointer rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground shadow-xs transition hover:opacity-90 active:scale-95"
          >
            إدارة الطلب ⚡
          </button>

          {onEditOrder && (
            <button
              type="button"
              onClick={() => onEditOrder(order.id)}
              className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-xs font-bold text-foreground transition hover:bg-secondary active:scale-95"
            >
              <Pencil className="h-3.5 w-3.5 text-primary" />
              <span>تعديل</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => sendCustomerWhatsApp(order)}
            className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-3.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-300"
          >
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span>واتساب</span>
          </button>

          <button
            type="button"
            onClick={() => printCustomerReceipt(order)}
            className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-xs font-bold text-foreground transition hover:bg-secondary active:scale-95"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>فاتورة</span>
          </button>

          {remaining > 0 && (
            <button
              type="button"
              onClick={onQuickPaid}
              disabled={isCollecting}
              title="تسجيل دفع المتبقي كاملاً كاش بنقرة واحدة"
              className="flex min-h-[40px] cursor-pointer items-center gap-1 rounded-xl bg-emerald-600 px-3.5 text-xs font-black text-white shadow-2xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isCollecting ? "جاري التحصيل..." : `استلام ${jd(remaining)} كاش`}</span>
            </button>
          )}

          {order.schedule_updated_at && (
            <button
              type="button"
              onClick={() => sendScheduleConfirmation(order)}
              className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 text-xs font-black text-white transition hover:bg-amber-700 active:scale-95"
            >
              <span>تأكيد الموعد 🔄</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/30 p-0.5">
          <button
            type="button"
            onClick={() => onMove(order.id, -1)}
            title="تقديم في الطابور"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted-foreground transition hover:bg-card hover:text-foreground active:scale-90"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(order.id, 1)}
            title="تأخير في الطابور"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted-foreground transition hover:bg-card hover:text-foreground active:scale-90"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
