import { useMemo } from "react";
import {
  Clock,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Printer,
  Sparkles,
  Store,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DesignGallery } from "@/components/staff/DesignGallery";
import { ModificationsSummary } from "@/components/staff/ModificationsSummary";
import { OrderStatusBadge } from "@/components/staff/OrderStatusBadge";
import {
  formatMinutesArabic,
  parseTimeInMinutes,
  type CalendarOrder,
} from "@/components/staff/calendar-layout";
import { jd } from "@/lib/currency";
import { orderLabel } from "@/lib/order-label";
import { consolidateModifications } from "@/lib/order-modifications";
import { PAYMENT_METHOD_LABELS } from "@/lib/order-status";
import { printCustomerReceipt } from "@/lib/receipt-templates";
import type { SalesOrder } from "@/lib/sales.functions";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

interface CalendarOrderDetailModalProps {
  order: CalendarOrder;
  isKitchen?: boolean | undefined;
  onClose: () => void;
  onOpenFullDetails: (id: string) => void;
  onZoomImage: (url: string) => void;
  onKitchenStage?: ((id: string, stage: "new" | "baking" | "ready") => void) | undefined;
  onUpdateStatus?: ((nextStatus: string) => void) | undefined;
  onPrintKitchenTicket?: ((order: CalendarOrder) => void) | undefined;
}

/** Modal displaying complete order details, financials, modifications, and quick actions from the calendar. */
export function CalendarOrderDetailModal({
  order,
  isKitchen,
  onClose,
  onOpenFullDetails,
  onZoomImage,
  onKitchenStage,
  onUpdateStatus,
  onPrintKitchenTicket,
}: CalendarOrderDetailModalProps) {
  const cleanModifications = useMemo(() => {
    const baseMods = [...(order.modifications || [])];
    if (
      order.schedule_updated_at &&
      !baseMods.some((m) => m.field?.includes("موعد") || m.field?.includes("تاريخ"))
    ) {
      baseMods.push({
        field: "موعد التسليم",
        oldValue: "",
        newValue: `${order.requested_date} ⏰ ${order.requested_time?.slice(0, 5) || ""}`,
        updatedAt: order.schedule_updated_at,
      });
    }
    return consolidateModifications(baseMods, { isKitchen });
  }, [order, isKitchen]);

  const handlePrintReceipt = () => {
    if (!printCustomerReceipt(order as unknown as SalesOrder)) {
      toast.error("تعذر فتح نافذة الطباعة");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/60 p-4 backdrop-blur-xs duration-200 fade-in"
      dir="rtl"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card text-card-foreground shadow-2xl transition-all">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-base font-black text-foreground">
                {order.area ?? (order.method === "delivery" ? "توصيل" : "استلام محل")} •{" "}
                {orderLabel(order.order_number, order.staff_code)}
              </h3>
              <p className="text-xs font-bold text-muted-foreground">
                نافذة التسليم: {formatMinutesArabic(parseTimeInMinutes(order.requested_time))} -{" "}
                {formatMinutesArabic(parseTimeInMinutes(order.requested_time) + 60)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">حالة الأوردر:</span>
              <OrderStatusBadge status={order.status} size="md" />
            </div>
            {order.staff_code ? (
              <span className="text-xs font-bold text-muted-foreground">
                كود الموظف: <b className="text-foreground">{order.staff_code}</b>
              </span>
            ) : null}
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-muted-foreground">العميل</span>
                <h4 className="text-base font-black text-foreground">{order.customer_name}</h4>
              </div>
              <span className="font-mono text-sm font-bold text-muted-foreground">
                {order.customer_phone}
              </span>
            </div>

            {order.customer_phone && order.customer_phone !== "—" ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={`tel:${order.customer_phone}`}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <Phone className="h-4 w-4" /> 📞 اتصال مباشر
                </a>
                <a
                  href={getWhatsAppChatUrl(order.customer_phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
                >
                  <MessageCircle className="h-4 w-4" /> 💬 واتساب
                </a>
              </div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-black text-muted-foreground">
              <Clock className="h-4 w-4 text-primary" /> موعد ونوع التسليم
            </h4>
            <div className="text-sm font-bold text-foreground">
              📅 {order.requested_date} — الساعة{" "}
              {formatMinutesArabic(parseTimeInMinutes(order.requested_time))}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
              {order.method === "delivery" ? (
                <>
                  <Truck className="h-4 w-4 text-blue-500" /> توصيل إلى:{" "}
                  {order.area ?? "منطقة غير محددة"} {order.address ? `— ${order.address}` : ""}{" "}
                  {order.delivery_fee ? `(أجرة: ${jd(order.delivery_fee)})` : ""}
                </>
              ) : (
                <>
                  <Store className="h-4 w-4 text-amber-500" /> استلام مباشر من الفرع/المحل
                </>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-black text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> تفاصيل الكيك والمنتجات
            </h4>
            <div className="divide-y divide-border">
              {order.items?.map((it) => (
                <div key={it.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span>
                      {it.name_ar} (x{it.quantity})
                    </span>
                    {it.unit_price && it.unit_price > 0 ? (
                      <span>{jd(it.unit_price * it.quantity)}</span>
                    ) : null}
                  </div>
                  {it.options_ar?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/40 pt-1.5">
                      {it.options_ar.map((opt, oIdx) => (
                        <span
                          key={oIdx}
                          className="inline-flex items-center rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-900"
                          dir="auto"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {order.inscription ? (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <h4 className="mb-1 text-xs font-black text-primary">
                ✍️ الكتابة على الكيك / القاعدة:
              </h4>
              <p className="rounded-xl border border-border bg-background p-2.5 text-sm font-bold text-foreground">
                "{order.inscription}"
              </p>
            </div>
          ) : null}

          {order.notes || order.design_image_url ? (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <h4 className="text-xs font-black text-muted-foreground">
                📝 ملاحظات خاصة وصورة التصميم
              </h4>
              {order.notes ? (
                <p className="rounded-xl bg-muted p-2.5 text-xs font-bold text-foreground">
                  {order.notes}
                </p>
              ) : null}
              <DesignGallery designImageUrl={order.design_image_url} onZoom={onZoomImage} />
            </div>
          ) : null}

          {!isKitchen && ((order.total ?? 0) > 0 || order.payment_method) ? (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-xs font-bold">
              <h4 className="mb-2 text-xs font-black text-muted-foreground">
                💵 الحساب المالي وطريقة الدفع
              </h4>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المجموع الفرعي:</span>
                <span>{jd(order.subtotal ?? 0)}</span>
              </div>
              {(order.delivery_fee ?? 0) > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">أجرة التوصيل:</span>
                  <span>+{jd(order.delivery_fee ?? 0)}</span>
                </div>
              ) : null}
              {(order.discount_amount ?? 0) > 0 ? (
                <div className="flex justify-between text-rose-600">
                  <span>الخصم:</span>
                  <span>-{jd(order.discount_amount ?? 0)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-1 text-sm font-black">
                <span>الإجمالي النهائي:</span>
                <span className="text-primary">{jd(order.total ?? 0)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>المدفوع (العربون):</span>
                <span>{jd(order.deposit_paid ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-amber-600">
                <span>المتبقي المطلوب:</span>
                <span>{jd((order.total ?? 0) - (order.deposit_paid ?? 0))}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 text-muted-foreground">
                <span>طريقة الدفع:</span>
                <span className="font-bold text-foreground">
                  {order.payment_method
                    ? (PAYMENT_METHOD_LABELS[order.payment_method]?.ar ?? order.payment_method)
                    : "لم تحدد"}
                </span>
              </div>
            </div>
          ) : null}

          <ModificationsSummary
            modifications={cleanModifications}
            headerTimestamp={order.last_edited_at || order.schedule_updated_at}
          />

          {isKitchen && onKitchenStage ? (
            <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
              <h4 className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                👨‍🍳 إجراءات مرحلة المطبخ · Kitchen Stage
              </h4>
              <div className="flex flex-wrap gap-2 pt-1">
                {order.status !== "baking" && order.status !== "ready" && (
                  <button
                    type="button"
                    onClick={() => {
                      onKitchenStage(order.id, "baking");
                      onUpdateStatus?.("baking");
                    }}
                    className="min-h-10 flex-1 rounded-xl bg-blue-600 text-xs font-bold text-white transition hover:bg-blue-700"
                  >
                    ⚡ بدء التجهيز بالمطبخ
                  </button>
                )}
                {order.status !== "ready" && (
                  <button
                    type="button"
                    onClick={() => {
                      onKitchenStage(order.id, "ready");
                      onUpdateStatus?.("ready");
                    }}
                    className="min-h-10 flex-1 rounded-xl bg-emerald-600 text-xs font-bold text-white transition hover:bg-emerald-700"
                  >
                    ✅ جاهز بالمحل (Ready)
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t border-border bg-card/95 p-4 backdrop-blur-md">
          {isKitchen && onPrintKitchenTicket ? (
            <button
              type="button"
              onClick={() => onPrintKitchenTicket(order)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#8B4513] text-xs font-bold text-white shadow-sm transition hover:bg-[#5D2E17]"
            >
              <Printer className="h-4 w-4" /> 🖨️ طباعة تذكرة المطبخ
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const id = order.id;
              onClose();
              onOpenFullDetails(id);
            }}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Pencil className="h-4 w-4" /> ✏️ تفاصيل كاملة
          </button>
          {!isKitchen ? (
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-muted text-xs font-bold text-foreground transition-colors hover:bg-accent"
            >
              <Printer className="h-4 w-4" /> 🖨️ طباعة البون
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
