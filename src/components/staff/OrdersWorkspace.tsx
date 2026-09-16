import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeDollarSign,
  Bike,
  CalendarClock,
  Download,
  Link2,
  Lock,
  MessageCircle,
  Pencil,
  Printer,
  RefreshCw,
  Search,
  Store,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { OrdersCalendar } from "@/components/staff/OrdersCalendar";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import {
  getSalesOrders,
  getShiftReport,
  updateSalesOrder,
  updateSalesOrderItemPrice,
  type OrderItemPatch,
  type OrderPatch,
  type PaymentMethod,
  type SalesOrder,
  type SalesStatus,
  type ShiftReport,
} from "@/lib/sales.functions";
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
export function OrdersWorkspace({ showShiftReport = false }: { showShiftReport?: boolean }) {
  const queryClient = useQueryClient();
  const ordersFn = useServerFn(getSalesOrders);
  const updateFn = useServerFn(updateSalesOrder);
  const updateItemFn = useServerFn(updateSalesOrderItemPrice);
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

  const updateItem = useMutation({
    mutationFn: (input: OrderItemPatch) => updateItemFn({ data: input }),
    onSuccess: (updatedOrder) => {
      setMoneyError(null);
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === updatedOrder.id ? updatedOrder : order)),
      );
    },
    onError: (error: Error) => setMoneyError(error.message),
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
    const rows = orders.data ?? [];
    if (!needle) return rows;
    return rows.filter((order) =>
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
  }, [orders.data, search]);

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
      {/* Persistent search bar — name, phone, order name, order number or region. */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">بحث بالاسم أو الهاتف أو اسم الطلب</span>
          <Search className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="ابحث بالاسم، الهاتف، اسم الطلب، أو رقم الطلب…"
            className="min-h-12 w-full rounded-full border border-input bg-background pe-11 ps-4 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void orders.refetch()}
          aria-label="تحديث الطلبات"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${orders.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
        {/* List / monthly calendar switch. */}
        <div className="inline-flex min-h-12 items-center rounded-full border border-border p-1">
          {(["list", "calendar"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={`min-h-10 rounded-full px-3 text-xs font-bold ${
                mode === value ? "bg-primary text-primary-foreground" : "text-foreground"
              }`}
            >
              {value === "list" ? "قائمة" : "تقويم"}
            </button>
          ))}
        </div>
        {showShiftReport ? (
          <button
            type="button"
            onClick={() => setShiftOpen(true)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            <BadgeDollarSign className="h-4 w-4" aria-hidden="true" /> إغلاق الشيفت
          </button>
        ) : null}
      </div>

      {orders.isPending ? (
        <p className="py-10 text-center text-sm text-muted-foreground">جار تحميل الطلبات…</p>
      ) : orders.isError ? (
        <p className="py-10 text-center text-sm text-destructive">تعذّر تحميل الطلبات — حدّث الصفحة</p>
      ) : mode === "calendar" ? (
        <OrdersCalendar orders={list} onOpen={openOrder} />
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">لا توجد طلبات مطابقة</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {list.map((order) => (
            <OrderCard key={order.id} order={order} onOpen={openOrder} onZoom={setZoomImage} />
          ))}
        </ul>
      )}

      {selected ? (
        <OrderPanel
          order={selected}
          authorization={authorization.data ?? null}
          moneyError={moneyError}
          editLink={editLink}
          onApplyDiscount={(percent, reason) =>
            discount.mutate({ orderId: selected.id, percent, reason })
          }
          onIssueEditLink={() => issueEditLink.mutate(selected.id)}
          onUpdateItem={(input) => updateItem.mutate({ ...input, orderId: selected.id })}
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
}: {
  order: SalesOrder;
  onOpen: (id: string) => void;
  onZoom: (url: string) => void;
  /** Manual priority move: -1 = up, 1 = down. */
  onMove: (id: string, direction: -1 | 1) => void;
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

function OrderPanel({
  order,
  authorization,
  moneyError,
  editLink,
  onApplyDiscount,
  onIssueEditLink,
  onUpdateItem,
  onZoom,
  onClose,
  onPatch,
  onCancel,
}: {
  order: SalesOrder;
  authorization?: (StaffAuthorization & { isAdmin: boolean }) | null;
  moneyError?: string | null;
  editLink?: string | null;
  onApplyDiscount?: (percent: number, reason: string) => void;
  onIssueEditLink?: () => void;
  onUpdateItem?: (input: Omit<OrderItemPatch, "orderId">) => void;
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
  const [cardNote, setCardNote] = useState(order.card_note ?? "");
  const [messageCopied, setMessageCopied] = useState(false);

  // Editable order identity — saved on blur so every screen can fix any detail.
  const [orderName, setOrderName] = useState(order.order_name ?? "");
  const [senderPhone, setSenderPhone] = useState(order.sender_phone ?? "");
  const [recipientPhone, setRecipientPhone] = useState(order.recipient_phone ?? "");
  const [customerName, setCustomerName] = useState(order.customer_name);
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone);
  const [address, setAddress] = useState(order.address ?? "");
  const [date, setDate] = useState(order.requested_date);
  const [time, setTime] = useState(order.requested_time.slice(0, 5));
  const [inscription, setInscription] = useState(order.inscription ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [staffNotes, setStaffNotes] = useState(order.staff_notes ?? "");

  const mayDiscount = Boolean(authorization?.allow_custom_discount);
  const discountCap = authorization?.max_discount_percent ?? 0;

  // Reset the local fields only when a different order opens, never while typing.
  useEffect(() => {
    setDeposit(String(order.deposit_paid));
    setPayChoice(initialPayChoice(order));
    setDriverName(order.driver_name ?? "");
    setDriverPhone(order.driver_phone ?? "");
    setDiscountPercent(String(order.discount_percent || ""));
    setDiscountReason("");
    setCardNote(order.card_note ?? "");
    setMessageCopied(false);
    setOrderName(order.order_name ?? "");
    setSenderPhone(order.sender_phone ?? "");
    setRecipientPhone(order.recipient_phone ?? "");
    setCustomerName(order.customer_name);
    setCustomerPhone(order.customer_phone);
    setAddress(order.address ?? "");
    setDate(order.requested_date);
    setTime(order.requested_time.slice(0, 5));
    setInscription(order.inscription ?? "");
    setNotes(order.notes ?? "");
    setStaffNotes(order.staff_notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const liveTotal = Math.max(
    order.subtotal + (order.method === "delivery" ? order.delivery_fee : 0) - order.discount_amount,
    0,
  );
  const remaining = Math.max(liveTotal - (Number(deposit) || 0), 0);

  /** Built live from the order so staff always send current figures. */
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
        cardWriting: cardNote,
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
    [order, cardNote, deposit, liveTotal],
  );

  const stageIndex = flow.indexOf(order.status);
  const next = stageIndex >= 0 && stageIndex < flow.length - 1 ? flow[stageIndex + 1] : null;
  const field = "mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm";

  return (
    <div className="fixed inset-0 z-30 flex max-w-full justify-start overflow-x-hidden bg-foreground/50" role="dialog" aria-modal="true" aria-label={`إدارة الطلب ${order.order_number}`}>
      <div className="ms-auto h-full w-full max-w-md min-w-0 overflow-x-hidden overflow-y-auto bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <h2 className="me-auto font-display text-lg font-bold text-foreground">{orderLabel(order.order_number, order.staff_code)}</h2>
          {order.last_edited_at ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-1 text-[11px] font-bold text-white">
              <Pencil className="h-3 w-3" aria-hidden="true" /> تم التعديل
            </span>
          ) : null}
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-12 w-12 place-items-center rounded-full border border-border">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Delivery order identity — order name, sender, recipient, region. */}
        <section className="mt-4 space-y-3 rounded-2xl border border-border bg-background p-3.5">
          <h3 className="text-sm font-bold text-foreground">بيانات الطلب · Delivery order</h3>
          <label className="block text-sm font-bold text-foreground">
            اسم الطلب · Order name
            <input
              value={orderName}
              onChange={(event) => setOrderName(event.target.value)}
              onBlur={() => onPatch({ order_name: orderName.trim() || null })}
              placeholder="مثال: كيكة عيد ميلاد سارة"
              className={field}
            />
          </label>
          <label className="block text-sm font-bold text-foreground">
            اسم العميل · Customer
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              onBlur={() => customerName.trim() && onPatch({ customer_name: customerName.trim() })}
              className={field}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-bold text-foreground">
              رقم المرسل · Sender phone
              <input
                dir="ltr"
                inputMode="tel"
                value={senderPhone}
                onChange={(event) => setSenderPhone(event.target.value)}
                onBlur={() => onPatch({ sender_phone: senderPhone.trim() || null })}
                className={field}
              />
            </label>
            <label className="block text-sm font-bold text-foreground">
              رقم المستلم · Recipient phone
              <input
                dir="ltr"
                inputMode="tel"
                value={recipientPhone}
                onChange={(event) => setRecipientPhone(event.target.value)}
                onBlur={() => onPatch({ recipient_phone: recipientPhone.trim() || null })}
                className={field}
              />
            </label>
          </div>
          <label className="block text-sm font-bold text-foreground">
            هاتف التواصل · Contact phone
            <input
              dir="ltr"
              inputMode="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              onBlur={() => customerPhone.trim() && onPatch({ customer_phone: customerPhone.trim() })}
              className={field}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-bold text-foreground">
              التاريخ · Date
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                onBlur={() => date && onPatch({ requested_date: date })}
                className={field}
              />
            </label>
            <label className="block text-sm font-bold text-foreground">
              الوقت · Time
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                onBlur={() => time && onPatch({ requested_time: time })}
                className={field}
              />
            </label>
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-bold text-foreground">حالة الطلب</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {flow.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onPatch({ status })}
                aria-pressed={order.status === status}
                className={`min-h-12 rounded-full px-4 text-xs font-bold ${order.status === status ? statusMeta[status].chip : "border border-border text-foreground"}`}
              >
                {statusMeta[status].ar}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {next ? (
              <button type="button" onClick={() => onPatch({ status: next })} className="min-h-12 flex-1 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground">
                نقل إلى: {statusMeta[next].ar}
              </button>
            ) : null}
            <button type="button" onClick={onCancel} className="min-h-12 rounded-full border border-destructive px-4 text-sm font-bold text-destructive">
              إلغاء الطلب
            </button>
          </div>
          {order.cancel_reason ? (
            <p className="mt-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">سبب الإلغاء: {order.cancel_reason}</p>
          ) : null}
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-bold text-foreground">طريقة التسليم</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPatch({ method: "pickup", delivery_fee: 0 })}
              aria-pressed={order.method === "pickup"}
              className={`min-h-12 flex-1 rounded-full px-4 text-sm font-bold ${order.method === "pickup" ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}
            >
              استلام من المحل
            </button>
            <button
              type="button"
              onClick={() => onPatch({ method: "delivery" })}
              aria-pressed={order.method === "delivery"}
              className={`min-h-12 flex-1 rounded-full px-4 text-sm font-bold ${order.method === "delivery" ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}
            >
              توصيل
            </button>
          </div>

          {order.method === "delivery" ? (
            <div className="mt-3 space-y-3">
              <label className="block text-sm font-bold text-foreground">
                منطقة التوصيل · Delivery zone
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
                <span className="mt-1 block text-xs font-medium text-muted-foreground">
                  أجرة التوصيل المحسوبة: {jd(order.method === "delivery" ? order.delivery_fee : 0)}
                  {order.area === OTHER_GOVERNORATES_AREA
                    ? ` · محافظات أخرى ${OTHER_FEE_MIN}–${OTHER_FEE_MAX} د.أ، يعدّلها الفريق`
                    : ""}
                </span>
              </label>
              <label className="block text-sm font-bold text-foreground">
                العنوان · Address
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  onBlur={() => onPatch({ address: address.trim() || null })}
                  className={field}
                />
              </label>
              <label className="block text-sm font-bold text-foreground">
                اسم السائق · Driver name
                <input
                  value={driverName}
                  onChange={(event) => setDriverName(event.target.value)}
                  onBlur={() => onPatch({ driver_name: driverName.trim() || null })}
                  className={field}
                />
              </label>
              <label className="block text-sm font-bold text-foreground">
                هاتف السائق · Driver phone
                <input
                  dir="ltr"
                  inputMode="tel"
                  value={driverPhone}
                  onChange={(event) => setDriverPhone(event.target.value)}
                  onBlur={() => onPatch({ driver_phone: driverPhone.trim() || null })}
                  className={field}
                />
              </label>
            </div>
          ) : null}
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-bold text-foreground">المالية</h3>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between text-foreground"><span>المجموع الفرعي</span><span>{jd(order.subtotal)}</span></div>
            <div className="flex justify-between text-foreground"><span>التوصيل</span><span>{jd(order.method === "delivery" ? order.delivery_fee : 0)}</span></div>
            {order.discount_amount > 0 ? (
              <div className="flex justify-between text-destructive">
                <span>الخصم ({order.discount_percent}%)</span>
                <span>− {jd(order.discount_amount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between font-bold text-foreground"><span>الإجمالي</span><span>{jd(liveTotal)}</span></div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <h4 className="me-auto text-sm font-bold text-foreground">خصم خاص · Custom discount</h4>
              {mayDiscount ? (
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                  حتى {discountCap}%
                </span>
              ) : (
                <span
                  title="تحتاج تصريح المدير · Requires admin authorization"
                  className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold"
                >
                  <Lock className="h-3 w-3" aria-hidden="true" /> تحتاج تصريح المدير
                </span>
              )}
            </div>

            {mayDiscount ? (
              <div className="mt-2 space-y-2">
                <input
                  type="number"
                  min="0"
                  max={discountCap}
                  step="1"
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(event.target.value)}
                  aria-label="نسبة الخصم"
                  className="min-h-12 w-full rounded-xl border border-input bg-card px-3 text-sm"
                />
                <input
                  value={discountReason}
                  onChange={(event) => setDiscountReason(event.target.value)}
                  placeholder="سبب الخصم · Reason"
                  className="min-h-12 w-full rounded-xl border border-input bg-card px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => onApplyDiscount?.(Number(discountPercent) || 0, discountReason)}
                  className="min-h-12 w-full rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.01] active:scale-95"
                >
                  تطبيق الخصم · Apply discount
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                لا يمكنك منح خصم على هذا الحساب. اطلب من المدير تفعيل الصلاحية.
              </p>
            )}
          </div>

          {/* One-time, one-hour customer edit link */}
          <div className="mt-3 rounded-2xl border border-border bg-background p-3">
            <button
              type="button"
              onClick={() => onIssueEditLink?.()}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-primary px-4 text-sm font-bold text-primary transition-transform hover:scale-[1.01] active:scale-95"
            >
              <Link2 className="h-4 w-4" aria-hidden="true" /> رابط تعديل للعميل (ساعة واحدة)
            </button>
            {editLink ? (
              <div className="mt-2 space-y-2">
                <input
                  readOnly
                  dir="ltr"
                  value={editLink}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-h-12 w-full rounded-xl border border-input bg-card px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(editLink)}
                  className="min-h-11 w-full rounded-full bg-secondary px-4 text-xs font-bold text-secondary-foreground"
                >
                  نسخ الرابط · Copy link
                </button>
                <p className="text-[11px] text-muted-foreground">
                  يعمل لمرة واحدة فقط ويُقفل بعد الاستخدام أو بعد ساعة.
                </p>
              </div>
            ) : null}
          </div>

          {moneyError ? (
            <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">{moneyError}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { value: "cash", label: "كاش عند الاستلام" },
                { value: "cliq_full", label: "كليك دفع كامل" },
                { value: "cliq_deposit", label: "عربون عبر كليك" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setPayChoice(option.value);
                  if (option.value === "cash") {
                    setDeposit("0");
                    onPatch({ payment_method: "cash", deposit_paid: 0 });
                    return;
                  }
                  if (option.value === "cliq_full") {
                    setDeposit(liveTotal.toFixed(2));
                    onPatch({ payment_method: "cliq", deposit_paid: liveTotal });
                    return;
                  }
                  onPatch({ payment_method: "cliq" });
                }}
                aria-pressed={payChoice === option.value}
                className={`min-h-12 min-w-20 flex-1 rounded-full px-2 text-sm font-bold ${payChoice === option.value ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {payChoice !== "cash" ? (
            <label className="mt-3 block text-sm font-bold text-foreground">
              {payChoice === "cliq_full"
                ? "المبلغ الكامل المدفوع عبر كليك · CliQ full amount"
                : "قيمة العربون المدفوع عبر كليك · CliQ deposit"}
              <input
                type="number"
                min="0"
                step="0.25"
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
                onBlur={() => onPatch({ deposit_paid: Number(deposit) || 0 })}
                className={field}
              />
            </label>
          ) : null}
          <div className="mt-2 space-y-1 rounded-xl bg-secondary/60 p-3 text-sm">
            <div className="flex justify-between"><span>الحساب كامل</span><span className="font-bold">{jd(liveTotal)}</span></div>
            <div className="flex justify-between"><span>المبلغ المدفوع</span><span className="font-bold">{jd(Number(deposit) || 0)}</span></div>
            <div className={`flex justify-between border-t border-border pt-1 font-bold ${remaining > 0 ? "text-destructive" : "text-foreground"}`}>
              <span>المبلغ المتبقي</span><span>{jd(remaining)}</span>
            </div>
          </div>
        </section>

        {/* Card writing and the official confirmation message. */}
        <section className="mt-6 rounded-2xl border border-border p-3.5">
          <h3 className="text-sm font-bold text-foreground">👑 رسالة تأكيد الطلب</h3>
          <label className="mt-3 block text-sm font-bold text-foreground">
            الكتابة على الكرت
            <input
              type="text"
              maxLength={1000}
              value={cardNote}
              onChange={(event) => setCardNote(event.target.value)}
              onBlur={() => onPatch({ card_note: cardNote.trim() || null })}
              className={field}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPatch({ confirmation_message: confirmationMessage })}
              className="min-h-12 flex-1 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
            >
              توليد وحفظ الرسالة
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(confirmationMessage);
                  setMessageCopied(true);
                  window.setTimeout(() => setMessageCopied(false), 2500);
                } catch {
                  toast.error("تعذّر النسخ — حدّد النص وانسخه يدوياً");
                }
              }}
              className="min-h-12 flex-1 rounded-full border border-border px-4 text-sm font-bold text-foreground"
            >
              {messageCopied ? "تم النسخ" : "نسخ الرسالة"}
            </button>
            {/* Compact WhatsApp send button */}
            <a
              href={`https://wa.me/${waNumber(order.recipient_phone || order.customer_phone)}?text=${encodeURIComponent(confirmationMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="إرسال الرسالة على واتساب"
              title="إرسال على واتساب"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-[#25D366] text-white"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
          <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-secondary/60 p-3 text-xs text-foreground">
            {confirmationMessage}
          </pre>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-bold text-foreground">تفاصيل الطلب</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="space-y-2 rounded-2xl border border-border bg-background p-3.5">
                <label className="block text-xs font-bold text-foreground">
                  وصف الصنف · Item
                  <textarea
                    rows={2}
                    defaultValue={item.name_ar}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value && value !== item.name_ar) onUpdateItem?.({ itemId: item.id, name: value });
                    }}
                    className="mt-1 w-full rounded-xl border border-input bg-card p-2 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-bold text-foreground">
                    الكمية · Qty
                    <input
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={item.quantity}
                      onBlur={(event) => {
                        const value = parseInt(event.target.value, 10);
                        if (Number.isFinite(value) && value >= 1 && value !== item.quantity) {
                          onUpdateItem?.({ itemId: item.id, quantity: value });
                        }
                      }}
                      className="mt-1 min-h-11 w-full rounded-xl border border-input bg-card px-2 text-center text-sm font-bold"
                    />
                  </label>
                  <label className="block text-xs font-bold text-foreground">
                    سعر الوحدة · Unit price
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      defaultValue={item.unit_price}
                      onBlur={(event) => {
                        const value = parseFloat(event.target.value);
                        if (!Number.isNaN(value) && value !== item.unit_price) {
                          onUpdateItem?.({ itemId: item.id, newUnitPrice: value });
                        }
                      }}
                      className="mt-1 min-h-11 w-full rounded-xl border border-input bg-card px-2 text-center text-sm font-bold"
                    />
                  </label>
                </div>
                <label className="block text-xs font-bold text-foreground">
                  ملاحظة الصنف · Item note
                  <input
                    defaultValue={item.notes ?? ""}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value !== (item.notes ?? "")) onUpdateItem?.({ itemId: item.id, notes: value || null });
                    }}
                    className="mt-1 min-h-11 w-full rounded-xl border border-input bg-card px-2 text-sm"
                  />
                </label>
                {item.options_ar.length ? (
                  <ul className="space-y-0.5 text-xs font-semibold text-primary">
                    {item.options_ar.map((option) => (
                      <li key={option}>• {option}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs font-bold text-muted-foreground">
                  إجمالي الصنف: {jd(item.unit_price * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <label className="mt-3 block text-sm font-bold text-foreground">
            الكتابة على الكيك
            <input
              value={inscription}
              onChange={(event) => setInscription(event.target.value)}
              onBlur={() => onPatch({ inscription: inscription.trim() || null })}
              className={field}
            />
          </label>
          <label className="mt-3 block text-sm font-bold text-foreground">
            ملاحظات العميل
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => onPatch({ notes: notes.trim() || null })}
              className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"
            />
          </label>
          <label className="mt-3 block text-sm font-bold text-foreground">
            ملاحظات داخلية
            <textarea
              rows={2}
              value={staffNotes}
              onChange={(event) => setStaffNotes(event.target.value)}
              onBlur={() => onPatch({ staff_notes: staffNotes.trim() || null })}
              className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"
            />
          </label>

          {order.design_image_url ? (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => onZoom(order.design_image_url as string)}
                className="block w-full overflow-hidden rounded-xl border border-border"
                aria-label="تكبير صورة التصميم"
              >
                <img
                  src={order.design_image_url}
                  alt={`صورة التصميم المطلوب للطلب ${order.order_number}`}
                  loading="lazy"
                  className="w-full"
                />
              </button>
              <div className="flex flex-wrap gap-2">
                <a
                  href={order.design_image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-primary px-4 text-xs font-bold text-primary"
                >
                  فتح الصورة · View
                </a>
                <button
                  type="button"
                  onClick={() =>
                    void downloadDesignImage(order.design_image_url as string, order.order_number)
                  }
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
                >
                  <Download className="h-4 w-4" aria-hidden="true" /> تحميل الصورة · Download
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <button
          type="button"
          onClick={() => printReceipt(order)}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-primary px-5 text-sm font-bold text-primary"
        >
          <Printer className="h-4 w-4" aria-hidden="true" /> طباعة إيصال حراري
        </button>
      </div>
    </div>
  );
}
