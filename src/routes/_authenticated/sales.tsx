import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useServerFn } from "@tanstack/react-start";
import {
  BadgeDollarSign,
  Bike,
  CalendarClock,
  Loader2,
  LogOut,
  Printer,
  RefreshCw,
  Search,
  Store,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import {
  getSalesAccess,
  getSalesOrders,
  getShiftReport,
  updateSalesOrder,
  updateSalesOrderItemPrice,
  type OrderPatch,
  type PaymentMethod,
  type SalesOrder,
  type SalesStatus,
  type ShiftReport,
} from "@/lib/sales.functions";
import { getMyPermissions } from "@/lib/permissions.functions";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "واجهة المبيعات | Delish Sales Desk" },
      { name: "description", content: "إدارة طلبات ديليش: البحث، الحالة، التوصيل، الدفعات وإغلاق الشيفت المالي." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "واجهة المبيعات | Delish Sales Desk" },
      { property: "og:description", content: "Sales desk for Delish Cake & Bake orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesPage,
});

const flow: SalesStatus[] = ["new", "baking", "ready", "out_for_delivery", "completed"];

const statusMeta: Record<SalesStatus, { ar: string; en: string; chip: string }> = {
  new: { ar: "قيد الانتظار", en: "Pending", chip: "bg-[#FDE2CF] text-[#7B3F00]" },
  confirmed: { ar: "مؤكد", en: "Confirmed", chip: "bg-[#FDE2CF] text-[#7B3F00]" },
  baking: { ar: "قيد التنفيذ", en: "In production", chip: "bg-[#EFA781] text-white" },
  ready: { ar: "جاهز بالمحل", en: "Ready at store", chip: "bg-[#B8860B] text-white" },
  out_for_delivery: { ar: "خارج للتوصيل", en: "Out for delivery", chip: "bg-[#8B4513] text-white" },
  completed: { ar: "مكتمل", en: "Completed", chip: "bg-[#166534] text-white" },
  delivered: { ar: "تم التسليم", en: "Delivered", chip: "bg-[#166534] text-white" },
  cancelled: { ar: "ملغي", en: "Canceled", chip: "bg-red-600 text-white" },
};

const payMeta: Record<PaymentMethod, { ar: string; en: string }> = {
  cash: { ar: "نقدي", en: "Cash" },
  cliq: { ar: "كليك", en: "CliQ" },
  visa: { ar: "فيزا", en: "Visa" },
};

const jd = (value: number) => `${value.toFixed(2)} د.أ`;
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function printReceipt(order: SalesOrder) {
  const remaining = Math.max(order.total - order.deposit_paid, 0);
  const rows = order.items
    .map(
      (item) =>
        `<tr><td>${item.quantity} × ${item.name_ar}${item.options_ar.length ? `<br><small>${item.options_ar.join(" · ")}</small>` : ""}</td><td style="text-align:left">${(item.unit_price * item.quantity).toFixed(2)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${order.order_number}</title>
<style>@page{size:80mm auto;margin:4mm}body{font-family:system-ui,sans-serif;width:72mm;font-size:12px;color:#000}
h1{font-size:16px;margin:0 0 2px}table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
.line{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}b{font-size:13px}</style></head>
<body><h1>Delish Cake &amp; Bake</h1><div>ديليش – الأردن · 0779179995</div><div class="line"></div>
<div class="row"><span>${order.order_number}</span><span>${order.requested_date} ${order.requested_time.slice(0, 5)}</span></div>
<div>${order.customer_name} · ${order.customer_phone}</div>
<div>${order.method === "delivery" ? `توصيل: ${order.area ?? ""} ${order.address ?? ""}` : "استلام من المحل"}</div>
${order.inscription ? `<div>الكتابة: ${order.inscription}</div>` : ""}
<div class="line"></div><table>${rows}</table><div class="line"></div>
<div class="row"><span>المجموع</span><span>${order.subtotal.toFixed(2)}</span></div>
<div class="row"><span>التوصيل</span><span>${order.delivery_fee.toFixed(2)}</span></div>
<div class="row"><b>الإجمالي</b><b>${order.total.toFixed(2)}</b></div>
<div class="row"><span>العربون المدفوع</span><span>${order.deposit_paid.toFixed(2)}</span></div>
<div class="row"><b>المتبقي</b><b>${remaining.toFixed(2)}</b></div>
<div>طريقة الدفع: ${order.payment_method ? payMeta[order.payment_method].ar : "—"}</div>
<div class="line"></div><div style="text-align:center">شكراً لاختياركم ديليش 🤍</div>
<script>window.onload=function(){window.print();}</script></body></html>`;
  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

const ORDERS_KEY = ["sales-orders"] as const;

/** Mirrors the server update locally so the card repaints in the same frame. */
function applyPatch(order: SalesOrder, input: OrderPatch): SalesOrder {
  const next: SalesOrder = { ...order };
  if (input.status !== undefined) next.status = input.status;
  if (input.cancel_reason !== undefined) next.cancel_reason = input.cancel_reason;
  if (input.method !== undefined) next.method = input.method;
  if (input.delivery_fee !== undefined) next.delivery_fee = input.delivery_fee;
  if (input.driver_name !== undefined) next.driver_name = input.driver_name;
  if (input.driver_phone !== undefined) next.driver_phone = input.driver_phone;
  if (input.deposit_paid !== undefined) next.deposit_paid = input.deposit_paid;
  if (input.payment_method !== undefined) next.payment_method = input.payment_method;
  next.total = next.subtotal + (next.method === "delivery" ? next.delivery_fee : 0);
  return next;
}

function SalesPage() {

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessFn = useServerFn(getSalesAccess);
  const ordersFn = useServerFn(getSalesOrders);
  const updateFn = useServerFn(updateSalesOrder);
  const updatePriceFn = useServerFn(updateSalesOrderItemPrice);
  const reportFn = useServerFn(getShiftReport);
  const permissionsFn = useServerFn(getMyPermissions);

  const [term, setTerm] = useState("");
  const search = useDebouncedValue(term, 180);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<SalesOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftDate, setShiftDate] = useState(todayIso);
  const [report, setReport] = useState<ShiftReport | null>(null);

  const access = useQuery({
    queryKey: ["sales-access"],
    queryFn: () => accessFn({}),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });

  const allowed = access.data?.allowed === true;

  const permissions = useQuery({
    queryKey: ["my-sales-permissions"],
    queryFn: () => permissionsFn({}),
    enabled: allowed,
    staleTime: 30_000,
  });

  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => ordersFn({}),
    enabled: allowed,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  /** Status / payment / fulfilment edits land in the UI immediately, then reconcile. */
  const patch = useMutation({
    mutationFn: (input: OrderPatch) => updateFn({ data: input }),
    onMutate: (input) => {
      const previous = queryClient.getQueryData<SalesOrder[]>(ORDERS_KEY);
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === input.orderId ? applyPatch(order, input) : order)),
      );
      return { previous };
    },
    onError: (_error, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ORDERS_KEY, ctx.previous);
    },
    onSuccess: (row) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === row.id ? row : order)),
      );
    },
  });

  const updateItemPrice = useMutation({
    mutationFn: (input: { itemId: string; orderId: string; newUnitPrice: number }) =>
      updatePriceFn({ data: input }),
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === updatedOrder.id ? updatedOrder : order)),
      );
    },
  });

  useOrdersRealtime(ORDERS_KEY, allowed, "sales-orders-live");

  useEffect(() => {
    if (!cancelFor && !shiftOpen && !selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (cancelFor) setCancelFor(null);
      else if (shiftOpen) setShiftOpen(false);
      else setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelFor, shiftOpen, selectedId]);

  const list = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = orders.data ?? [];
    if (!needle) return rows;
    return rows.filter((order) =>
      [order.customer_name, order.customer_phone, order.order_number, order.id]
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }, [navigate]);


  const runReport = useCallback(async () => {
    setReport(await reportFn({ data: { date: shiftDate } }));
  }, [reportFn, shiftDate]);

  useEffect(() => {
    if (shiftOpen) void runReport();
  }, [shiftOpen, runReport]);

  if (access.isPending) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="جار التحميل" />
      </main>
    );
  }

  if (!access.data?.allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-background px-4 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="font-display text-2xl font-bold text-foreground">لا تملك صلاحية المبيعات</h1>
          <p className="text-sm text-muted-foreground">This account has no sales access. Ask an admin to grant the sales role.</p>
          <button type="button" onClick={signOut} className="min-h-12 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-dvh bg-background pb-16">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="me-auto">
            <h1 className="font-display text-xl font-bold text-foreground">
              واجهة المبيعات <span className="delish-wordmark">Delish</span>
            </h1>
            <p className="text-xs text-muted-foreground">Sales Desk · إدارة الطلبات والدفعات</p>
          </div>
          <button
            type="button"
            onClick={() => setShiftOpen(true)}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            <BadgeDollarSign className="h-4 w-4" aria-hidden="true" /> إغلاق الشيفت المالي
          </button>
          <button
            type="button"
            onClick={() => void orders.refetch()}
            aria-label="تحديث الطلبات"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${orders.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={signOut}
            aria-label="تسجيل الخروج"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3">
          <label className="relative block">
            <span className="sr-only">بحث بالاسم أو الهاتف أو رقم الطلب</span>
            <Search className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="ابحث بالاسم، الهاتف، أو رقم الطلب…"
              className="min-h-12 w-full rounded-full border border-input bg-background pe-11 ps-4 text-sm"
            />
          </label>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        {orders.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جار تحميل الطلبات…</p>
        ) : list.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">لا توجد طلبات مطابقة</p>
        ) : (
          <ul className="grid gap-3">
            {list.map((order) => (
              <OrderCard key={order.id} order={order} onOpen={openOrder} />
            ))}
          </ul>

        )}
      </div>

      {selected ? (
        <OrderPanel
          order={selected}
          permissions={permissions.data ?? { permittedProductIds: [], isAdmin: false }}
          onUpdateItemPrice={(itemId, newUnitPrice) =>
            updateItemPrice.mutate({ itemId, orderId: selected.id, newUnitPrice })
          }
          onClose={() => setSelectedId(null)}
          onPatch={(input) => patch.mutate({ ...input, orderId: selected.id })}
          onCancel={() => {
            setCancelReason("");
            setCancelFor(selected);
          }}
        />
      ) : null}

      {cancelFor ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/50 p-4" role="dialog" aria-modal="true" aria-label="إلغاء الطلب">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5">
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
        <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/50 p-4" role="dialog" aria-modal="true" aria-label="إغلاق الشيفت المالي">
          <div className="w-full max-w-md rounded-2xl bg-card p-5">
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
                  onClick={() => window.print()}
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
    </main>
  );
}

/** Only repaints when its own order object changes. */
const OrderCard = memo(function OrderCard({
  order,
  onOpen,
}: {
  order: SalesOrder;
  onOpen: (id: string) => void;
}) {
  const remaining = Math.max(order.total - order.deposit_paid, 0);
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta[order.status].chip}`}>
          {statusMeta[order.status].ar}
        </span>
        <span className="font-display text-base font-bold text-foreground">{order.order_number}</span>
        <span className="text-sm text-foreground">{order.customer_name}</span>
        <span dir="ltr" className="text-sm text-muted-foreground">{order.customer_phone}</span>
        <span className="ms-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          {order.requested_date} · {order.requested_time.slice(0, 5)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 font-bold text-secondary-foreground">
          {order.method === "delivery" ? <Bike className="h-3.5 w-3.5" aria-hidden="true" /> : <Store className="h-3.5 w-3.5" aria-hidden="true" />}
          {order.method === "delivery" ? "توصيل" : "استلام من المحل"}
        </span>
        <span className="text-muted-foreground">الإجمالي {jd(order.total)}</span>
        <span className="text-muted-foreground">مدفوع {jd(order.deposit_paid)}</span>
        <span className={remaining > 0 ? "font-bold text-destructive" : "font-bold text-foreground"}>
          المتبقي {jd(remaining)}
        </span>
        {order.payment_method ? <span className="text-muted-foreground">{payMeta[order.payment_method].ar}</span> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpen(order.id)}
          className="min-h-12 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          إدارة الطلب
        </button>
        <button
          type="button"
          onClick={() => printReceipt(order)}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-primary px-5 text-sm font-bold text-primary"
        >
          <Printer className="h-4 w-4" aria-hidden="true" /> طباعة حرارية
        </button>
      </div>
    </li>
  );
});

function OrderPanel({
  order,
  permissions,
  onUpdateItemPrice,
  onClose,
  onPatch,
  onCancel,
}: {
  order: SalesOrder;
  permissions?: { permittedProductIds: string[]; isAdmin: boolean };
  onUpdateItemPrice?: (itemId: string, newUnitPrice: number) => void;
  onClose: () => void;
  onPatch: (input: Omit<OrderPatch, "orderId">) => void;
  onCancel: () => void;
}) {
  const [fee, setFee] = useState(String(order.delivery_fee));
  const [deposit, setDeposit] = useState(String(order.deposit_paid));
  const [driverName, setDriverName] = useState(order.driver_name ?? "");
  const [driverPhone, setDriverPhone] = useState(order.driver_phone ?? "");

  // Reset the local fields only when a different order opens, never while typing.
  useEffect(() => {
    setFee(String(order.delivery_fee));
    setDeposit(String(order.deposit_paid));
    setDriverName(order.driver_name ?? "");
    setDriverPhone(order.driver_phone ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);


  const liveTotal = order.subtotal + (order.method === "delivery" ? Number(fee) || 0 : 0);
  const remaining = Math.max(liveTotal - (Number(deposit) || 0), 0);
  const stageIndex = flow.indexOf(order.status);
  const next = stageIndex >= 0 && stageIndex < flow.length - 1 ? flow[stageIndex + 1] : null;

  return (
    <div className="fixed inset-0 z-30 flex justify-start bg-foreground/50" role="dialog" aria-modal="true" aria-label={`إدارة الطلب ${order.order_number}`}>
      <div className="ms-auto h-full w-full max-w-md overflow-y-auto bg-card p-5">
        <div className="flex items-center gap-2">
          <h2 className="me-auto font-display text-lg font-bold text-foreground">{order.order_number}</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-12 w-12 place-items-center rounded-full border border-border">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-1 text-sm text-foreground">{order.customer_name}</p>
        <p dir="ltr" className="text-sm text-muted-foreground">{order.customer_phone}</p>

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
          <div className="mt-2 flex gap-2">
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
                أجرة التوصيل · Delivery fee
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={fee}
                  onChange={(event) => setFee(event.target.value)}
                  onBlur={() => onPatch({ delivery_fee: Number(fee) || 0 })}
                  className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-bold text-foreground">
                اسم السائق · Driver name
                <input
                  value={driverName}
                  onChange={(event) => setDriverName(event.target.value)}
                  onBlur={() => onPatch({ driver_name: driverName.trim() || null })}
                  className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
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
                  className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                العنوان: {order.area ?? "—"} {order.address ?? ""}
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-bold text-foreground">المالية</h3>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between text-foreground"><span>المجموع الفرعي</span><span>{jd(order.subtotal)}</span></div>
            <div className="flex justify-between text-foreground"><span>التوصيل</span><span>{jd(order.method === "delivery" ? Number(fee) || 0 : 0)}</span></div>
            <div className="flex justify-between font-bold text-foreground"><span>الإجمالي</span><span>{jd(liveTotal)}</span></div>
          </div>
          <label className="mt-3 block text-sm font-bold text-foreground">
            العربون المدفوع · Deposit paid
            <input
              type="number"
              min="0"
              step="0.25"
              value={deposit}
              onChange={(event) => setDeposit(event.target.value)}
              onBlur={() => onPatch({ deposit_paid: Number(deposit) || 0 })}
              className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
          </label>
          <p className={`mt-2 text-sm font-bold ${remaining > 0 ? "text-destructive" : "text-foreground"}`}>المتبقي: {jd(remaining)}</p>
          <div className="mt-3 flex gap-2">
            {(["cash", "cliq", "visa"] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onPatch({ payment_method: method })}
                aria-pressed={order.payment_method === method}
                className={`min-h-12 flex-1 rounded-full px-3 text-sm font-bold ${order.payment_method === method ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}
              >
                {payMeta[method].ar}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-bold text-foreground">تفاصيل الطلب</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {order.items.map((item) => {
              const canEditPrice = Boolean(
                permissions?.isAdmin ||
                (item.product_id && permissions?.permittedProductIds?.includes(item.product_id))
              );
              return (
                <li key={item.id} className="rounded-2xl border border-slate-100 bg-[#F9FBFC] p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#3E2723]">{item.quantity} × {item.name_ar}</p>
                      <p className="text-xs text-[#7A6458] font-medium">{item.name_en}</p>
                    </div>
                    {canEditPrice ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow-xs">
                        تعديل السعر ✏️
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        مقيد 🔒
                      </span>
                    )}
                  </div>
                  {item.options_ar.length ? <p className="text-xs text-[#8B4513]">{item.options_ar.join(" · ")}</p> : null}
                  {item.notes ? <p className="text-xs text-[#3E2723]">ملاحظة: {item.notes}</p> : null}

                  {/* Price modifier inline control */}
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs">
                    <span className="text-[#7A6458] font-medium">سعر الوحدة · Unit Price:</span>
                    {canEditPrice && onUpdateItemPrice ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          defaultValue={item.unit_price}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val !== item.unit_price) {
                              onUpdateItemPrice(item.id, val);
                            }
                          }}
                          className="w-20 rounded-lg border border-amber-300 bg-white px-2 py-1 text-center text-xs font-bold text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                        />
                        <span className="font-bold text-[#8B4513]">د.أ</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                        🔒 {jd(item.unit_price)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {order.inscription ? <p className="mt-2 text-sm text-foreground">الكتابة على الكيك: {order.inscription}</p> : null}
          {order.notes ? <p className="mt-2 text-sm text-foreground">ملاحظات العميل: {order.notes}</p> : null}
          {order.staff_notes ? (
            <p className="mt-2 rounded-xl bg-primary/10 p-3 text-sm text-foreground">ملاحظات داخلية: {order.staff_notes}</p>
          ) : null}
          {order.design_image_url ? (
            <img src={order.design_image_url} alt={`صورة التصميم المطلوب للطلب ${order.order_number}`} loading="lazy" className="mt-3 w-full rounded-xl" />
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
