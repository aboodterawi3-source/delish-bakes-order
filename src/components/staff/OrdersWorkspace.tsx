import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  Bike,
  Calendar,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Filter,
  Layers,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Phone,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  Truck,
  User,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { OrdersCalendar } from "@/components/staff/OrdersCalendar";
import { OrderStatusBadge } from "@/components/staff/OrderStatusBadge";
import { DateFilterBar } from "@/components/staff/DateFilterBar";
import { isoDay, matchesDateFilter, type CustomRange, type DateFilterKey } from "@/lib/date-filter";
import { reorderRanks, setQueueRanks } from "@/lib/queue.functions";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import {
  clearAllSalesOrders,
  deleteSalesOrder,
  getSalesOrders,
  getShiftReport,
  updateSalesOrder,
  recordOrderPayment,
  type OrderPatch,
  type PaymentMethod,
  type SalesOrder,
  type SalesStatus,
  type ShiftReport,
} from "@/lib/sales.functions";

import { buildConfirmationMessage } from "@/lib/confirmation-message";
import { esc, printDocument } from "@/lib/print";
import { printCustomerReceipt } from "@/lib/receipt-templates";
import { orderLabel } from "@/lib/order-label";
import { parseDesignImageUrls } from "@/lib/utils";
import {
  applyOrderDiscount,
  createOrderEditLink,
  getMyAuthorization,
  type StaffAuthorization,
} from "@/lib/authorization.functions";
import {
  DELIVERY_ZONES,
  OTHER_FEE_MAX,
  OTHER_FEE_MIN,
  OTHER_GOVERNORATES_AREA,
  feeForArea,
} from "@/lib/delivery-zones";
import { jd } from "@/lib/currency";
import { todayIso } from "@/lib/date-filter";
import { ORDER_STATUS_META } from "@/lib/order-status";
import { waNumber } from "@/lib/whatsapp";
import { formatStaffNotes, extractReceiptImageUrl, attachReceiptImageUrl } from "@/lib/utils";
import { uploadPaymentReceipt } from "@/lib/receipt-upload.functions";
import { convertToWebp } from "@/lib/image-webp";
import { IMAGE_ACCEPT } from "@/lib/image-validation";

export const ORDERS_KEY = ["sales-orders"] as const;

export const statusMeta = ORDER_STATUS_META;

export const payMeta: Record<PaymentMethod, { ar: string; en: string }> = {
  cash: { ar: "نقدي", en: "Cash" },
  cliq: { ar: "كليك", en: "CliQ" },
  visa: { ar: "فيزا", en: "Visa" },
};

export { waNumber };

export function printReceipt(order: SalesOrder) {
  printCustomerReceipt(order);
}

function printShiftReport(report: ShiftReport, date: string) {
  const rows = report.byMethod
    .map(
      (row) =>
        `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>${row.method === "unpaid" ? "بدون طريقة دفع" : payMeta[row.method].ar} (${row.orders})</span><span>${row.collected.toFixed(2)} د.أ</span></div>`,
    )
    .join("");
  const body = `<h1 style="text-align:center;font-size:20px;margin-bottom:4px;font-weight:900;">Delish Bakery • تقرير الشيفت</h1>
<div style="text-align:center;font-weight:bold;font-size:13px;margin-bottom:4px;">تاريخ الشيفت: ${esc(date)}</div>
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
${rows || "<div>لا توجد مدفوعات مسجلة</div>"}
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;"><span>إجمالي المحصل</span><span>${report.collected.toFixed(2)} د.أ</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:2px;"><span>المتبقي على العملاء</span><span>${report.outstanding.toFixed(2)} د.أ</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:2px;"><span>عدد الطلبات المنجزة</span><span>${report.orders}</span></div>
<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:2px;color:red;"><span>الطلبات الملغاة</span><span>${report.cancelled}</span></div>
<div style="border-top:2px dashed #000;margin:12px 0 6px 0;"></div>
<div style="text-align:center;font-size:12px;color:#555;">توقيع واستلام الكاشير: __________________</div>`;

  printDocument(`تقرير ${date}`, body, "b{font-size:13px}");
}

function sendScheduleConfirmation(order: SalesOrder) {
  const message = `أهلاً بك من مخبز ديلش! 🌸 تم تحديث موعد طلبك رقم ${order.order_number} بنجاح إلى ${order.requested_date} الساعة ${order.requested_time.slice(0, 5)}. يسعدنا خدمتكم دائماً!`;
  void navigator.clipboard?.writeText(message).catch(() => undefined);
  window.open(
    `https://wa.me/${waNumber(order.customer_phone)}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener",
  );
  toast.success("تم تجهيز رسالة التأكيد للواتساب 📲");
}

function sendCustomerWhatsApp(order: SalesOrder) {
  const message = buildConfirmationMessage({
    orderNumber: orderLabel(order.order_number, order.staff_code),
    customerName: order.order_name?.trim() || order.customer_name,
    when: `${order.requested_date} ${order.requested_time}`.trim(),
    fulfilment:
      order.method === "delivery"
        ? `توصيل · ${order.area || "—"}${order.address ? ` — ${order.address}` : ""}`
        : "استلام من المحل",
    items: order.items.flatMap((item) => [
      `${item.quantity} × ${item.name_ar}`,
      ...item.options_ar.map((option) => `— ${option}`),
    ]),
    cakeWriting: order.inscription ?? "",
    cardWriting: order.card_note ?? "",
    notes: order.notes ?? "",
    price: order.subtotal,
    deliveryFee: order.method === "delivery" ? order.delivery_fee : 0,
    total: order.total,
    paid: order.deposit_paid,
    paymentMethod: payMeta[order.payment_method ?? "cash"].ar,
    recipientPhone: order.recipient_phone || order.customer_phone,
    senderPhone: order.sender_phone ?? "",
  });
  void navigator.clipboard?.writeText(message).catch(() => undefined);
  window.open(
    `https://wa.me/${waNumber(order.customer_phone)}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener",
  );
  toast.success("تم فتح محادثة الواتساب مع العميل 📲");
}

function applyPatch(order: SalesOrder, input: OrderPatch): SalesOrder {
  const next: SalesOrder = { ...order };
  if (input.status !== undefined) next.status = input.status;
  if (input.cancel_reason !== undefined) next.cancel_reason = input.cancel_reason;
  if (input.method !== undefined) next.method = input.method;
  if (input.area !== undefined) {
    next.area = input.area;
    next.delivery_fee = input.area ? (feeForArea(input.area) ?? next.delivery_fee) : 0;
  }
  if (input.delivery_fee !== undefined) next.delivery_fee = input.delivery_fee;
  if (input.driver_name !== undefined) next.driver_name = input.driver_name;
  if (input.driver_phone !== undefined) next.driver_phone = input.driver_phone;
  if (input.payment_method !== undefined) next.payment_method = input.payment_method;
  if (input.card_note !== undefined) next.card_note = input.card_note;
  if (input.final_photo_requested !== undefined)
    next.final_photo_requested = input.final_photo_requested;
  if (input.confirmation_message !== undefined)
    next.confirmation_message = input.confirmation_message;
  if (input.order_name !== undefined) next.order_name = input.order_name;
  if (input.sender_phone !== undefined) next.sender_phone = input.sender_phone;
  if (input.recipient_phone !== undefined) next.recipient_phone = input.recipient_phone;
  if (input.customer_name !== undefined) next.customer_name = input.customer_name;
  if (input.customer_phone !== undefined) next.customer_phone = input.customer_phone;
  if (input.address !== undefined) next.address = input.address;
  if (input.requested_date !== undefined) next.requested_date = input.requested_date;
  if (input.requested_time !== undefined) next.requested_time = input.requested_time;
  if (input.notes !== undefined) next.notes = input.notes;
  if (input.staff_notes !== undefined) next.staff_notes = input.staff_notes;
  if (input.inscription !== undefined) next.inscription = input.inscription;
  next.total = Math.max(
    next.subtotal + (next.method === "delivery" ? next.delivery_fee : 0) - next.discount_amount,
    0,
  );
  next.last_edited_at = new Date().toISOString();
  return next;
}

export function OrdersWorkspace({
  showShiftReport = false,
  onEditOrder,
}: {
  showShiftReport?: boolean;
  onEditOrder?: ((orderId: string) => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const ordersFn = useServerFn(getSalesOrders);
  const updateFn = useServerFn(updateSalesOrder);
  const reportFn = useServerFn(getShiftReport);
  const authorizationFn = useServerFn(getMyAuthorization);
  const discountFn = useServerFn(applyOrderDiscount);
  const editLinkFn = useServerFn(createOrderEditLink);
  const reorderFn = useServerFn(setQueueRanks);

  const [term, setTerm] = useState("");
  const search = useDebouncedValue(term, 180);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "pickup" | "delivery">("all");
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const [dateKey, setDateKey] = useState<DateFilterKey>("all");
  const [custom, setCustom] = useState<CustomRange>({ from: isoDay(0), to: isoDay(7) });

  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<SalesOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftDate, setShiftDate] = useState(todayIso);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [editLink, setEditLink] = useState<string | null>(null);
  const [moneyError, setMoneyError] = useState<string | null>(null);

  const clearAllFn = useServerFn(clearAllSalesOrders);
  const deleteOrderFn = useServerFn(deleteSalesOrder);
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleWipeAll = async () => {
    setWiping(true);
    try {
      await clearAllFn();
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, []);
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      setWipeConfirmOpen(false);
      setSelectedId(null);
      toast.success("تم مسح وتنظيف كافة الطلبات من الموقع بنجاح ✅");
    } catch (err) {
      toast.error((err as Error).message || "فشل مسح الطلبات");
    } finally {
      setWiping(false);
    }
  };

  const handleDeleteSingle = async (orderId: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الطلب نهائياً من قاعدة البيانات؟")) return;
    setDeletingId(orderId);
    try {
      await deleteOrderFn({ data: { orderId } });
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).filter((o) => o.id !== orderId),
      );
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      if (selectedId === orderId) setSelectedId(null);
      toast.success("تم حذف الطلب نهائياً من قاعدة البيانات ✅");
    } catch (err) {
      toast.error((err as Error).message || "فشل حذف الطلب");
    } finally {
      setDeletingId(null);
    }
  };

  const authorization = useQuery({
    queryKey: ["my-authorization"],
    queryFn: () => authorizationFn({ data: undefined }),
    staleTime: 30_000,
  });

  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => ordersFn({ data: {} }),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const recordPaymentServer = useServerFn(recordOrderPayment);
  const quickCollectKeyMap = useRef<Map<string, string>>(new Map());
  const [collectingOrderId, setCollectingOrderId] = useState<string | null>(null);

  const recordPaymentMutation = useMutation({
    mutationFn: (variables: {
      orderId: string;
      amount: number;
      paymentMethod?: PaymentMethod | null;
      paymentType?: "deposit" | "remainder" | "full" | "refund";
      referenceNumber?: string | null;
      notes?: string | null;
      idempotencyKey?: string | null;
    }) =>
      recordPaymentServer({
        data: {
          ...variables,
          idempotencyKey: variables.idempotencyKey || crypto.randomUUID(),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "تعذّر تسجيل الحركة المالية");
    },
  });
  const patch = useMutation({
    mutationFn: (input: OrderPatch) => updateFn({ data: input }),
    onMutate: (input) => {
      const previous = queryClient.getQueryData<SalesOrder[]>(ORDERS_KEY);
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) =>
          order.id === input.orderId ? applyPatch(order, input) : order,
        ),
      );
      return { previous };
    },
    onError: (err: Error, _variables, context) => {
      setMoneyError(err.message);
      if (context?.previous) {
        queryClient.setQueryData(ORDERS_KEY, context.previous);
      }
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
    onSuccess: (updated) => {
      setMoneyError(null);
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === updated.id ? updated : order)),
      );
    },
  });

  const discount = useMutation({
    mutationFn: (input: {
      orderId: string;
      percent: number;
      reason: string;
      expectedVersion?: number | null;
    }) => discountFn({ data: input }),
    onError: (err: Error) => setMoneyError(err.message),
    onSuccess: (updated, variables) => {
      setMoneyError(null);
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) =>
          order.id === variables.orderId
            ? {
                ...order,
                discount_amount: updated.discount_amount,
                discount_percent: updated.discount_percent,
                total: Math.max(
                  order.subtotal +
                    (order.method === "delivery" ? order.delivery_fee : 0) -
                    updated.discount_amount,
                  0,
                ),
              }
            : order,
        ),
      );
    },
  });

  const issueEditLink = useMutation({
    mutationFn: (orderId: string) => editLinkFn({ data: { orderId } }),
    onSuccess: ({ url }) => setEditLink(url),
    onError: (err: Error) => setMoneyError(err.message),
  });

  useOrdersRealtime(ORDERS_KEY, true, "orders-workspace-live");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (zoomImage) setZoomImage(null);
      else if (cancelFor) setCancelFor(null);
      else if (shiftOpen) setShiftOpen(false);
      else setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelFor, shiftOpen, selectedId, zoomImage]);

  const rawList = orders.data ?? [];

  // Filtered List
  const list = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rawList
      .filter((order) => matchesDateFilter(order.requested_date, dateKey, custom))
      .filter((order) => (methodFilter === "all" ? true : order.method === methodFilter))
      .filter((order) => (statusFilter === "all" ? true : order.status === statusFilter))
      .filter((order) => {
        if (!needle) return true;
        return [
          order.customer_name,
          order.customer_phone,
          order.order_name ?? "",
          order.sender_phone ?? "",
          order.recipient_phone ?? "",
          order.order_number,
          order.area ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        const rankA = a.queue_rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.queue_rank ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        const byDate = b.requested_date.localeCompare(a.requested_date);
        if (byDate !== 0) return byDate;
        return b.requested_time.localeCompare(a.requested_time);
      });
  }, [rawList, search, dateKey, custom, methodFilter, statusFilter]);

  // Statistics Summary
  const stats = useMemo(() => {
    const totalCollected = rawList.reduce(
      (sum, o) => sum + (o.status !== "cancelled" ? o.deposit_paid : 0),
      0,
    );
    const totalPendingBalance = rawList.reduce(
      (sum, o) => sum + (o.status !== "cancelled" ? Math.max(o.total - o.deposit_paid, 0) : 0),
      0,
    );
    const activeCount = rawList.filter((o) =>
      ["new", "baking", "ready", "out_for_delivery"].includes(o.status),
    ).length;
    return { totalCollected, totalPendingBalance, activeCount, totalOrders: rawList.length };
  }, [rawList]);

  const onMove = useCallback(
    async (id: string, direction: -1 | 1) => {
      const items = reorderRanks(list, id, direction);
      if (items.length === 0) return;
      const ranks = new Map(items.map((item) => [item.orderId, item.queue_rank]));
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) =>
          ranks.has(order.id) ? { ...order, queue_rank: ranks.get(order.id)! } : order,
        ),
      );
      try {
        await reorderFn({ data: { items } });
      } catch (error) {
        setMoneyError((error as Error).message);
        void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      }
    },
    [list, queryClient, reorderFn],
  );

  const selected = useMemo(
    () => rawList.find((order) => order.id === selectedId) ?? null,
    [rawList, selectedId],
  );

  const openOrder = useCallback((id: string) => setSelectedId(id), []);

  const runReport = useCallback(async () => {
    setReport(await reportFn({ data: { date: shiftDate } }));
  }, [reportFn, shiftDate]);

  useEffect(() => {
    if (shiftOpen) void runReport();
  }, [shiftOpen, runReport]);

  return (
    <div dir="rtl" className="min-w-0 space-y-4 font-sans select-none">
      {/* 1. MASTER COMMAND & METRICS BAR */}
      <div className="grid gap-3.5 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
        {/* Quick Analytics Counters */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-secondary/40 p-3">
            <span className="block text-[11px] font-bold text-muted-foreground">
              إجمالي الطلبات
            </span>
            <span className="text-lg font-black text-foreground">{stats.totalOrders} طلب</span>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
            <span className="block text-[11px] font-black text-amber-700 dark:text-amber-300">
              الطلبات النشطة الآن
            </span>
            <span className="text-lg font-black text-amber-700 dark:text-amber-300">
              {stats.activeCount} قيد المتابعة
            </span>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <span className="block text-[11px] font-black text-emerald-700 dark:text-emerald-300">
              المبالغ المحصلة
            </span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              {jd(stats.totalCollected)}
            </span>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3">
            <span className="block text-[11px] font-black text-rose-700 dark:text-rose-300">
              المتبقي عند التسليم
            </span>
            <span className="text-lg font-black text-rose-700 dark:text-rose-300">
              {jd(stats.totalPendingBalance)}
            </span>
          </div>
        </div>

        {/* Search & Actions Row */}
        <div className="flex flex-col items-stretch justify-between gap-2.5 border-t border-border/60 pt-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="ابحث بالاسم، هاتف العميل، اسم الكيك، أو رقم الطلب..."
              className="min-h-[46px] w-full rounded-2xl border border-input bg-background ps-3.5 pe-10 text-sm font-bold text-foreground outline-none focus:border-primary"
            />
            <Search className="pointer-events-none absolute end-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            {term && (
              <button
                type="button"
                onClick={() => setTerm("")}
                className="absolute end-10 top-3 cursor-pointer p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher (List vs Calendar) */}
            <div className="flex rounded-2xl border border-border/70 bg-secondary/60 p-1">
              <button
                type="button"
                onClick={() => setMode("list")}
                className={`min-h-[38px] cursor-pointer rounded-xl px-3.5 text-xs font-black transition-all ${
                  mode === "list"
                    ? "border border-border/80 bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📋 جدول
              </button>
              <button
                type="button"
                onClick={() => setMode("calendar")}
                className={`min-h-[38px] cursor-pointer rounded-xl px-3.5 text-xs font-black transition-all ${
                  mode === "calendar"
                    ? "border border-border/80 bg-card text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📅 تقويم
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => void orders.refetch()}
              title="تحديث البيانات"
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-2xl border border-border bg-card text-foreground hover:bg-secondary"
            >
              <RefreshCw
                className={`h-4 w-4 ${orders.isFetching ? "animate-spin text-primary" : ""}`}
              />
            </button>

            {/* Clear All Orders Button */}
            <button
              type="button"
              onClick={() => setWipeConfirmOpen(true)}
              title="تنظيف ومسح كافة الطلبات"
              className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl border border-rose-300 bg-rose-50 px-3.5 text-xs font-black text-rose-800 shadow-2xs transition hover:bg-rose-100 hover:opacity-95 active:scale-95 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              <span className="hidden md:inline">تنظيف كافة الطلبات</span>
            </button>

            {/* Shift Financial Report Button */}
            {showShiftReport && (
              <button
                type="button"
                onClick={() => setShiftOpen(true)}
                className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-primary px-4 text-xs font-black text-primary-foreground shadow-xs transition hover:opacity-90 active:scale-95"
              >
                <BadgeDollarSign className="h-4 w-4" />
                <span>إغلاق الشيفت المالي</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Filters Strip */}
        <DateFilterBar value={dateKey} onChange={setDateKey} custom={custom} onCustom={setCustom} />

        {/* Status Filter Chips & Method Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Method Filter */}
          <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-secondary/50 p-1">
            {[
              { id: "all" as const, label: "الكل" },
              { id: "delivery" as const, label: "🛵 دليفري منازل" },
              { id: "pickup" as const, label: "🏪 استلام محلي" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMethodFilter(tab.id)}
                className={`min-h-[36px] cursor-pointer rounded-xl px-3 text-xs font-bold transition-all ${
                  methodFilter === tab.id
                    ? "bg-primary font-black text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status Filter Scroll */}
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-1">
            {[
              { key: "all", label: "كافة الحالات" },
              { key: "new", label: "قيد الانتظار" },
              { key: "baking", label: "قيد التنفيذ" },
              { key: "ready", label: "جاهز بالمحل" },
              { key: "out_for_delivery", label: "مع السائق" },
              { key: "completed", label: "مكتمل" },
              { key: "cancelled", label: "ملغي" },
            ].map((st) => {
              const isActive = statusFilter === st.key;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusFilter(st.key)}
                  className={`min-h-[34px] shrink-0 cursor-pointer rounded-xl border px-3 text-xs font-black transition-all ${
                    isActive
                      ? "border-foreground bg-foreground text-background shadow-2xs"
                      : "border-border/70 bg-card text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. ORDERS RENDER (CALENDAR OR WORKSPACE TABLE) */}
      {orders.isPending ? (
        <div className="grid h-64 place-items-center rounded-3xl border border-border bg-card">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-bold text-muted-foreground">جاري تحميل جدول الطلبات...</p>
          </div>
        </div>
      ) : orders.isError ? (
        <div className="grid h-48 place-items-center rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center text-destructive">
          <p className="text-sm font-bold">تعذر تحميل بيانات الطلبات. يرجى تحديث الصفحة.</p>
        </div>
      ) : mode === "calendar" ? (
        <OrdersCalendar
          orders={orders.data ?? []}
          onOpen={openOrder}
          onPatch={(patchData) => patch.mutate(patchData)}
        />
      ) : list.length === 0 ? (
        <div className="grid h-52 place-items-center rounded-3xl border border-dashed border-border bg-card p-6 text-center">
          <div>
            <CalendarClock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-black text-muted-foreground">
              لا توجد طلبات مطابقة للبحث أو الفلتر المحدد
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((order) => (
            <OrderRowCard
              key={order.id}
              order={order}
              onOpen={openOrder}
              onZoom={setZoomImage}
              onMove={onMove}
              onEditOrder={onEditOrder}
              isCollecting={collectingOrderId === order.id}
              onQuickPaid={() => {
                const remaining = Math.max(order.total - order.deposit_paid, 0);
                if (remaining <= 0 || collectingOrderId === order.id) return;

                let stableKey = quickCollectKeyMap.current.get(order.id);
                if (!stableKey) {
                  stableKey = crypto.randomUUID();
                  quickCollectKeyMap.current.set(order.id, stableKey);
                }

                setCollectingOrderId(order.id);
                recordPaymentMutation.mutate(
                  {
                    orderId: order.id,
                    amount: remaining,
                    paymentMethod: "cash",
                    paymentType: "full",
                    notes: "تحصيل سريع للمتبقي نقداً من شريط الأوامر",
                    idempotencyKey: stableKey,
                  },
                  {
                    onSuccess: () => {
                      quickCollectKeyMap.current.delete(order.id);
                      setCollectingOrderId(null);
                      toast.success(
                        `تم تسجيل تحصيل كامل المبلغ (${jd(remaining)}) نقداً في سجل الدفعات للطلب ${order.order_number} ✅`,
                      );
                    },
                    onError: () => {
                      setCollectingOrderId(null);
                    },
                  },
                );
              }}
            />
          ))}
        </div>
      )}

      {/* 3. ORDER DETAIL & MANAGEMENT DRAWER */}
      {selected ? (
        <OrderPanelDrawer
          order={selected}
          authorization={authorization.data ?? null}
          moneyError={moneyError}
          editLink={editLink}
          onEditOrder={onEditOrder}
          onApplyDiscount={(percent, reason) =>
            discount.mutate({
              orderId: selected.id,
              percent,
              reason,
              expectedVersion: selected.version ?? 1,
            })
          }
          onIssueEditLink={() => issueEditLink.mutate(selected.id)}
          onZoom={setZoomImage}
          onClose={() => {
            setSelectedId(null);
            setEditLink(null);
            setMoneyError(null);
          }}
          onPatch={(input) => patch.mutate({ ...input, orderId: selected.id })}
          onCancel={() => {
            setCancelReason("");
            setCancelFor(selected);
          }}
          onDeletePermanent={handleDeleteSingle}
        />
      ) : null}

      {/* 4. FULLSCREEN IMAGE ZOOM */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/90 p-4 backdrop-blur-md duration-200 fade-in"
        >
          <div className="relative max-h-[92vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={zoomImage}
              alt="صورة التصميم"
              className="max-h-[85vh] max-w-full rounded-3xl border border-white/20 object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="mx-auto mt-3 flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full bg-white px-6 text-xs font-black text-slate-950 shadow-md"
            >
              <X className="h-4 w-4" /> إغلاق العرض
            </button>
          </div>
        </div>
      )}

      {/* 5. CANCEL ORDER MODAL */}
      {cancelFor && (
        <div className="fixed inset-0 z-50 grid animate-in place-items-center bg-black/60 p-4 backdrop-blur-xs duration-150 fade-in">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-border pb-3 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-black">إلغاء الطلب {cancelFor.order_number}</h3>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">
                سبب الإلغاء (مطلوب لتوثيق السجل) *
              </label>
              <textarea
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="اذكر سبب الإلغاء بالتفصيل..."
                className="w-full rounded-2xl border border-input bg-background p-3 text-xs font-bold outline-none focus:border-destructive"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={!cancelReason.trim() || patch.isPending}
                onClick={() => {
                  patch.mutate({
                    orderId: cancelFor.id,
                    status: "cancelled",
                    cancel_reason: cancelReason.trim(),
                  });
                  setCancelFor(null);
                  setSelectedId(null);
                  toast.success("تم إلغاء الطلب وتوثيق السبب");
                }}
                className="min-h-[46px] flex-1 cursor-pointer rounded-xl bg-destructive text-xs font-black text-destructive-foreground shadow-xs hover:opacity-90 disabled:opacity-40"
              >
                تأكيد الإلغاء
              </button>
              <button
                type="button"
                onClick={() => setCancelFor(null)}
                className="min-h-[46px] flex-1 cursor-pointer rounded-xl border border-border bg-secondary/50 text-xs font-bold text-foreground hover:bg-secondary"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5.1 WIPE ALL ORDERS CONFIRMATION MODAL */}
      {wipeConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid animate-in place-items-center bg-black/60 p-4 backdrop-blur-xs duration-150 fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !wiping) setWipeConfirmOpen(false);
          }}
        >
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-700">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-display text-lg font-black text-foreground">
                تأكيد مسح وتنظيف كافة الطلبات
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                هل أنت متأكد من رغبتك في حذف وتنظيف جميع الطلبات المسجلة في الموقع؟ سيتم تفريغ جدول
                الطلبات وشاشات المطبخ والمبيعات بالكامل للبدء بسجل نظيف.
                <br />
                <strong className="mt-1 block text-rose-600">
                  هذا الإجراء نهائي ولا يمكن التراجع عنه.
                </strong>
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={handleWipeAll}
                disabled={wiping}
                className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-black text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {wiping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>{wiping ? "جار التنظيف..." : "نعم، مسح كافة الطلبات فوراً"}</span>
              </button>
              <button
                type="button"
                onClick={() => setWipeConfirmOpen(false)}
                disabled={wiping}
                className="min-h-12 cursor-pointer rounded-2xl border border-border bg-background px-5 text-sm font-bold text-foreground transition hover:bg-secondary"
              >
                إلغاء وتراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SHIFT FINANCIAL REPORT MODAL */}
      {shiftOpen && (
        <div className="fixed inset-0 z-50 grid animate-in place-items-center bg-black/60 p-4 backdrop-blur-xs duration-150 fade-in">
          <div className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-black text-foreground">تقرير إغلاق الشيفت المالي</h3>
              </div>
              <button
                type="button"
                onClick={() => setShiftOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">تاريخ الشيفت:</label>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
              />
            </div>

            {report ? (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-secondary/30 p-3.5 text-xs">
                {report.byMethod.map((row) => (
                  <div key={row.method} className="flex items-center justify-between font-bold">
                    <span>
                      {row.method === "unpaid" ? "غير محدد" : payMeta[row.method].ar} ({row.orders}{" "}
                      طلب)
                    </span>
                    <span className="text-foreground">{jd(row.collected)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border/80 pt-2 text-sm font-black text-foreground">
                  <span>إجمالي المحصل:</span>
                  <span className="text-base text-emerald-600">{jd(report.collected)}</span>
                </div>
                <div className="flex items-center justify-between font-bold text-muted-foreground">
                  <span>المتبقي على العملاء:</span>
                  <span className="text-rose-600">{jd(report.outstanding)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>إجمالي الطلبات / الملغاة:</span>
                  <span>
                    {report.orders} مكتمل • {report.cancelled} ملغي
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => printShiftReport(report, shiftDate)}
                  className="mt-2 flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary text-xs font-black text-primary-foreground shadow-md transition hover:opacity-90 active:scale-95"
                >
                  <Printer className="h-4 w-4" />
                  <span>طباعة بون الشيفت الحراري 🖨️</span>
                </button>
              </div>
            ) : (
              <div className="grid h-32 place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** MODERN ORDER ROW CARD COMPONENT */
const OrderRowCard = memo(function OrderRowCard({
  order,
  onOpen,
  onZoom,
  onMove,
  onEditOrder,
  onQuickPaid,
  isCollecting,
}: {
  order: SalesOrder;
  onOpen: (id: string) => void;
  onZoom: (url: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onEditOrder?: ((id: string) => void) | undefined;
  onQuickPaid: () => void;
  isCollecting?: boolean;
}) {
  const remaining = Math.max(order.total - order.deposit_paid, 0);
  const refundDue = Math.max(order.deposit_paid - order.total, 0);
  const isOverpaid = refundDue > 0.001;
  const statusInfo = statusMeta[order.status] || statusMeta.new;

  return (
    <div className="space-y-3 rounded-3xl border border-border/80 bg-card p-3.5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs sm:p-4">
      {/* Top Strip: Status, Order Number, Delivery Method, Date/Time */}
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

      {/* Middle Row: Content, Inscription, and Fulfilment */}
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

          {/* Items Summary */}
          <div className="text-xs text-muted-foreground">
            {order.items.map((it) => `${it.quantity} × ${it.name_ar}`).join(" • ")}
          </div>

          {/* Inscription Ribbon Badge if present */}
          {order.inscription && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-900 dark:text-amber-200">
              <span>✍️</span>
              <span>"{order.inscription}"</span>
            </div>
          )}

          {/* Modifications alert banner if any */}
          {order.modifications && order.modifications.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              آخر تعديل: {order.modifications[order.modifications.length - 1]?.field}
            </div>
          )}
        </div>

        {/* Financial Badge */}
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

      {/* Bottom Actions Deck */}
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
            onClick={() => printReceipt(order)}
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

        {/* Priority Rank Stepper */}
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

const SAVED_DRIVERS = [
  { label: "سائق 1 - أحمد", name: "أحمد", phone: "0790000001" },
  { label: "سائق 2 - محمد", name: "محمد", phone: "0790000002" },
  { label: "سائق 3 - محمود", name: "محمود", phone: "0790000003" },
  { label: "شركة توصيل خارجية", name: "شركة التوصيل", phone: "" },
] as const;

/** COMPREHENSIVE ORDER DETAIL DRAWER COMPONENT */
function OrderPanelDrawer({
  order,
  authorization,
  moneyError,
  editLink,
  onEditOrder,
  onApplyDiscount,
  onIssueEditLink,
  onZoom,
  onClose,
  onPatch,
  onCancel,
  onDeletePermanent,
}: {
  order: SalesOrder;
  authorization?: (StaffAuthorization & { isAdmin: boolean }) | null;
  moneyError?: string | null;
  editLink?: string | null;
  onEditOrder?: ((orderId: string) => void) | undefined;
  onApplyDiscount?: (percent: number, reason: string) => void;
  onIssueEditLink?: () => void;
  onZoom: (url: string) => void;
  onClose: () => void;
  onPatch: (input: Omit<OrderPatch, "orderId">) => void;
  onCancel: () => void;
  onDeletePermanent?: (orderId: string) => void;
}) {
  const [deposit, setDeposit] = useState(String(order.deposit_paid));
  const [driverName, setDriverName] = useState(order.driver_name ?? "");
  const [driverPhone, setDriverPhone] = useState(order.driver_phone ?? "");
  const [discountPercent, setDiscountPercent] = useState(String(order.discount_percent || ""));
  const [discountReason, setDiscountReason] = useState("");
  const [address, setAddress] = useState(order.address ?? "");
  const [showAdvancedPay, setShowAdvancedPay] = useState(false);

  const mayDiscount = Boolean(authorization?.allow_custom_discount);
  const discountCap = authorization?.max_discount_percent ?? 0;

  useEffect(() => {
    setDeposit(String(order.deposit_paid));
    setDriverName(order.driver_name ?? "");
    setDriverPhone(order.driver_phone ?? "");
    setDiscountPercent(String(order.discount_percent || ""));
    setDiscountReason("");
    setAddress(order.address ?? "");
  }, [order.id]);

  const liveTotal = Math.max(
    order.subtotal + (order.method === "delivery" ? order.delivery_fee : 0) - order.discount_amount,
    0,
  );
  const remaining = Math.max(liveTotal - (Number(deposit) || 0), 0);
  const drawerRefundDue = Math.max((Number(deposit) || 0) - liveTotal, 0);
  const isDrawerOverpaid = drawerRefundDue > 0.001;

  const confirmationMessage = useMemo(
    () =>
      buildConfirmationMessage({
        orderNumber: orderLabel(order.order_number, order.staff_code),
        customerName: order.order_name?.trim() || order.customer_name,
        when: `${order.requested_date} ${order.requested_time}`.trim(),
        fulfilment:
          order.method === "delivery"
            ? `توصيل · ${order.area || "—"}${order.address ? ` — ${order.address}` : ""}`
            : "استلام من المحل",
        items: order.items.flatMap((item) => [
          `${item.quantity} × ${item.name_ar}`,
          ...item.options_ar.map((option) => `— ${option}`),
        ]),
        cakeWriting: order.inscription ?? "",
        cardWriting: order.card_note ?? "",
        extraNote: "",
        notes: order.notes ?? "",
        price: order.subtotal,
        deliveryFee: order.method === "delivery" ? order.delivery_fee : 0,
        total: liveTotal,
        paid: Number(deposit) || 0,
        paymentMethod: payMeta[order.payment_method ?? "cash"].ar,
        recipientPhone: order.recipient_phone || order.customer_phone,
        senderPhone: order.sender_phone ?? "",
      }),
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
      order.order_name?.trim() || (order as any).recipient_name?.trim() || order.customer_name;
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

  const workflowSteps: Array<{ key: SalesStatus; label: string; icon: string }> = [
    { key: "new", label: "جديد", icon: "⏳" },
    { key: "baking", label: "قيد التنفيذ", icon: "👨‍🍳" },
    { key: "ready", label: "جاهز", icon: "🎂" },
    { key: "out_for_delivery", label: "مع السائق", icon: "🚗" },
    { key: "completed", label: "تم التسليم", icon: "✅" },
  ];

  const queryClient = useQueryClient();
  const recordPaymentServer = useServerFn(recordOrderPayment);
  const uploadReceiptFn = useServerFn(uploadPaymentReceipt);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showCliqPayPanel, setShowCliqPayPanel] = useState(false);
  const [cliqAmountInput, setCliqAmountInput] = useState(() =>
    remaining > 0 ? remaining.toFixed(2) : "0",
  );
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(() =>
    extractReceiptImageUrl(order.staff_notes),
  );
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const paymentIdempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const refundIdempotencyKeyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    setReceiptPreviewUrl(extractReceiptImageUrl(order.staff_notes));
    setCliqAmountInput(remaining > 0 ? remaining.toFixed(2) : "0");
    setShowCliqPayPanel(false);
  }, [order.id, order.staff_notes, remaining]);

  const handleUploadCliQReceipt = async (file: File | undefined) => {
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const converted = await convertToWebp(file, {
        kind: "cake",
        maxDimension: 800,
        quality: 0.8,
      });
      const saved = await uploadReceiptFn({ data: { data_url: converted.dataUrl } });
      setReceiptPreviewUrl(saved.url);
      onPatch({ staff_notes: attachReceiptImageUrl(order.staff_notes, saved.url) });
      toast.success("تم رفع وإرفاق صورة حوالة كليك بنجاح ✅");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر رفع صورة الحوالة");
    } finally {
      setUploadingReceipt(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  };

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
        {/* Drawer Header */}
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
          {/* Workflow Stepper */}
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
              {workflowSteps.map((step) => {
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

          {/* Quick Financial Settle */}
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

            {/* Hidden shared input for CliQ receipt upload */}
            <input
              ref={receiptInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadCliQReceipt(file);
              }}
            />

            {/* CliQ Receipt Thumbnail / Late Upload Control */}
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

          {/* Items & Inscription Review */}
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

            {(() => {
              const designImages = parseDesignImageUrls(order.design_image_url);
              if (designImages.length === 0) return null;
              return (
                <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-black text-foreground">
                      🖼️ {designImages.length > 1
                        ? `الصور المرفقة بالطلب (${designImages.length})`
                        : "الصورة المرفقة بالطلب (تصميم / إشعار حوالة)"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onZoom(designImages[0]!)}
                      className="cursor-pointer text-xs font-bold text-primary hover:underline"
                    >
                      تكبير 🔍
                    </button>
                  </div>
                  <div
                    className={
                      designImages.length > 1
                        ? "grid grid-cols-2 gap-2 sm:grid-cols-3"
                        : "block"
                    }
                  >
                    {designImages.map((imgUrl, idx) => (
                      <img
                        key={imgUrl}
                        src={imgUrl}
                        alt={`مرفق الطلب ${idx + 1}`}
                        onClick={() => onZoom(imgUrl)}
                        className={
                          designImages.length > 1
                            ? "h-32 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 object-cover transition hover:opacity-95"
                            : "max-h-48 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 object-contain transition hover:opacity-95"
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Delivery & Driver Dispatch */}
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
                  href={`https://wa.me/${waNumber(driverPhone)}?text=${encodeURIComponent(driverDispatchMessage)}`}
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

          {/* WhatsApp Confirmation to Payer / Purchaser */}
          <a
            href={`https://wa.me/${waNumber(order.sender_phone || order.customer_phone)}?text=${encodeURIComponent(confirmationMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-xs font-black text-white shadow-md hover:brightness-95"
          >
            <MessageCircle className="h-4 w-4" />
            <span>إرسال الفاتورة والتأكيد المالي للمشتري عبر WhatsApp</span>
          </a>

          {/* If Gift Order, Greeting Link for Recipient (WITHOUT prices/billing) */}
          {Boolean(
            order.recipient_phone &&
            order.recipient_phone !== (order.sender_phone || order.customer_phone),
          ) && (
            <a
              href={`https://wa.me/${waNumber(order.recipient_phone!)}?text=${encodeURIComponent(
                `🎂 مرحباً ${order.recipient_name || order.order_name || "عزيزنا"}، لديك إهداء لطيف من Delish Cake & Bake! طلبك جاهز وسيتم توصيله لعنوانكم بكل حب 🎁✨`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-black text-white shadow-sm hover:brightness-95"
            >
              <span>🎁 إرسال بطاقة الإهداء للمستلم عبر WhatsApp (بدون أسعار)</span>
            </a>
          )}

          {/* Thermal Print Slip */}
          <button
            type="button"
            onClick={() => printReceipt(order)}
            className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-card text-xs font-black text-foreground hover:bg-secondary"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة الإيصال الحراري 🖨️</span>
          </button>

          {/* Cancel & Delete Order Actions */}
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
