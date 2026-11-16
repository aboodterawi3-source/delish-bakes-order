import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarClock,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { OrdersCalendar } from "@/components/staff/OrdersCalendar";
import { DateFilterBar } from "@/components/staff/DateFilterBar";
import { ImageLightbox } from "@/components/staff/ImageLightbox";
import { OrderRowCard } from "@/components/staff/OrderRowCard";
import { OrderPanelDrawer } from "@/components/staff/OrderPanelDrawer";
import { printShiftReport } from "@/components/staff/orders-actions";
import {
  isoDay,
  matchesDateFilter,
  todayIso,
  type CustomRange,
  type DateFilterKey,
} from "@/lib/date-filter";
import { reorderRanks, setQueueRanks } from "@/lib/queue.functions";
import {
  clearAllSalesOrders,
  deleteSalesOrder,
  getSalesOrders,
  getShiftReport,
  recordOrderPayment,
  updateSalesOrder,
  type OrderPatch,
  type PaymentMethod,
  type SalesOrder,
  type ShiftReport,
} from "@/lib/sales.functions";
import { applyOrderPatch } from "@/lib/sales-helpers";
import { jd } from "@/lib/currency";
import { ADMIN_ANALYTICS_KEY, ORDERS_KEY, payMeta } from "@/lib/staff-orders-shared";

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
  const reorderFn = useServerFn(setQueueRanks);
  const clearAllFn = useServerFn(clearAllSalesOrders);
  const deleteOrderFn = useServerFn(deleteSalesOrder);
  const recordPaymentServer = useServerFn(recordOrderPayment);

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
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [collectingOrderId, setCollectingOrderId] = useState<string | null>(null);
  const quickCollectKeyMap = useRef<Map<string, string>>(new Map());

  const handleWipeAll = async () => {
    setWiping(true);
    try {
      await clearAllFn();
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, []);
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      void queryClient.invalidateQueries({ queryKey: ADMIN_ANALYTICS_KEY });
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
    }
  };

  const realtime = useOrdersRealtime(ORDERS_KEY, true, "orders-workspace-live");

  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => ordersFn({ data: {} }),
    refetchInterval: realtime.isConnected ? false : 30_000,
    staleTime: 10_000,
  });

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
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
    onError: (err: Error) => {
      toast.error(err?.message || "تعذّر تسجيل الحركة المالية");
    },
  });

  const patch = useMutation({
    mutationFn: (input: OrderPatch) => updateFn({ data: input }),
    onMutate: (input) => {
      const previous = queryClient.getQueryData<SalesOrder[]>(ORDERS_KEY);
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) =>
          order.id === input.orderId ? applyOrderPatch(order, input) : order,
        ),
      );
      return { previous };
    },
    onError: (err: Error, _variables, context) => {
      toast.error(err.message || "تعذر تحديث الطلب");
      if (context?.previous) {
        queryClient.setQueryData(ORDERS_KEY, context.previous);
      }
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === updated.id ? updated : order)),
      );
    },
  });

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
  }, [cancelFor, shiftOpen, zoomImage]);

  const rawList = useMemo(() => orders.data ?? [], [orders.data]);

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
        toast.error((error as Error).message || "تعذر تغيير ترتيب الطابور");
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
    try {
      setReport(await reportFn({ data: { date: shiftDate } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر تحميل تقرير الشيفت");
    }
  }, [reportFn, shiftDate]);

  useEffect(() => {
    if (shiftOpen) void runReport();
  }, [shiftOpen, runReport]);

  return (
    <div dir="rtl" className="min-w-0 space-y-4 font-sans select-none">
      <div className="grid gap-3.5 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
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

            <button
              type="button"
              onClick={() => setWipeConfirmOpen(true)}
              title="تنظيف ومسح كافة الطلبات"
              className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl border border-rose-300 bg-rose-50 px-3.5 text-xs font-black text-rose-800 shadow-2xs transition hover:bg-rose-100 hover:opacity-95 active:scale-95 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              <span className="hidden md:inline">تنظيف كافة الطلبات</span>
            </button>

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

        <DateFilterBar value={dateKey} onChange={setDateKey} custom={custom} onCustom={setCustom} />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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
          onPatch={(patchData) => patch.mutateAsync(patchData)}
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

      {selected ? (
        <OrderPanelDrawer
          order={selected}
          onEditOrder={onEditOrder}
          onZoom={setZoomImage}
          onClose={() => setSelectedId(null)}
          onPatch={(input) =>
            patch.mutate({
              ...input,
              orderId: selected.id,
              expected_version: input.expected_version ?? selected.version ?? 1,
            })
          }
          onCancel={() => {
            setCancelReason("");
            setCancelFor(selected);
          }}
          onDeletePermanent={handleDeleteSingle}
        />
      ) : null}

      <ImageLightbox src={zoomImage} onClose={() => setZoomImage(null)} alt="صورة التصميم" />

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
