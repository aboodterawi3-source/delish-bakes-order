import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { DateFilterBar } from "@/components/staff/DateFilterBar";
import { isoDay, matchesDateFilter, type CustomRange, type DateFilterKey } from "@/lib/date-filter";
import { reorderRanks, setQueueRanks } from "@/lib/queue.functions";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import {
  getSalesOrders,
  getShiftReport,
  updateSalesOrder,
  type OrderPatch,
  type PaymentMethod,
  type SalesOrder,
  type SalesStatus,
  type ShiftReport,
} from "@/lib/sales.functions";
import { ModificationsHistoryBox } from "@/components/staff/ModificationsPanel";
import { buildConfirmationMessage } from "@/lib/confirmation-message";
import { esc, printDocument } from "@/lib/print";
import { orderLabel } from "@/lib/order-label";
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

export const ORDERS_KEY = ["sales-orders"] as const;

export const statusMeta: Record<SalesStatus, { ar: string; en: string; chip: string; dot: string }> = {
  new: { ar: "قيد الانتظار", en: "Pending", chip: "bg-amber-100 text-amber-900 border-amber-300", dot: "bg-amber-500" },
  confirmed: { ar: "مؤكد", en: "Confirmed", chip: "bg-blue-100 text-blue-900 border-blue-300", dot: "bg-blue-500" },
  baking: { ar: "قيد التنفيذ والكريمة", en: "In production", chip: "bg-purple-100 text-purple-900 border-purple-300", dot: "bg-purple-500" },
  ready: { ar: "جاهز بالمحل", en: "Ready at store", chip: "bg-emerald-100 text-emerald-900 border-emerald-300", dot: "bg-emerald-500" },
  out_for_delivery: { ar: "مع السائق للتوصيل", en: "Out for delivery", chip: "bg-orange-100 text-orange-900 border-orange-300", dot: "bg-orange-500" },
  completed: { ar: "مكتمل ومستلم", en: "Completed", chip: "bg-green-100 text-green-900 border-green-300", dot: "bg-green-500" },
  delivered: { ar: "تم التسليم", en: "Delivered", chip: "bg-green-100 text-green-900 border-green-300", dot: "bg-green-500" },
  cancelled: { ar: "ملغي", en: "Canceled", chip: "bg-rose-100 text-rose-900 border-rose-300", dot: "bg-rose-500" },
};

export const payMeta: Record<PaymentMethod, { ar: string; en: string }> = {
  cash: { ar: "نقدي", en: "Cash" },
  cliq: { ar: "كليك", en: "CliQ" },
  visa: { ar: "فيزا", en: "Visa" },
};

const jd = (value: number) => `${value.toFixed(2)} د.أ`;
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function printReceipt(order: SalesOrder) {
  const remaining = Math.max(order.total - order.deposit_paid, 0);
  const rows = order.items.length
    ? order.items
        .map(
          (item) =>
            `<tr><td><b>${item.quantity} × ${esc(item.name_ar)}</b>` +
            (item.options_ar.length ? `<br><small style="color:#555;">${esc(item.options_ar.join(" · "))}</small>` : "") +
            (item.notes ? `<br><small style="color:#8b4513;">ملاحظة: ${esc(item.notes)}</small>` : "") +
            `<br><small>${item.unit_price.toFixed(2)} د.أ / حبة</small></td>` +
            `<td style="text-align:left;font-weight:bold;">${(item.unit_price * item.quantity).toFixed(2)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="2">لا توجد أصناف مسجلة</td></tr>`;

  const body = `<h1 style="text-align:center;font-size:20px;margin-bottom:4px;">Delish Cake &amp; Bake</h1>
<div style="text-align:center;font-size:12px;color:#555;">عمان – الأردن · 0779179995</div>
<div style="text-align:center;font-weight:bold;margin:8px 0;border-bottom:2px dashed #000;padding-bottom:4px;">إيصال العميل · CUSTOMER RECEIPT</div>
<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-bottom:4px;">
  <span>${esc(orderLabel(order.order_number, order.staff_code))}</span>
  <span>${esc(order.requested_date)} ${esc(order.requested_time.slice(0, 5))}</span>
</div>
${order.order_name ? `<div style="font-size:13px;margin-bottom:3px;"><b>الطلب:</b> ${esc(order.order_name)}</div>` : ""}
<div style="font-size:13px;margin-bottom:3px;"><b>العميل:</b> ${esc(order.customer_name)} (${esc(order.customer_phone)})</div>
${order.sender_phone ? `<div style="font-size:12px;"><b>المرسل:</b> ${esc(order.sender_phone)}</div>` : ""}
${order.recipient_phone ? `<div style="font-size:12px;"><b>المستلم:</b> ${esc(order.recipient_phone)}</div>` : ""}
<div style="font-size:13px;margin-bottom:6px;"><b>طريقة الاستلام:</b> ${order.method === "delivery" ? `توصيل منازل (${esc(order.area ?? "")} ${esc(order.address ?? "")})` : "استلام من المحل"}</div>
${order.inscription ? `<div style="background:#fff9e6;padding:6px;border:1px solid #d4a373;border-radius:4px;margin:6px 0;font-size:14px;font-weight:bold;">الكتابة على الكيك: ${esc(order.inscription)}</div>` : ""}
${order.card_note ? `<div style="font-size:12px;margin:4px 0;"><b>نص الكرت:</b> ${esc(order.card_note)}</div>` : ""}
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
<table style="width:100%;font-size:13px;border-collapse:collapse;">${rows}</table>
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
<div style="display:flex;justify-content:space-between;font-size:13px;"><span>المجموع الفرعي</span><span>${order.subtotal.toFixed(2)} د.أ</span></div>
${order.discount_amount ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:red;"><span>الخصم</span><span>-${order.discount_amount.toFixed(2)} د.أ</span></div>` : ""}
<div style="display:flex;justify-content:space-between;font-size:13px;"><span>التوصيل</span><span>${order.delivery_fee.toFixed(2)} د.أ</span></div>
<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;border-top:1px solid #000;padding-top:4px;margin-top:4px;"><b>الإجمالي</b><b>${order.total.toFixed(2)} د.أ</b></div>
<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:2px;"><span>المدفوع</span><span>${order.deposit_paid.toFixed(2)} د.أ</span></div>
<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;color:${remaining > 0 ? "red" : "green"};"><span>المتبقي</span><span>${remaining.toFixed(2)} د.أ</span></div>
<div style="font-size:12px;margin-top:4px;">طريقة الدفع: ${order.payment_method ? payMeta[order.payment_method].ar : "—"}</div>
${order.notes ? `<div style="border-top:1px dashed #ccc;margin-top:6px;padding-top:4px;font-size:12px;">ملاحظات: ${esc(order.notes)}</div>` : ""}
<div style="border-top:2px dashed #000;margin:8px 0;"></div>
<div style="text-align:center;font-size:12px;font-weight:bold;">شكراً لاختياركم ديليش 🤍</div>`;

  printDocument(`إيصال ${order.order_number}`, body, "b{font-size:13px}");
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

export function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("962")) return digits;
  if (digits.startsWith("0")) return `962${digits.slice(1)}`;
  return digits;
}

function sendScheduleConfirmation(order: SalesOrder) {
  const message = `أهلاً بك من مخبز ديلش! 🌸 تم تحديث موعد طلبك رقم ${order.order_number} بنجاح إلى ${order.requested_date} الساعة ${order.requested_time.slice(0, 5)}. يسعدنا خدمتكم دائماً!`;
  void navigator.clipboard?.writeText(message).catch(() => undefined);
  window.open(`https://wa.me/${waNumber(order.customer_phone)}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  toast.success("تم تجهيز رسالة التأكيد للواتساب 📲");
}

function sendCustomerWhatsApp(order: SalesOrder) {
  const message =
    order.confirmation_message ??
    buildConfirmationMessage({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      when: `${order.requested_date} ${order.requested_time.slice(0, 5)}`,
      fulfilment:
        order.method === "delivery"
          ? `توصيل · ${order.area ?? ""}${order.address ? ` — ${order.address}` : ""}`
          : "استلام من المحل",
      items: order.items.map((it) => `${it.quantity} × ${it.name_ar}`),
      cakeWriting: order.inscription ?? "",
      cardWriting: order.card_note ?? "",
      notes: order.notes ?? "",
      price: order.subtotal - order.discount_amount,
      deliveryFee: order.delivery_fee,
      total: order.total,
      paid: order.deposit_paid,
      paymentMethod: order.payment_method ?? "",
      recipientPhone: order.recipient_phone ?? order.customer_phone,
      senderPhone: order.sender_phone ?? order.customer_phone,
    });
  void navigator.clipboard?.writeText(message).catch(() => undefined);
  window.open(`https://wa.me/${waNumber(order.customer_phone)}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
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
  if (input.deposit_paid !== undefined) next.deposit_paid = input.deposit_paid;
  if (input.payment_method !== undefined) next.payment_method = input.payment_method;
  if (input.card_note !== undefined) next.card_note = input.card_note;
  if (input.final_photo_requested !== undefined) next.final_photo_requested = input.final_photo_requested;
  if (input.confirmation_message !== undefined) next.confirmation_message = input.confirmation_message;
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

  const authorization = useQuery({
    queryKey: ["my-authorization"],
    queryFn: () => authorizationFn({}),
    staleTime: 30_000,
  });

  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => ordersFn({}),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const patch = useMutation({
    mutationFn: (input: OrderPatch) => updateFn({ data: input }),
    onMutate: (input) => {
      const previous = queryClient.getQueryData<SalesOrder[]>(ORDERS_KEY);
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === input.orderId ? applyPatch(order, input) : order)),
      );
      return { previous };
    },
    onError: (err: Error) => {
      setMoneyError(err.message);
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
    mutationFn: (input: { orderId: string; percent: number; reason: string }) =>
      discountFn({ data: input }),
    onError: (err: Error) => setMoneyError(err.message),
    onSuccess: (updated) => {
      setMoneyError(null);
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
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
    const totalCollected = rawList.reduce((sum, o) => sum + (o.status !== "cancelled" ? o.deposit_paid : 0), 0);
    const totalPendingBalance = rawList.reduce(
      (sum, o) => sum + (o.status !== "cancelled" ? Math.max(o.total - o.deposit_paid, 0) : 0),
      0,
    );
    const activeCount = rawList.filter((o) => ["new", "baking", "ready", "out_for_delivery"].includes(o.status)).length;
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
      <div className="grid gap-3.5 rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
        {/* Quick Analytics Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl bg-secondary/40 p-3 border border-border/60">
            <span className="text-[11px] font-bold text-muted-foreground block">إجمالي الطلبات</span>
            <span className="text-lg font-black text-foreground">{stats.totalOrders} طلب</span>
          </div>
          <div className="rounded-2xl bg-amber-500/10 p-3 border border-amber-500/20">
            <span className="text-[11px] font-black text-amber-700 dark:text-amber-300 block">الطلبات النشطة الآن</span>
            <span className="text-lg font-black text-amber-700 dark:text-amber-300">{stats.activeCount} قيد المتابعة</span>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 p-3 border border-emerald-500/20">
            <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 block">المبالغ المحصلة</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{jd(stats.totalCollected)}</span>
          </div>
          <div className="rounded-2xl bg-rose-500/10 p-3 border border-rose-500/20">
            <span className="text-[11px] font-black text-rose-700 dark:text-rose-300 block">المتبقي عند التسليم</span>
            <span className="text-lg font-black text-rose-700 dark:text-rose-300">{jd(stats.totalPendingBalance)}</span>
          </div>
        </div>

        {/* Search & Actions Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border/60">
          <div className="relative flex-1">
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="ابحث بالاسم، هاتف العميل، اسم الكيك، أو رقم الطلب..."
              className="min-h-[46px] w-full rounded-2xl border border-input bg-background pe-10 ps-3.5 text-sm font-bold text-foreground outline-none focus:border-primary"
            />
            <Search className="absolute end-3.5 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            {term && (
              <button
                type="button"
                onClick={() => setTerm("")}
                className="absolute end-10 top-3 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher (List vs Calendar) */}
            <div className="flex rounded-2xl bg-secondary/60 p-1 border border-border/70">
              <button
                type="button"
                onClick={() => setMode("list")}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  mode === "list"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📋 جدول
              </button>
              <button
                type="button"
                onClick={() => setMode("calendar")}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  mode === "calendar"
                    ? "bg-card text-primary shadow-xs border border-border/80"
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
              className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-foreground hover:bg-secondary cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${orders.isFetching ? "animate-spin text-primary" : ""}`} />
            </button>

            {/* Shift Financial Report Button */}
            {showShiftReport && (
              <button
                type="button"
                onClick={() => setShiftOpen(true)}
                className="min-h-[44px] px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-black shadow-xs hover:opacity-90 active:scale-95 transition flex items-center gap-1.5 cursor-pointer shrink-0"
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
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-secondary/50 border border-border/70">
            {[
              { id: "all" as const, label: "الكل" },
              { id: "delivery" as const, label: "🛵 دليفري منازل" },
              { id: "pickup" as const, label: "🏪 استلام محلي" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMethodFilter(tab.id)}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  methodFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-2xs font-black"
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
                  className={`min-h-[34px] px-3 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer border ${
                    isActive
                      ? "bg-foreground text-background border-foreground shadow-2xs"
                      : "border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/60"
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
          <p className="font-bold text-sm">تعذر تحميل بيانات الطلبات. يرجى تحديث الصفحة.</p>
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
            <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="font-black text-sm text-muted-foreground">لا توجد طلبات مطابقة للبحث أو الفلتر المحدد</p>
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
              onQuickPaid={() => {
                patch.mutate({
                  orderId: order.id,
                  deposit_paid: order.total,
                  payment_method: "cash",
                });
                toast.success(`تم تسجيل دفع كامل المبلغ نقداً للطلب ${order.order_number} ✅`);
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
            discount.mutate({ orderId: selected.id, percent, reason })
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
        />
      ) : null}

      {/* 4. FULLSCREEN IMAGE ZOOM */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div className="relative max-h-[92vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={zoomImage}
              alt="صورة التصميم"
              className="max-h-[85vh] max-w-full rounded-3xl object-contain shadow-2xl border border-white/20"
            />
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="mt-3 mx-auto min-h-[44px] px-6 rounded-full bg-white text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <X className="h-4 w-4" /> إغلاق العرض
            </button>
          </div>
        </div>
      )}

      {/* 5. CANCEL ORDER MODAL */}
      {cancelFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-destructive border-b border-border pb-3">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-black text-base">إلغاء الطلب {cancelFor.order_number}</h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
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
                className="flex-1 min-h-[46px] rounded-xl bg-destructive text-destructive-foreground font-black text-xs shadow-xs hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                تأكيد الإلغاء
              </button>
              <button
                type="button"
                onClick={() => setCancelFor(null)}
                className="flex-1 min-h-[46px] rounded-xl border border-border bg-secondary/50 text-foreground font-bold text-xs hover:bg-secondary cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SHIFT FINANCIAL REPORT MODAL */}
      {shiftOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-emerald-600" />
                <h3 className="font-black text-base text-foreground">تقرير إغلاق الشيفت المالي</h3>
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
              <label className="block text-xs font-bold text-foreground mb-1">تاريخ الشيفت:</label>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
              />
            </div>

            {report ? (
              <div className="space-y-3 rounded-2xl bg-secondary/30 p-3.5 border border-border/70 text-xs">
                {report.byMethod.map((row) => (
                  <div key={row.method} className="flex items-center justify-between font-bold">
                    <span>{row.method === "unpaid" ? "غير محدد" : payMeta[row.method].ar} ({row.orders} طلب)</span>
                    <span className="text-foreground">{jd(row.collected)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border/80 pt-2 font-black text-sm text-foreground">
                  <span>إجمالي المحصل:</span>
                  <span className="text-emerald-600 text-base">{jd(report.collected)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground font-bold">
                  <span>المتبقي على العملاء:</span>
                  <span className="text-rose-600">{jd(report.outstanding)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>إجمالي الطلبات / الملغاة:</span>
                  <span>{report.orders} مكتمل • {report.cancelled} ملغي</span>
                </div>

                <button
                  type="button"
                  onClick={() => printShiftReport(report, shiftDate)}
                  className="w-full min-h-[48px] rounded-2xl bg-primary text-primary-foreground font-black text-xs shadow-md hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
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
}: {
  order: SalesOrder;
  onOpen: (id: string) => void;
  onZoom: (url: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onEditOrder?: ((id: string) => void) | undefined;
  onQuickPaid: () => void;
}) {
  const remaining = Math.max(order.total - order.deposit_paid, 0);
  const statusInfo = statusMeta[order.status] || statusMeta.new;

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs hover:shadow-xs hover:border-primary/40 transition-all space-y-3">
      {/* Top Strip: Status, Order Number, Delivery Method, Date/Time */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black border ${statusInfo.chip}`}>
            <span className={`h-2 w-2 rounded-full ${statusInfo.dot}`} />
            {statusInfo.ar}
          </span>
          <span className="font-black text-sm text-foreground">
            {orderLabel(order.order_number, order.staff_code)}
          </span>
          <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
            {order.order_name?.trim() || order.customer_name}
          </span>
          {order.last_edited_at && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-600 border border-amber-500/20">
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
          <span className="inline-flex items-center gap-1 text-foreground font-black">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            {order.requested_time.slice(0, 5)}
          </span>
        </div>
      </div>

      {/* Middle Row: Content, Inscription, and Fulfilment */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-black text-foreground">{order.customer_name}</span>
            <span dir="ltr" className="text-muted-foreground font-bold">{order.customer_phone}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-secondary text-foreground">
              {order.method === "delivery" ? `🛵 توصيل (${order.area || "عمان"})` : "🏪 استلام محلي"}
            </span>
          </div>

          {/* Items Summary */}
          <div className="text-xs text-muted-foreground">
            {order.items.map((it) => `${it.quantity} × ${it.name_ar}`).join(" • ")}
          </div>

          {/* Inscription Ribbon Badge if present */}
          {order.inscription && (
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-900 dark:text-amber-200 border border-amber-500/20">
              <span>✍️</span>
              <span>"{order.inscription}"</span>
            </div>
          )}

          {/* Modifications alert banner if any */}
          {order.modifications && order.modifications.length > 0 && (
            <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
              آخر تعديل: {order.modifications[order.modifications.length - 1]?.field ?? "—"}
            </div>
          )}
        </div>

        {/* Financial Badge */}
        <div className="flex sm:flex-col items-end justify-between sm:justify-start w-full sm:w-auto gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/40">
          <span className="text-base font-black text-foreground">{jd(order.total)}</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">مدفوع: {jd(order.deposit_paid)}</span>
            <span className={`font-black ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {remaining > 0 ? `باقي ${jd(remaining)}` : "مدفوع بالكامل ✓"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Actions Deck */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/60">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(order.id)}
            className="min-h-[40px] px-4 rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-xs hover:opacity-90 active:scale-95 transition cursor-pointer"
          >
            إدارة الطلب ⚡
          </button>

          {onEditOrder && (
            <button
              type="button"
              onClick={() => onEditOrder(order.id)}
              className="min-h-[40px] px-3.5 rounded-xl border border-border bg-card text-foreground text-xs font-bold hover:bg-secondary active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5 text-primary" />
              <span>تعديل</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => sendCustomerWhatsApp(order)}
            className="min-h-[40px] px-3.5 rounded-xl border border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-black hover:bg-emerald-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span>واتساب</span>
          </button>

          <button
            type="button"
            onClick={() => printReceipt(order)}
            className="min-h-[40px] px-3.5 rounded-xl border border-border bg-card text-foreground text-xs font-bold hover:bg-secondary active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>فاتورة</span>
          </button>

          {remaining > 0 && (
            <button
              type="button"
              onClick={onQuickPaid}
              title="تسجيل دفع المتبقي كاملاً كاش بنقرة واحدة"
              className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-2xs hover:bg-emerald-700 active:scale-95 transition flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>استلام {jd(remaining)} كاش</span>
            </button>
          )}

          {order.schedule_updated_at && (
            <button
              type="button"
              onClick={() => sendScheduleConfirmation(order)}
              className="min-h-[40px] px-3.5 rounded-xl bg-amber-600 text-white text-xs font-black hover:bg-amber-700 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
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
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-card active:scale-90 transition cursor-pointer"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(order.id, 1)}
            title="تأخير في الطابور"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-card active:scale-90 transition cursor-pointer"
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
    return `🚗 **طلب توصيل جديد - ${orderLabel(order.order_number, order.staff_code)}**
العميل: ${order.order_name?.trim() || order.customer_name}
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

  const handleMarkPaidInFull = (method: "cash" | "cliq" = "cash") => {
    setDeposit(liveTotal.toFixed(2));
    onPatch({
      deposit_paid: liveTotal,
      payment_method: method,
    });
    toast.success(`تم استلام كامل المبلغ ${jd(liveTotal)} (${method === "cash" ? "كاش" : "كليك"})`);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-start bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ms-auto flex h-full w-full max-w-lg flex-col bg-card p-4 sm:p-5 shadow-2xl animate-in slide-in-from-right duration-250 border-s border-border">
        {/* Drawer Header */}
        <div className="border-b border-border/80 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-lg text-foreground">
              {orderLabel(order.order_number, order.staff_code)}
            </h2>
            {order.last_edited_at && (
              <span className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-600 border border-amber-500/20">
                معدّل
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground hover:bg-secondary cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pt-3.5 space-y-4">
          {/* Workflow Stepper */}
          <div className="rounded-2xl border border-border bg-secondary/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground">حالة الطلب السريعة:</span>
              {order.status === "cancelled" && (
                <span className="text-[10px] font-black bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-md">
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
                    className={`flex flex-col items-center justify-center rounded-xl p-2 min-h-[50px] transition-all cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground font-black shadow-xs scale-102"
                        : "bg-card text-foreground hover:bg-secondary/60 active:scale-95 border border-border/60"
                    }`}
                  >
                    <span className="text-sm">{step.icon}</span>
                    <span className="text-[10px] font-bold mt-0.5">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Financial Settle */}
          <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-muted-foreground">الإجمالي: <strong className="text-foreground">{jd(liveTotal)}</strong></span>
              <span className="font-bold text-muted-foreground">المدفوع: <strong className="text-emerald-600">{jd(Number(deposit) || 0)}</strong></span>
              <span className={`font-black ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                المتبقي: {jd(remaining)}
              </span>
            </div>

            {remaining > 0 ? (
              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleMarkPaidInFull("cash")}
                  className="w-full min-h-[46px] rounded-xl bg-emerald-600 text-white font-black text-xs shadow-sm hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>💵 تم استلام المتبقي كاملاً ({jd(remaining)} - كاش)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkPaidInFull("cliq")}
                  className="w-full min-h-[40px] rounded-xl border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold text-xs hover:bg-emerald-100 cursor-pointer"
                >
                  💳 تم استلام المتبقي عبر CliQ
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2 text-center text-xs font-black text-emerald-800 dark:text-emerald-200 border border-emerald-200">
                ✅ الحساب مسدد بالكامل
              </div>
            )}
          </div>

          {/* Items & Inscription Review */}
          <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h4 className="font-black text-xs text-foreground">المنتجات المطلوبة</h4>
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

            <div className="space-y-1.5 text-xs">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start border-b border-border/30 pb-1 last:border-0">
                  <div>
                    <p className="font-black text-foreground">{item.quantity} × {item.name_ar}</p>
                    {item.options_ar.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">{item.options_ar.join(" • ")}</p>
                    )}
                  </div>
                  <span className="font-bold">{jd(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {order.inscription && (
              <div className="rounded-xl border border-amber-400 bg-amber-500/10 p-2 text-xs font-black text-amber-900 dark:text-amber-200">
                ✍️ الكتابة على الكيك: "{order.inscription}"
              </div>
            )}

            {order.notes && (
              <div className="text-[11px] text-muted-foreground bg-secondary/30 p-2 rounded-xl">
                ملاحظات: {order.notes}
              </div>
            )}
          </div>

          {/* Delivery & Driver Dispatch */}
          {order.method === "delivery" && (
            <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5">
              <h4 className="font-black text-xs text-foreground">توجيه التوصيل والسائق</h4>
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
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </select>

              {driverPhone && (
                <a
                  href={`https://wa.me/${waNumber(driverPhone)}?text=${encodeURIComponent(driverDispatchMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[42px] rounded-xl bg-[#25D366] text-white font-black text-xs shadow-xs hover:brightness-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>إرسال تفاصيل التوصيل للسائق عبر WhatsApp</span>
                </a>
              )}
            </div>
          )}

          {/* WhatsApp Customer Button */}
          <a
            href={`https://wa.me/${waNumber(order.recipient_phone || order.customer_phone)}?text=${encodeURIComponent(confirmationMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[46px] rounded-2xl bg-[#25D366] text-white font-black text-xs shadow-md hover:brightness-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageCircle className="h-4 w-4" />
            <span>إرسال رسالة التأكيد الكاملة للعميل عبر WhatsApp</span>
          </a>

          {/* Thermal Print Slip */}
          <button
            type="button"
            onClick={() => printReceipt(order)}
            className="w-full min-h-[46px] rounded-2xl border border-border bg-card text-foreground font-black text-xs hover:bg-secondary flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة الإيصال الحراري 🖨️</span>
          </button>

          {/* Cancel Order Action */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
            >
              إلغاء هذا الطلب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
