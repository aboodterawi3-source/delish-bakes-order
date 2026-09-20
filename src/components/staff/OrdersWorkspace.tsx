import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  Bike,
  CalendarClock,
  CheckCircle2,
  Download,
  Link2,
  Lock,
  MessageCircle,
  Pencil,
  Phone,
  Printer,
  RefreshCw,
  Search,
  Store,
  X,
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

const flow: SalesStatus[] = ["new", "baking", "ready", "out_for_delivery", "completed"];

export const statusMeta: Record<SalesStatus, { ar: string; en: string; chip: string }> = {
  new: { ar: "قيد الانتظار", en: "Pending", chip: "bg-[#FDE2CF] text-[#7B3F00]" },
  confirmed: { ar: "مؤكد", en: "Confirmed", chip: "bg-[#FDE2CF] text-[#7B3F00]" },
  baking: { ar: "قيد التنفيذ", en: "In production", chip: "bg-[#EFA781] text-white" },
  ready: { ar: "جاهز بالمحل", en: "Ready at store", chip: "bg-[#B8860B] text-white" },
  out_for_delivery: { ar: "خارج للتوصيل", en: "Out for delivery", chip: "bg-[#8B4513] text-white" },
  completed: { ar: "مكتمل", en: "Completed", chip: "bg-[#166534] text-white" },
  delivered: { ar: "تم التسليم", en: "Delivered", chip: "bg-[#166534] text-white" },
  cancelled: { ar: "ملغي", en: "Canceled", chip: "bg-red-600 text-white" },
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

/** The label shown in the list: the order name, falling back to the customer. */
const listLabel = (order: SalesOrder) =>
  order.order_name?.trim() || order.customer_name?.trim() || "طلب بدون اسم";

/** Delivery region, or a pickup marker. */
const regionLabel = (order: SalesOrder) =>
  order.method === "delivery" ? order.area?.trim() || "منطقة غير محددة" : "استلام من المحل";

/** Saves the customer's original reference photo so staff can print or forward it. */
async function downloadDesignImage(url: string, orderNumber: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download failed");
    const blob = await response.blob();
    const extension = (blob.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `delish-${orderNumber}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Customer thermal receipt: itemised lines plus the full billing block. */
export function printReceipt(order: SalesOrder) {
  const remaining = Math.max(order.total - order.deposit_paid, 0);
  const rows = order.items.length
    ? order.items
        .map(
          (item) =>
            `<tr><td><b>${item.quantity} × ${esc(item.name_ar)}</b>` +
            (item.options_ar.length ? `<br><small>${esc(item.options_ar.join(" · "))}</small>` : "") +
            (item.notes ? `<br><small>ملاحظة: ${esc(item.notes)}</small>` : "") +
            `<br><small>${item.unit_price.toFixed(2)} د.أ / حبة</small></td>` +
            `<td style="text-align:left">${(item.unit_price * item.quantity).toFixed(2)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="2">لا توجد أصناف مسجلة على هذا الطلب</td></tr>`;

  const body = `<h1>Delish Cake &amp; Bake</h1><div>ديليش – الأردن · 0779179995</div>
<div style="text-align:center;font-weight:700">إيصال العميل · CUSTOMER RECEIPT</div><div class="line"></div>
<div class="row"><span>${esc(orderLabel(order.order_number, order.staff_code))}</span><span>${esc(order.requested_date)} ${esc(order.requested_time.slice(0, 5))}</span></div>
${order.order_name ? `<div>اسم الطلب: ${esc(order.order_name)}</div>` : ""}
<div>${esc(order.customer_name)} · ${esc(order.customer_phone)}</div>
${order.sender_phone ? `<div>رقم المرسل: ${esc(order.sender_phone)}</div>` : ""}
${order.recipient_phone ? `<div>رقم المستلم: ${esc(order.recipient_phone)}</div>` : ""}
<div>${order.method === "delivery" ? `توصيل: ${esc(order.area ?? "")} ${esc(order.address ?? "")}` : "استلام من المحل"}</div>
${order.inscription ? `<div>الكتابة على الكيك: ${esc(order.inscription)}</div>` : ""}
${order.card_note ? `<div>الكتابة على الكرت: ${esc(order.card_note)}</div>` : ""}
<div class="line"></div><table>${rows}</table><div class="line"></div>
<div class="row"><span>المجموع</span><span>${order.subtotal.toFixed(2)}</span></div>
${order.discount_amount ? `<div class="row"><span>الخصم</span><span>-${order.discount_amount.toFixed(2)}</span></div>` : ""}
<div class="row"><span>التوصيل</span><span>${order.delivery_fee.toFixed(2)}</span></div>
<div class="row"><b>الإجمالي</b><b>${order.total.toFixed(2)}</b></div>
<div class="row"><span>المدفوع</span><span>${order.deposit_paid.toFixed(2)}</span></div>
<div class="row"><b>المتبقي</b><b>${remaining.toFixed(2)}</b></div>
<div>طريقة الدفع: ${order.payment_method ? payMeta[order.payment_method].ar : "—"}</div>
${order.notes ? `<div class="line"></div><div>ملاحظات: ${esc(order.notes)}</div>` : ""}
${order.last_edited_at ? `<div>✏️ تم تعديل هذا الطلب: ${esc(order.last_edited_at.slice(0, 16).replace("T", " "))}</div>` : ""}
<div class="line"></div><div style="text-align:center">شكراً لاختياركم ديليش 🤍</div>`;

  if (!printDocument(`إيصال ${order.order_number}`, body, "b{font-size:13px}")) {
    toast.error("تعذر فتح نافذة الطباعة");
  }
}

/** Daily shift report on the thermal printer (never prints the screen itself). */
function printShiftReport(report: ShiftReport, date: string) {
  const rows = report.byMethod
    .map(
      (row) =>
        `<div class="row"><span>${row.method === "unpaid" ? "بدون طريقة دفع" : payMeta[row.method].ar} (${row.orders})</span><span>${row.collected.toFixed(2)}</span></div>`,
    )
    .join("");
  const body = `<h1>Delish Cake &amp; Bake</h1>
<div style="text-align:center;font-weight:700">تقرير إغلاق الشيفت</div>
<div style="text-align:center">${esc(date)}</div><div class="line"></div>
${rows || "<div>لا توجد مدفوعات</div>"}<div class="line"></div>
<div class="row"><b>إجمالي المحصل</b><b>${report.collected.toFixed(2)}</b></div>
<div class="row"><span>المتبقي على العملاء</span><span>${report.outstanding.toFixed(2)}</span></div>
<div class="row"><span>عدد الطلبات</span><span>${report.orders}</span></div>
<div class="row"><span>الطلبات الملغاة</span><span>${report.cancelled}</span></div>
<div class="line"></div><div style="text-align:center">توقيع الكاشير: ____________</div>`;
  if (!printDocument(`تقرير ${date}`, body, "b{font-size:13px}")) {
    toast.error("تعذر فتح نافذة الطباعة");
  }
}

/** Jordanian numbers arrive as 07…; WhatsApp needs the international form. */
export function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("962")) return digits;
  if (digits.startsWith("0")) return `962${digits.slice(1)}`;
  return digits;
}

/** Arabic-only schedule confirmation, opened in WhatsApp with a clipboard fallback. */
function sendScheduleConfirmation(order: SalesOrder) {
  const message = `أهلاً بك من مخبز ديلش! 🌸 تم تحديث موعد طلبك رقم ${order.order_number} بنجاح إلى ${order.requested_date} الساعة ${order.requested_time.slice(0, 5)}. يسعدنا خدمتكم دائماً!`;
  void navigator.clipboard?.writeText(message).catch(() => undefined);
  window.open(`https://wa.me/${waNumber(order.customer_phone)}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  toast("تم تجهيز رسالة التأكيد للواتساب 📲");
}

/** Mirrors the server update locally so the card repaints in the same frame. */
function applyPatch(order: SalesOrder, input: OrderPatch): SalesOrder {
  const next: SalesOrder = { ...order };
  if (input.status !== undefined) next.status = input.status;
  if (input.cancel_reason !== undefined) next.cancel_reason = input.cancel_reason;
  if (input.method !== undefined) next.method = input.method;
  if (input.area !== undefined) {
    next.area = input.area;
    // Show the zone fee instantly instead of waiting for the server round-trip.
    next.delivery_fee = input.area ? feeForArea(input.area) ?? next.delivery_fee : 0;
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

/**
 * The complete order desk: search, list, full order editing and printing.
 * Shared by the sales screen and the social-media screen so both teams work on
 * the exact same orders with the exact same abilities.
 */
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

  const [editLink, setEditLink] = useState<string | null>(null);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const search = useDebouncedValue(term, 180);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<SalesOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftDate, setShiftDate] = useState(todayIso);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const [dateKey, setDateKey] = useState<DateFilterKey>("all");
  const [custom, setCustom] = useState<CustomRange>({ from: isoDay(0), to: isoDay(7) });
  const reorderFn = useServerFn(setQueueRanks);

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
    onError: (error: Error, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ORDERS_KEY, ctx.previous);
      setMoneyError(error.message);
    },
    onSuccess: (row) => {
      setMoneyError(null);
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === row.id ? row : order)),
      );
    },
  });


  const discount = useMutation({
    mutationFn: (input: { orderId: string; percent: number; reason: string }) =>
      discountFn({ data: input }),
    onSuccess: () => {
      setMoneyError(null);
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
    onError: (error: Error) => setMoneyError(error.message),
  });

  const issueEditLink = useMutation({
    mutationFn: (orderId: string) => editLinkFn({ data: { orderId } }),
    onSuccess: (result) => {
      setMoneyError(null);
      setEditLink(result.url ?? `${window.location.origin}/edit-order?token=${result.token}`);
    },
    onError: (error: Error) => setMoneyError(error.message),
  });

  useOrdersRealtime(ORDERS_KEY, true, "orders-workspace-live");

  useEffect(() => {
    if (!cancelFor && !shiftOpen && !selectedId && !zoomImage) return;
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

  const list = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = (orders.data ?? []).filter((order) =>
      matchesDateFilter(order.requested_date, dateKey, custom),
    );
    const filtered = !needle
      ? rows
      : rows.filter((order) =>
          [
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
            .includes(needle),
        );
    // A manual queue position always comes first; the rest keep the date order.
    return [...filtered].sort((a, b) => {
      const rankA = a.queue_rank ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.queue_rank ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      const byDate = b.requested_date.localeCompare(a.requested_date);
      if (byDate !== 0) return byDate;
      return b.requested_time.localeCompare(a.requested_time);
    });
  }, [orders.data, search, dateKey, custom]);

  /** Moves one order up or down the manual priority order. */
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
    () => (orders.data ?? []).find((order) => order.id === selectedId) ?? null,
    [orders.data, selectedId],
  );

  const openOrder = useCallback((id: string) => setSelectedId(id), []);

  const runReport = useCallback(async () => {
    setReport(await reportFn({ data: { date: shiftDate } }));
  }, [reportFn, shiftDate]);

  useEffect(() => {
    if (shiftOpen) void runReport();
  }, [shiftOpen, runReport]);

  return (
    <div className="min-w-0">
      {/* Stable workspace controls shared by Sales and Social. */}
      <div className="grid min-w-0 gap-3 border-b border-border pb-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative block min-w-0">
          <span className="sr-only">بحث بالاسم أو الهاتف أو اسم الطلب</span>
          <Search className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="ابحث بالاسم، الهاتف، اسم الطلب، أو رقم الطلب…"
            className="min-h-12 w-full rounded-lg border border-input bg-background pe-11 ps-4 text-sm shadow-sm"
          />
          </label>
          <button
            type="button"
            onClick={() => void orders.refetch()}
            aria-label="تحديث الطلبات"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${orders.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
          {/* List / monthly calendar switch stays distinct from search and filters. */}
          <div className="col-span-2 grid min-h-12 grid-cols-2 rounded-lg border border-border bg-muted p-1 lg:col-span-1 lg:w-52" role="group" aria-label="طريقة عرض الطلبات">
            {(["list", "calendar"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`min-h-10 rounded-md px-4 text-sm font-bold transition-colors ${
                  mode === value
                    ? "bg-background text-primary shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "list" ? "قائمة" : "تقويم"}
              </button>
            ))}
          </div>
        </div>

        {/* Universal date filter occupies its own responsive row. */}
        <DateFilterBar value={dateKey} onChange={setDateKey} custom={custom} onCustom={setCustom} />

        {showShiftReport ? (
          <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShiftOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            <BadgeDollarSign className="h-4 w-4" aria-hidden="true" /> إغلاق الشيفت
          </button>
          </div>
        ) : null}
      </div>

      {orders.isPending ? (
        <p className="py-10 text-center text-sm text-muted-foreground">جار تحميل الطلبات…</p>
      ) : orders.isError ? (
        <p className="py-10 text-center text-sm text-destructive">تعذّر تحميل الطلبات — حدّث الصفحة</p>
      ) : mode === "calendar" ? (
        <OrdersCalendar orders={orders.data ?? []} onOpen={openOrder} onPatch={(patchData) => patch.mutate(patchData)} />
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">لا توجد طلبات مطابقة</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {list.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onOpen={openOrder}
              onZoom={setZoomImage}
              onMove={onMove}
              onEditOrder={onEditOrder}
            />
          ))}
        </ul>
      )}

      {selected ? (
        <OrderPanel
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

      {zoomImage ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="صورة الطلب"
          onClick={() => setZoomImage(null)}
        >
          <img src={zoomImage} alt="صورة تصميم الطلب بالحجم الكامل" className="max-h-[90dvh] max-w-full rounded-2xl" />
        </div>
      ) : null}

      {cancelFor ? (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-x-hidden bg-foreground/50 p-4" role="dialog" aria-modal="true" aria-label="إلغاء الطلب">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-card p-4 sm:p-5">
            <h2 className="font-display text-lg font-bold text-foreground">إلغاء الطلب {cancelFor.order_number}</h2>
            <label className="mt-4 block text-sm font-bold text-foreground">
              سبب الإلغاء (مطلوب) · Reason
              <textarea
                required
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={!cancelReason.trim() || patch.isPending}
                onClick={() => {
                  patch.mutate({ orderId: cancelFor.id, status: "cancelled", cancel_reason: cancelReason.trim() });
                  setCancelFor(null);
                  setSelectedId(null);
                }}
                className="min-h-12 flex-1 rounded-full bg-destructive px-4 text-sm font-bold text-destructive-foreground disabled:opacity-50"
              >
                تأكيد الإلغاء
              </button>
              <button type="button" onClick={() => setCancelFor(null)} className="min-h-12 flex-1 rounded-full border border-border text-sm font-bold text-foreground">
                رجوع
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shiftOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-x-hidden bg-foreground/50 p-4" role="dialog" aria-modal="true" aria-label="إغلاق الشيفت المالي">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <h2 className="me-auto font-display text-lg font-bold text-foreground">إغلاق الشيفت المالي</h2>
              <button type="button" onClick={() => setShiftOpen(false)} aria-label="إغلاق" className="grid h-12 w-12 place-items-center rounded-full border border-border">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <label className="mt-4 block text-sm font-bold text-foreground">
              تاريخ الشيفت · Date
              <input
                type="date"
                value={shiftDate}
                onChange={(event) => setShiftDate(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </label>

            {report ? (
              <div className="mt-4 space-y-2 text-sm">
                {report.byMethod.map((row) => (
                  <div key={row.method} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                    <span className="font-bold text-secondary-foreground">
                      {row.method === "unpaid" ? "بدون طريقة دفع" : payMeta[row.method].ar}
                      <span className="ms-2 text-xs font-normal">({row.orders} طلب)</span>
                    </span>
                    <span className="font-bold text-secondary-foreground">{jd(row.collected)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2 font-bold text-foreground">
                  <span>إجمالي المحصل</span>
                  <span>{jd(report.collected)}</span>
                </div>
                <div className="flex items-center justify-between text-foreground">
                  <span>المتبقي على العملاء</span>
                  <span>{jd(report.outstanding)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>الطلبات · الملغاة</span>
                  <span>{report.orders} · {report.cancelled}</span>
                </div>
                <button
                  type="button"
                  onClick={() => printShiftReport(report, shiftDate)}
                  className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" /> طباعة التقرير اليومي
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">جار حساب التقرير…</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** List card: order number, status, region, order name and a thumbnail. */
const OrderCard = memo(function OrderCard({
  order,
  onOpen,
  onZoom,
  onMove,
  onEditOrder,
}: {
  order: SalesOrder;
  onOpen: (id: string) => void;
  onZoom: (url: string) => void;
  /** Manual priority move: -1 = up, 1 = down. */
  onMove: (id: string, direction: -1 | 1) => void;
  onEditOrder?: ((id: string) => void) | undefined;
}) {
  const remaining = Math.max(order.total - order.deposit_paid, 0);
  return (
    <li className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4">
      <div className="flex min-w-0 gap-3">
        {order.design_image_url ? (
          <button
            type="button"
            onClick={() => onZoom(order.design_image_url as string)}
            aria-label={`تكبير صورة الطلب ${order.order_number}`}
            className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border"
          >
            <img
              src={order.design_image_url}
              alt={`صورة تصميم الطلب ${order.order_number}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta[order.status].chip}`}>
              {statusMeta[order.status].ar}
            </span>
            <span className="font-display text-base font-bold text-foreground">{orderLabel(order.order_number, order.staff_code)}</span>
            <span className="min-w-0 break-words text-sm font-bold text-foreground">{listLabel(order)}</span>
            {order.last_edited_at ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-white">
                <Pencil className="h-3 w-3" aria-hidden="true" /> تم التعديل
              </span>
            ) : null}
            <span className="inline-flex min-w-0 items-center gap-1 break-words text-xs text-muted-foreground sm:ms-auto">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              {order.requested_date} · {order.requested_time.slice(0, 5)}
            </span>
            {order.schedule_updated_at ? (
              <span className="rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-white">
                تم تعديل الموعد 🔄
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 font-bold text-secondary-foreground">
              {order.method === "delivery" ? <Bike className="h-3.5 w-3.5" aria-hidden="true" /> : <Store className="h-3.5 w-3.5" aria-hidden="true" />}
              {regionLabel(order)}
            </span>
            <span className="text-muted-foreground">الإجمالي {jd(order.total)}</span>
            <span className="text-muted-foreground">مدفوع {jd(order.deposit_paid)}</span>
            <span className={remaining > 0 ? "font-bold text-destructive" : "font-bold text-foreground"}>
              المتبقي {jd(remaining)}
            </span>
            {order.payment_method ? <span className="text-muted-foreground">{payMeta[order.payment_method].ar}</span> : null}
          </div>

          {order.modifications && order.modifications.length > 0 ? (
            (() => {
              const lastMod = order.modifications[order.modifications.length - 1];
              if (!lastMod) return null;
              return (
                <div className="mt-2.5 rounded-xl bg-amber-50 p-2 text-[11px] border border-amber-200 text-amber-900 flex flex-wrap items-center gap-1.5">
                  <span className="font-bold">📝 آخر تعديل:</span>
                  <span>{lastMod.field}</span>
                  <span className="line-through text-amber-700/80">{lastMod.oldValue}</span>
                  <span className="font-bold text-emerald-800">← {lastMod.newValue}</span>
                </div>
              );
            })()
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpen(order.id)}
          className="min-h-12 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          إدارة الطلب
        </button>
        {onEditOrder ? (
          <button
            type="button"
            onClick={() => onEditOrder(order.id)}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-primary bg-primary/10 px-4 text-xs font-bold text-primary hover:bg-primary/20 active:scale-95 transition"
          >
            <Pencil className="h-3.5 w-3.5" /> ✏️ تعديل الطلب
          </button>
        ) : null}
        {order.schedule_updated_at ? (
          <button
            type="button"
            onClick={() => sendScheduleConfirmation(order)}
            className="inline-flex min-h-12 max-w-full items-center justify-center gap-2 rounded-full bg-[#166534] px-4 text-center text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-95"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> إرسال تأكيد التعديل للواتساب
          </button>
        ) : null}
        {/* Manual priority ordering (up / down). */}
        <div className="ms-auto flex gap-2">
          <button
            type="button"
            onClick={() => onMove(order.id, -1)}
            aria-label="رفع أولوية الطلب"
            className="grid min-h-12 min-w-12 place-items-center rounded-full border border-border text-foreground"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove(order.id, 1)}
            aria-label="تنزيل أولوية الطلب"
            className="grid min-h-12 min-w-12 place-items-center rounded-full border border-border text-foreground"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
});

const SAVED_DRIVERS = [
  { label: "سائق 1 - أحمد", name: "أحمد", phone: "0790000001" },
  { label: "سائق 2 - محمد", name: "محمد", phone: "0790000002" },
  { label: "سائق 3 - محمود", name: "محمود", phone: "0790000003" },
  { label: "شركة توصيل خارجية", name: "شركة التوصيل", phone: "" },
] as const;

function OrderPanel({
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
  const initialPayChoice = (row: SalesOrder) =>
    row.payment_method !== "cliq"
      ? "cash"
      : row.total > 0 && row.deposit_paid >= row.total
        ? "cliq_full"
        : "cliq_deposit";
  const [payChoice, setPayChoice] = useState<"cash" | "cliq_full" | "cliq_deposit">(() =>
    initialPayChoice(order),
  );
  const [driverName, setDriverName] = useState(order.driver_name ?? "");
  const [driverPhone, setDriverPhone] = useState(order.driver_phone ?? "");
  const [discountPercent, setDiscountPercent] = useState(String(order.discount_percent || ""));
  const [discountReason, setDiscountReason] = useState("");
  const [messageCopied, setMessageCopied] = useState(false);
  const [address, setAddress] = useState(order.address ?? "");
  const [showAdvancedPay, setShowAdvancedPay] = useState(false);

  const mayDiscount = Boolean(authorization?.allow_custom_discount);
  const discountCap = authorization?.max_discount_percent ?? 0;

  useEffect(() => {
    setDeposit(String(order.deposit_paid));
    setPayChoice(initialPayChoice(order));
    setDriverName(order.driver_name ?? "");
    setDriverPhone(order.driver_phone ?? "");
    setDiscountPercent(String(order.discount_percent || ""));
    setDiscountReason("");
    setMessageCopied(false);
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

  const field = "mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm";

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
  };

  return (
    <div
      className="fixed inset-0 z-40 flex max-w-full justify-start overflow-x-hidden bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`إدارة الطلب ${order.order_number}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ms-auto flex h-full w-full max-w-lg min-w-0 flex-col overflow-x-hidden bg-card p-4 sm:p-5 shadow-2xl animate-in slide-in-from-right duration-250 border-s border-border">
        
        {/* HEADER: Quick Info & Immediate Actions */}
        <div className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <h2 className="me-auto font-display text-lg font-bold text-foreground">
              {orderLabel(order.order_number, order.staff_code)}
            </h2>
            {order.last_edited_at ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-bold text-white">
                <Pencil className="h-3 w-3" aria-hidden="true" /> تم التعديل
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground hover:bg-secondary active:scale-95"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-foreground">{order.order_name?.trim() || order.customer_name}</p>
              <p className="text-xs text-muted-foreground" dir="ltr">{order.customer_phone}</p>
            </div>
            
            {/* Quick Contact Action Buttons */}
            <div className="flex items-center gap-2">
              <a
                href={`tel:${order.customer_phone}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/20 active:scale-95"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" /> اتصال
              </a>
              <a
                href={`https://wa.me/${waNumber(order.customer_phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 text-xs font-bold text-[#25D366] hover:bg-[#25D366]/20 active:scale-95"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> واتساب
              </a>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pt-4 space-y-5">

          {/* SINGLE-TAP WORKFLOW STEPPER */}
          <section className="rounded-2xl border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground">حالة الطلب السريعة</h3>
              {order.status === "cancelled" ? (
                <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-bold text-destructive">
                  ملغي: {order.cancel_reason || "لا يوجد سبب"}
                </span>
              ) : null}
            </div>
            
            <div className="grid grid-cols-5 gap-1 text-center">
              {workflowSteps.map((step) => {
                const isActive = order.status === step.key;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => onPatch({ status: step.key })}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 transition-all min-h-14 ${
                      isActive
                        ? "bg-primary text-primary-foreground font-bold shadow-sm scale-[1.02]"
                        : "bg-secondary/50 text-foreground hover:bg-secondary active:scale-95"
                    }`}
                  >
                    <span className="text-base">{step.icon}</span>
                    <span className="text-[10px] mt-0.5 leading-tight">{step.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-destructive hover:underline"
              >
                إلغاء الطلب
              </button>
            </div>
          </section>

          {/* ORDER SUMMARY CARD (CRITICAL PREVIEW) */}
          <section className="rounded-2xl border border-border bg-background p-3.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
              <h3 className="text-sm font-bold text-foreground">تفاصيل المنتجات المطلوبة</h3>
              {onEditOrder ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditOrder(order.id);
                  }}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Pencil className="h-3.5 w-3.5" /> ✏️ تعديل الطلب (سوشيال ميديا)
                </button>
              ) : null}
            </div>

            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-xs border-b border-border/30 pb-1.5 last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-foreground">{item.quantity} × {item.name_ar}</p>
                    {item.options_ar.length > 0 ? (
                      <p className="text-[11px] text-muted-foreground">{item.options_ar.join(" · ")}</p>
                    ) : null}
                  </div>
                  <span className="font-bold text-foreground">{jd(item.unit_price * item.quantity)}</span>
                </div>
              ))}

              {order.inscription ? (
                <div className="mt-2 rounded-xl bg-gold/15 p-2 text-xs text-foreground border border-gold/30">
                  <span className="font-bold text-gold">✍️ الكتابة على الكيك:</span> "{order.inscription}"
                </div>
              ) : null}

              {order.card_note ? (
                <div className="mt-1 rounded-xl bg-secondary p-2 text-xs text-foreground">
                  <span className="font-bold">📜 كارت الإهداء:</span> "{order.card_note}"
                </div>
              ) : null}

              {order.notes ? (
                <div className="mt-1 rounded-xl bg-secondary/80 p-2 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">📝 ملاحظات إضافية:</span> {order.notes}
                </div>
              ) : null}
            </div>

            {/* Audit Log Box Below Items */}
            <div className="mt-3">
              <ModificationsHistoryBox
                modifications={order.modifications}
                lastEditedAt={order.last_edited_at}
              />
            </div>
          </section>

          {/* ONE-TAP FINANCIAL SETTLEMENT */}
          <section className="rounded-2xl border border-border bg-background p-3.5">
            <h3 className="text-sm font-bold text-foreground mb-2">الحساب والمالية</h3>
            
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-secondary/60 p-2.5 text-center text-xs">
              <div>
                <span className="block text-muted-foreground">الإجمالي</span>
                <span className="font-bold text-foreground text-sm">{jd(liveTotal)}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">المدفوع</span>
                <span className="font-bold text-emerald-600 text-sm">{jd(Number(deposit) || 0)}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">المتبقي</span>
                <span className={`font-bold text-sm ${remaining > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {jd(remaining)}
                </span>
              </div>
            </div>

            {/* ONE-CLICK SETTLEMENT BUTTON */}
            {remaining > 0 ? (
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => handleMarkPaidInFull("cash")}
                  className="w-full min-h-12 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition-transform hover:bg-emerald-700 active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" /> 💵 تم استلام المتبقي بالكامل ({jd(remaining)} - كاش)
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkPaidInFull("cliq")}
                  className="w-full min-h-10 rounded-full border border-emerald-600/40 bg-emerald-50 px-4 text-xs font-bold text-emerald-800 hover:bg-emerald-100 active:scale-95"
                >
                  💳 تم استلام المتبقي عبر CliQ
                </button>
              </div>
            ) : (
              <div className="mt-2 rounded-xl bg-emerald-50 p-2 text-center text-xs font-bold text-emerald-700 border border-emerald-200">
                ✅ الحساب مدفوع بالكامل
              </div>
            )}

            {/* Advanced financial toggle */}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedPay(!showAdvancedPay)}
                className="text-[11px] text-muted-foreground hover:underline"
              >
                {showAdvancedPay ? "إخفاء خيارات الخصم والعربون" : "⚙️ خصم خاص / تعديل العربون"}
              </button>

              {showAdvancedPay ? (
                <div className="mt-3 space-y-3 pt-2 border-t border-border">
                  {/* Custom discount */}
                  {mayDiscount ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          max={discountCap}
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(e.target.value)}
                          placeholder="نسبة الخصم %"
                          className="min-h-10 flex-1 rounded-xl border border-input px-3 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => onApplyDiscount?.(Number(discountPercent) || 0, discountReason)}
                          className="min-h-10 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground"
                        >
                          تطبيق
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Edit deposit manual */}
                  <label className="block text-xs font-bold text-foreground">
                    تعديل المبلغ المدفوع يدويًا:
                    <input
                      type="number"
                      value={deposit}
                      onChange={(e) => setDeposit(e.target.value)}
                      onBlur={() => onPatch({ deposit_paid: Number(deposit) || 0 })}
                      className={field}
                    />
                  </label>

                  {/* Customer edit link */}
                  {onIssueEditLink ? (
                    <button
                      type="button"
                      onClick={() => onIssueEditLink()}
                      className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-primary text-xs font-bold text-primary"
                    >
                      <Link2 className="h-3.5 w-3.5" /> إصدار رابط تعديل للعميل
                    </button>
                  ) : null}
                  {editLink ? (
                    <input readOnly value={editLink} className="min-h-10 w-full rounded-xl border px-2 text-[11px]" dir="ltr" />
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {/* DELIVERY & DRIVER ASSIGNMENT */}
          <section className="rounded-2xl border border-border bg-background p-3.5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground">التسليم والتوصيل</h3>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onPatch({ method: "pickup", delivery_fee: 0 })}
                  className={`px-3 py-1 text-xs font-bold rounded-full ${order.method === "pickup" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
                >
                  استلام محلي
                </button>
                <button
                  type="button"
                  onClick={() => onPatch({ method: "delivery" })}
                  className={`px-3 py-1 text-xs font-bold rounded-full ${order.method === "delivery" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
                >
                  توصيل
                </button>
              </div>
            </div>

            {order.method === "pickup" ? (
              <div className="rounded-xl bg-gold/10 p-3 text-xs font-bold text-gold border border-gold/20 flex items-center gap-2">
                <span>⏰ موعد الاستلام من المحل:</span>
                <span>{order.requested_date} · {order.requested_time.slice(0, 5)}</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Area Dropdown & Delivery Fee */}
                <label className="block text-xs font-bold text-foreground">
                  منطقة التوصيل · Delivery zone:
                  <select
                    value={order.area ?? ""}
                    onChange={(event) => {
                      const area = event.target.value;
                      onPatch(area ? { area } : { area: null, delivery_fee: 0 });
                    }}
                    className={field}
                  >
                    <option value="">— اختر المنطقة —</option>
                    {DELIVERY_ZONES.map((zone) => (
                      <optgroup key={zone.labelAr} label={zone.labelAr}>
                        {zone.areas.map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] font-medium text-muted-foreground">
                    أجرة التوصيل المحسوبة: {jd(order.method === "delivery" ? order.delivery_fee : 0)}
                    {order.area === OTHER_GOVERNORATES_AREA
                      ? ` · محافظات أخرى ${OTHER_FEE_MIN}–${OTHER_FEE_MAX} د.أ`
                      : ""}
                  </span>
                </label>

                {/* Text Address Input */}
                <label className="block text-xs font-bold text-foreground">
                  العنوان النصي · Text Address:
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    onBlur={() => onPatch({ address: address.trim() || null })}
                    placeholder="أدخل الشارع، البناية، أو الملاحظة..."
                    className={field}
                  />
                </label>

                {/* Driver Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-foreground">
                    تعيين سائق التوصيل:
                    <select
                      value={SAVED_DRIVERS.find(d => d.name === driverName)?.name || ""}
                      onChange={(e) => {
                        const selected = SAVED_DRIVERS.find(d => d.name === e.target.value);
                        if (selected) {
                          setDriverName(selected.name);
                          setDriverPhone(selected.phone);
                          onPatch({ driver_name: selected.name, driver_phone: selected.phone });
                        }
                      }}
                      className={field}
                    >
                      <option value="">— اختر من السائقين المحفوظين —</option>
                      {SAVED_DRIVERS.map((d) => (
                        <option key={d.name} value={d.name}>{d.label}</option>
                      ))}
                    </select>
                  </label>

                  {driverPhone ? (
                    <a
                      href={`https://wa.me/${waNumber(driverPhone)}?text=${encodeURIComponent(driverDispatchMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95"
                    >
                      <MessageCircle className="h-4 w-4" /> 📲 إرسال تفاصيل الطلب للسائق عبر واتساب
                    </a>
                  ) : null}
                </div>
              </div>
            )}
          </section>

          {/* COMPACT WHATSAPP CUSTOMER CONFIRMATION */}
          <section className="rounded-2xl border border-border bg-background p-3.5 space-y-2">
            <h3 className="text-sm font-bold text-foreground">تأكيد الطلب مع العميل</h3>
            <a
              href={`https://wa.me/${waNumber(order.recipient_phone || order.customer_phone)}?text=${encodeURIComponent(confirmationMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-bold text-white shadow-sm hover:opacity-95 active:scale-95"
            >
              <MessageCircle className="h-5 w-5" /> 💬 إرسال رسالة التأكيد عبر واتساب
            </a>
          </section>

          {/* DESIGN IMAGE IF AVAILABLE */}
          {order.design_image_url ? (
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-foreground">صورة التصميم</h3>
              <button
                type="button"
                onClick={() => onZoom(order.design_image_url as string)}
                className="block w-full overflow-hidden rounded-xl border border-border"
              >
                <img
                  src={order.design_image_url}
                  alt="تصميم الطلب"
                  className="w-full max-h-48 object-cover"
                />
              </button>
            </section>
          ) : null}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="border-t border-border pt-3 mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => printReceipt(order)}
            className="flex-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-primary px-4 text-xs font-bold text-primary hover:bg-primary/5 active:scale-95"
          >
            <Printer className="h-4 w-4" /> طباعة إيصال
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-secondary px-5 text-xs font-bold text-foreground hover:bg-secondary/80 active:scale-95"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
}

