import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  MessageCircle,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DesignGallery } from "@/components/staff/DesignGallery";
import { formatOrderConfirmation } from "@/components/staff/orders-actions";
import { useReceiptUpload } from "@/hooks/use-receipt-upload";
import { jd } from "@/lib/currency";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import { orderLabel } from "@/lib/order-label";
import { printCustomerReceipt } from "@/lib/receipt-templates";
import {
  recordOrderPayment,
  type OrderPatch,
  type SalesOrder,
  type SalesStatus,
} from "@/lib/sales.functions";
import { ORDERS_KEY, SAVED_DRIVERS } from "@/lib/staff-orders-shared";
import { attachReceiptImageUrl, extractReceiptImageUrl, formatStaffNotes } from "@/lib/utils";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

const WORKFLOW_STEPS: Array<{ key: SalesStatus; label: string; icon: string }> = [
  { key: "new", label: "جديد", icon: "⏳" },
  { key: "baking", label: "قيد التنفيذ", icon: "👨‍🍳" },
  { key: "ready", label: "جاهز", icon: "🎂" },
  { key: "out_for_delivery", label: "مع السائق", icon: "🚗" },
  { key: "completed", label: "تم التسليم", icon: "✅" },
];

interface OrderPanelDrawerProps {
  order: SalesOrder;
  onEditOrder?: ((orderId: string) => void) | undefined;
  onZoom: (url: string) => void;
  onClose: () => void;
  onPatch: (input: Omit<OrderPatch, "orderId">) => void;
  onCancel: () => void;
  onDeletePermanent?: (orderId: string) => void;
}

export function OrderPanelDrawer({
  order,
  onEditOrder,
  onZoom,
  onClose,
  onPatch,
  onCancel,
  onDeletePermanent,
}: OrderPanelDrawerProps) {
  const [deposit, setDeposit] = useState(String(order.deposit_paid));
  const [driverName, setDriverName] = useState(order.driver_name ?? "");
  const [driverPhone, setDriverPhone] = useState(order.driver_phone ?? "");

  const prevServerRef = useRef({
    id: order.id,
    deposit_paid: order.deposit_paid,
    driver_name: order.driver_name,
    driver_phone: order.driver_phone,
  });

  useEffect(() => {
    const prev = prevServerRef.current;
    const next = {
      id: order.id,
      deposit_paid: order.deposit_paid,
      driver_name: order.driver_name,
      driver_phone: order.driver_phone,
    };
    prevServerRef.current = next;

    const sync = (prevVal: string, nextVal: string) => (cur: string) =>
      prev.id !== next.id || (prevVal !== nextVal && cur === prevVal) ? nextVal : cur;

    setDeposit(sync(String(prev.deposit_paid), String(next.deposit_paid)));
    setDriverName(sync(prev.driver_name ?? "", next.driver_name ?? ""));
    setDriverPhone(sync(prev.driver_phone ?? "", next.driver_phone ?? ""));
  }, [order.id, order.deposit_paid, order.driver_name, order.driver_phone]);

  const liveTotal = Math.max(
    order.subtotal + (order.method === "delivery" ? order.delivery_fee : 0) - order.discount_amount,
    0,
  );
  const remaining = Math.max(liveTotal - (Number(deposit) || 0), 0);
  const drawerRefundDue = Math.max((Number(deposit) || 0) - liveTotal, 0);

  const confirmationMessage = useMemo(
    () => formatOrderConfirmation(order, liveTotal, Number(deposit) || 0),
    [order, deposit, liveTotal],
  );

  const driverDispatchMessage = useMemo(() => {
    const isGift = Boolean(
      order.recipient_phone &&
      order.recipient_phone.trim() &&
      order.recipient_phone.trim() !== order.sender_phone?.trim(),
    );
    const recipientPhone = order.recipient_phone?.trim() || order.customer_phone;
    const senderPhone = order.sender_phone?.trim() || order.customer_phone;
    const recipientName =
      order.order_name?.trim() || order.recipient_name?.trim() || order.customer_name;
    const collectionText =
      remaining > 0
        ? `المبلغ المطلوب تحصيله من المستلم: ${jd(remaining)} (كاش)`
        : isGift
          ? `المبلغ: مدفوع بالكامل مسبقاً ✅ (هدية - ممنوع طلب أي مبلغ من المستلم)`
          : `المبلغ: مدفوع بالكامل مسبقاً ✅`;

    if (isGift) {
      return `🚗 **طلب توصيل هدية - ${orderLabel(order.order_number, order.staff_code)}**
المستلم: ${recipientName}
هاتف المستلم للتوصيل: ${recipientPhone}
هاتف صاحب الطلب / المرسل (للطوارئ): ${senderPhone}
العنوان: ${order.area || ""} - ${order.address || ""}
الموعد: ${order.requested_date} ${order.requested_time.slice(0, 5)}
${collectionText}
ملاحظات: ${order.notes || "لا يوجد"}`;
    }

    return `🚗 **طلب توصيل جديد - ${orderLabel(order.order_number, order.staff_code)}**
العميل: ${recipientName}
الهاتف: ${order.customer_phone}
العنوان: ${order.area || ""} - ${order.address || ""}
الموعد: ${order.requested_date} ${order.requested_time.slice(0, 5)}
المبلغ المطلوب تحصيله: ${jd(remaining)} ${remaining > 0 ? "(كاش)" : "(مدفوع بالكامل ✅)"}
ملاحظات: ${order.notes || "لا يوجد"}`;
  }, [order, remaining]);

  const queryClient = useQueryClient();
  const recordPaymentServer = useServerFn(recordOrderPayment);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showCliqPayPanel, setShowCliqPayPanel] = useState(false);
  const [cliqAmountInput, setCliqAmountInput] = useState(() =>
    remaining > 0 ? remaining.toFixed(2) : "0",
  );
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(() =>
    extractReceiptImageUrl(order.staff_notes),
  );
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const paymentIdempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const refundIdempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const { uploading: uploadingReceipt, handleFile: uploadReceiptFile } = useReceiptUpload((url) => {
    setReceiptPreviewUrl(url);
    onPatch({ staff_notes: attachReceiptImageUrl(order.staff_notes, url) });
  });

  useEffect(() => {
    setReceiptPreviewUrl(extractReceiptImageUrl(order.staff_notes));
    setCliqAmountInput(remaining > 0 ? remaining.toFixed(2) : "0");
    setShowCliqPayPanel(false);
  }, [order.id, order.staff_notes, remaining]);

  const handleConfirmCliqPayment = async () => {
    const amount = Number(cliqAmountInput);
    if (!Number.isFinite(amount) || amount <= 0 || isProcessingPayment) {
      toast.error("يرجى إدخال مبلغ صحيح أكبر من صفر");
      return;
    }
    setIsProcessingPayment(true);
    try {
      const updatedOrder = await recordPaymentServer({
        data: {
          orderId: order.id,
          amount,
          paymentMethod: "cliq",
          paymentType: amount >= remaining ? "full" : "deposit",
          ...(receiptPreviewUrl ? { referenceNumber: receiptPreviewUrl } : {}),
          notes:
            amount >= remaining
              ? "تسجيل استلام المتبقي كاملاً عبر كليك"
              : "تسجيل دفعة / عربون عبر كليك",
          idempotencyKey: paymentIdempotencyKeyRef.current,
        },
      });
      paymentIdempotencyKeyRef.current = crypto.randomUUID();
      setDeposit(String(updatedOrder.deposit_paid));
      if (order.payment_method !== "cliq") {
        onPatch({ payment_method: "cliq" });
      }
      setShowCliqPayPanel(false);
      toast.success(`تم تسجيل الدفع عبر كليك بقيمة ${jd(amount)} بنجاح ✅`);
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    } catch (err) {
      toast.error((err as Error)?.message || "تعذّر تسجيل الدفعة");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleMarkPaidInFull = (method: "cash" | "cliq" = "cash") => {
    if (remaining <= 0 || isProcessingPayment) return;
    setIsProcessingPayment(true);
    recordPaymentServer({
      data: {
        orderId: order.id,
        amount: remaining,
        paymentMethod: method,
        paymentType: "full",
        notes: `تسجيل استلام المتبقي كاملاً (${method === "cash" ? "كاش" : "كليك"})`,
        idempotencyKey: paymentIdempotencyKeyRef.current,
      },
    })
      .then((updatedOrder) => {
        paymentIdempotencyKeyRef.current = crypto.randomUUID();
        setDeposit(String(updatedOrder.deposit_paid));
        toast.success(
          `تم استلام وتسجيل كامل المبلغ ${jd(remaining)} (${method === "cash" ? "كاش" : "كليك"}) في سجل الدفعات ✅`,
        );
        void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      })
      .catch((err) => {
        toast.error(err?.message || "تعذّر تسجيل الدفعة");
      })
      .finally(() => {
        setIsProcessingPayment(false);
      });
  };

  const handleSettleRefund = () => {
    if (drawerRefundDue <= 0 || isProcessingPayment) return;
    setIsProcessingPayment(true);
    recordPaymentServer({
      data: {
        orderId: order.id,
        amount: drawerRefundDue,
        paymentMethod: order.payment_method || "cash",
        paymentType: "refund",
        notes: `تسوية إرجاع الفائض المالي للزبون`,
        idempotencyKey: refundIdempotencyKeyRef.current,
      },
    })
      .then((updatedOrder) => {
        refundIdempotencyKeyRef.current = crypto.randomUUID();
        setDeposit(String(updatedOrder.deposit_paid));
        toast.success(
          `تم تسجيل تسوية الاسترجاع للعميل بقيمة ${jd(drawerRefundDue)} في سجل الحركات المالية 🔄`,
        );
        void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      })
      .catch((err) => {
        toast.error(err?.message || "تعذّر تسجيل الاسترجاع");
      })
      .finally(() => {
        setIsProcessingPayment(false);
      });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex animate-in justify-start bg-black/60 backdrop-blur-xs duration-200 fade-in"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ms-auto flex h-full w-full max-w-lg animate-in flex-col border-s border-border bg-card p-4 shadow-2xl duration-250 slide-in-from-right sm:p-5">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-foreground">
              {orderLabel(order.order_number, order.staff_code)}
            </h2>
            {order.last_edited_at && (
              <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-600">
                معدّل
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-border text-foreground hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pt-3.5">
          <div className="space-y-2 rounded-2xl border border-border bg-secondary/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground">حالة الطلب السريعة:</span>
              {order.status === "cancelled" && (
                <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-black text-rose-600">
                  ملغي: {order.cancel_reason}
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1 text-center">
              {WORKFLOW_STEPS.map((step) => {
                const isActive = order.status === step.key;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => onPatch({ status: step.key })}
                    className={`flex min-h-[50px] cursor-pointer flex-col items-center justify-center rounded-xl p-2 transition-all ${
                      isActive
                        ? "scale-102 bg-primary font-black text-primary-foreground shadow-xs"
                        : "border border-border/60 bg-card text-foreground hover:bg-secondary/60 active:scale-95"
                    }`}
                  >
                    <span className="text-sm">{step.icon}</span>
                    <span className="mt-0.5 text-[10px] font-bold">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5 rounded-2xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-muted-foreground">
                الإجمالي: <strong className="text-foreground">{jd(liveTotal)}</strong>
              </span>
              <span className="font-bold text-muted-foreground">
                المدفوع: <strong className="text-emerald-600">{jd(Number(deposit) || 0)}</strong>
              </span>
              {drawerRefundDue > 0 ? (
                <span className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 font-black text-purple-600">
                  مستحق إرجاع: {jd(drawerRefundDue)} 🔄
                </span>
              ) : (
                <span
                  className={`font-black ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  المتبقي: {jd(remaining)}
                </span>
              )}
            </div>

            {drawerRefundDue > 0 ? (
              <div className="space-y-1 rounded-xl border border-purple-200 bg-purple-50 p-2.5 text-center text-xs font-black text-purple-800 dark:bg-purple-950/40 dark:text-purple-200">
                <div>🔄 يوجد فائض دفع بقيمة {jd(drawerRefundDue)} واجب إرجاعه للعميل</div>
                <button
                  type="button"
                  disabled={isProcessingPayment}
                  onClick={handleSettleRefund}
                  className="mt-1 cursor-pointer rounded-lg bg-purple-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isProcessingPayment
                    ? "جاري المعالجة..."
                    : `تسجيل إرجاع المبلغ للعميل (${jd(drawerRefundDue)})`}
                </button>
              </div>
            ) : remaining > 0 ? (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessingPayment}
                  onClick={() => handleMarkPaidInFull("cash")}
                  className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>💵 تم استلام المتبقي كاملاً ({jd(remaining)} - كاش)</span>
                </button>
                <button
                  type="button"
                  disabled={isProcessingPayment}
                  onClick={() => setShowCliqPayPanel((prev) => !prev)}
                  className="flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-50 text-xs font-black text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>💳 تسجيل الدفع عبر كليك + إرفاق الصورة (CliQ)</span>
                </button>

                {showCliqPayPanel && (
                  <div className="space-y-2.5 rounded-xl border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-700/60 dark:bg-amber-950/20">
                    <label className="block text-xs font-bold text-foreground">
                      المبلغ المدفوع عبر كليك (د.أ):
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        dir="ltr"
                        value={cliqAmountInput}
                        onChange={(e) => setCliqAmountInput(e.target.value)}
                        className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-black"
                      />
                    </label>

                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-bold text-muted-foreground">
                        صورة إشعار حوالة كليك (اختياري):
                      </span>
                      {receiptPreviewUrl ? (
                        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-300 bg-background p-2">
                          <img
                            src={receiptPreviewUrl}
                            alt="إشعار كليك"
                            onClick={() => onZoom(receiptPreviewUrl)}
                            className="h-12 w-12 shrink-0 cursor-pointer rounded-md border border-border object-cover"
                          />
                          <div className="min-w-0 flex-1 text-[11px]">
                            <p className="font-bold text-emerald-700">تم إرفاق صورة الحوالة ✅</p>
                            <button
                              type="button"
                              onClick={() => receiptInputRef.current?.click()}
                              disabled={uploadingReceipt}
                              className="cursor-pointer font-bold text-primary hover:underline"
                            >
                              تغيير الصورة
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => receiptInputRef.current?.click()}
                          disabled={uploadingReceipt}
                          className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-amber-500/60 bg-background px-3 text-xs font-bold text-amber-900 hover:bg-amber-50 dark:text-amber-200"
                        >
                          {uploadingReceipt ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                          <span>
                            {uploadingReceipt
                              ? "جاري رفع صورة الحوالة..."
                              : "📸 اضغط لإرفاق صورة إشعار كليك"}
                          </span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isProcessingPayment || uploadingReceipt}
                      onClick={() => void handleConfirmCliqPayment()}
                      className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-black text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isProcessingPayment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span>✅ تأكيد استلام الدفع عبر كليك</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-center text-xs font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                ✅ الحساب مسدد بالكامل
              </div>
            )}

            <input
              ref={receiptInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (file) void uploadReceiptFile(file);
              }}
            />

            {!showCliqPayPanel && (receiptPreviewUrl || order.payment_method === "cliq") && (
              <div className="mt-2 border-t border-border/60 pt-2.5">
                {receiptPreviewUrl ? (
                  <div className="flex items-center justify-between gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={receiptPreviewUrl}
                        alt="إشعار حوالة كليك"
                        onClick={() => onZoom(receiptPreviewUrl)}
                        className="h-12 w-12 shrink-0 cursor-pointer rounded-lg border border-border object-cover transition hover:opacity-90"
                      />
                      <div className="text-[11px]">
                        <p className="font-black text-emerald-800 dark:text-emerald-300">
                          💳 صورة إشعار حوالة كليك
                        </p>
                        <button
                          type="button"
                          onClick={() => onZoom(receiptPreviewUrl)}
                          className="cursor-pointer font-bold text-primary hover:underline"
                        >
                          عرض وتكبير 🔍
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => receiptInputRef.current?.click()}
                      disabled={uploadingReceipt}
                      className="cursor-pointer rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-secondary"
                    >
                      {uploadingReceipt ? "جاري الرفع..." : "تغيير"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={uploadingReceipt}
                    className="flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-400 bg-amber-50/50 px-3 text-[11px] font-bold text-amber-900 hover:bg-amber-50 dark:bg-amber-950/20 dark:text-amber-200"
                  >
                    {uploadingReceipt ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {uploadingReceipt
                        ? "جاري رفع صورة الحوالة..."
                        : "📸 إرفاق صورة إشعار حوالة كليك لاحقاً"}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h4 className="text-xs font-black text-foreground">المنتجات المطلوبة</h4>
              {onEditOrder && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditOrder(order.id);
                  }}
                  className="text-xs font-black text-primary hover:underline"
                >
                  تعديل كامل ✏️
                </button>
              )}
            </div>

            <div className="space-y-3">
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  className="space-y-2.5 rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-orange-50/20 p-3.5 shadow-2xs dark:from-amber-950/20 dark:to-orange-950/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-black text-foreground">
                      <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#8B4513] px-2 py-0.5 text-xs font-black text-white">
                        {item.quantity}×
                      </span>
                      <span className="text-sm font-black">{item.name_ar}</span>
                    </p>
                    <span className="shrink-0 rounded-lg border border-amber-200/80 bg-white px-2.5 py-1 text-xs font-black whitespace-nowrap text-foreground shadow-2xs dark:border-amber-800/50 dark:bg-card">
                      {jd(item.unit_price * item.quantity)}
                    </span>
                  </div>

                  {item.options_ar.length > 0 && (
                    <div className="space-y-1.5 border-t border-amber-200/60 pt-2 dark:border-amber-800/40">
                      <span className="mb-1 block text-[11px] font-bold text-amber-900/80 dark:text-amber-300/80">
                        تفاصيل ومواصفات الكيكة:
                      </span>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {item.options_ar.map((option, optIdx) => (
                          <div
                            key={optIdx}
                            className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-white px-3 py-2 text-xs font-bold text-foreground shadow-2xs dark:border-amber-800/40 dark:bg-card"
                            dir="auto"
                          >
                            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                            <span className="leading-snug">{option}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.notes && (
                    <div className="rounded-xl border border-amber-200/70 bg-white p-2.5 text-xs text-foreground dark:border-amber-800/40 dark:bg-card">
                      <span className="font-bold text-amber-900 dark:text-amber-300">
                        ملاحظة الصنف:{" "}
                      </span>
                      <span>{item.notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {order.inscription && (
              <div className="rounded-xl border border-amber-400 bg-amber-500/10 p-2.5 text-xs font-black text-amber-900 dark:text-amber-200">
                ✍️ الكتابة على الكيك: "{order.inscription}"
              </div>
            )}

            {order.notes && (
              <div className="rounded-xl bg-secondary/30 p-2.5 text-[11px] text-muted-foreground">
                ملاحظات: {order.notes}
              </div>
            )}

            {order.staff_notes && formatStaffNotes(order.staff_notes) && (
              <div className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-950 dark:text-amber-200">
                <span className="block font-bold text-foreground">
                  ملاحظات الفريق والسوشيال / إشعار كليك:
                </span>
                <p className="whitespace-pre-wrap">{formatStaffNotes(order.staff_notes)}</p>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-3 empty:hidden">
              <DesignGallery designImageUrl={order.design_image_url} onZoom={onZoom} />
            </div>
          </div>

          {order.method === "delivery" && (
            <div className="space-y-2.5 rounded-2xl border border-border bg-card p-3.5">
              <h4 className="text-xs font-black text-foreground">توجيه التوصيل والسائق</h4>
              <p className="text-xs text-muted-foreground">
                العنوان: {order.area} {order.address ? `— ${order.address}` : ""}
              </p>

              <select
                value={SAVED_DRIVERS.find((d) => d.name === driverName)?.name || ""}
                onChange={(e) => {
                  const sel = SAVED_DRIVERS.find((d) => d.name === e.target.value);
                  if (sel) {
                    setDriverName(sel.name);
                    setDriverPhone(sel.phone);
                    onPatch({ driver_name: sel.name, driver_phone: sel.phone });
                  }
                }}
                className="min-h-[42px] w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground"
              >
                <option value="">— اختيار سائق التوصيل —</option>
                {SAVED_DRIVERS.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.label}
                  </option>
                ))}
              </select>

              {driverPhone && (
                <a
                  href={getWhatsAppChatUrl(driverPhone, driverDispatchMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-xs font-black text-white shadow-xs hover:brightness-95"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>إرسال تفاصيل التوصيل للسائق عبر WhatsApp</span>
                </a>
              )}
            </div>
          )}

          <a
            href={getWhatsAppChatUrl(
              order.sender_phone || order.customer_phone,
              confirmationMessage,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-xs font-black text-white shadow-md hover:brightness-95"
          >
            <MessageCircle className="h-4 w-4" />
            <span>إرسال الفاتورة والتأكيد المالي للمشتري عبر WhatsApp</span>
          </a>

          {Boolean(
            order.recipient_phone &&
            order.recipient_phone !== (order.sender_phone || order.customer_phone),
          ) && (
            <a
              href={getWhatsAppChatUrl(
                order.recipient_phone!,
                `🎂 مرحباً ${order.recipient_name || order.order_name || "عزيزنا"}، لديك إهداء لطيف من Delish Cake & Bake! طلبك جاهز وسيتم توصيله لعنوانكم بكل حب 🎁✨`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-black text-white shadow-sm hover:brightness-95"
            >
              <span>🎁 إرسال بطاقة الإهداء للمستلم عبر WhatsApp (بدون أسعار)</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => printCustomerReceipt(order)}
            className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-card text-xs font-black text-foreground hover:bg-secondary"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة الإيصال الحراري 🖨️</span>
          </button>

          <div className="flex items-center justify-center gap-4 pt-2 text-xs">
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer font-bold text-amber-700 hover:underline"
            >
              إلغاء هذا الطلب
            </button>
            {onDeletePermanent && (
              <>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={() => onDeletePermanent(order.id)}
                  className="flex cursor-pointer items-center gap-1 font-bold text-rose-600 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف نهائي من السيرفر</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
