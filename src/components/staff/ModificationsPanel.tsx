import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Bike,
  Cake,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  History,
  Layers,
  Loader2,
  MessageCircle,
  Pencil,
  Percent,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { orderLabel } from "@/lib/order-label";
import {
  ORDERS_KEY,
  statusMeta,
  payMeta,
  waNumber,
  printReceipt,
} from "@/components/staff/OrdersWorkspace";
import {
  getSalesOrders,
  updateSalesOrder,
  updateSalesOrderItemPrice,
  replaceSalesOrderItems,
  type RebuildLine,
  type OrderItemPatch,
  type OrderPatch,
  type SalesOrder,
  type OrderModification,
  type SalesStatus,
} from "@/lib/sales.functions";
import { applyOrderDiscount, getMyAuthorization } from "@/lib/authorization.functions";
import {
  DELIVERY_ZONES,
  OTHER_GOVERNORATES_AREA,
  feeForArea,
} from "@/lib/delivery-zones";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import type { StorefrontProduct } from "@/lib/storefront-content";
import { WebsiteRebuildPanel } from "@/components/staff/WebsiteRebuildPanel";
import {
  CakeCustomizationPanel,
  customizationSummary,
  emptyCustomization,
  type Customization,
} from "@/components/delish/CakeCustomizationPanel";
import {
  TouchItemEditorSheet,
  TouchItemSummaryCard,
} from "@/components/staff/TouchItemEditorSheet";

const jd = (value: number) => `${value.toFixed(2)} د.أ`;

/** Replaces (or removes) a labelled extra such as «الحشوة: نوتيلا» in the list. */
const withLabel = (list: string[], label: string, value: string) => {
  const rest = list.filter((entry) => !entry.startsWith(`${label}:`));
  return value ? [...rest, `${label}: ${value}`] : rest;
};

const inputClass =
  "min-h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition";
const boxedTextarea =
  "w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition";

/** Displays order modification logs cleanly under order details. */
export function ModificationsHistoryBox({
  modifications,
  lastEditedAt,
}: {
  modifications?: OrderModification[] | null | undefined;
  lastEditedAt?: string | null | undefined;
}) {
  const [open, setOpen] = useState(true);

  if ((!modifications || modifications.length === 0) && !lastEditedAt) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
        <span>ℹ️</span>
        <span>لا توجد تعديلات سابقة مسجلة على هذا الطلب حتى الآن.</span>
      </div>
    );
  }

  const baselineMod = (modifications ?? []).find((m) =>
    m.field.includes("الطلب الأساسي") || m.field.includes("النسخة الأصلية")
  );
  const regularMods = (modifications ?? []).filter(
    (m) => !m.field.includes("الطلب الأساسي") && !m.field.includes("النسخة الأصلية")
  );

  return (
    <div className="rounded-2xl border border-amber-300/80 bg-amber-50/70 p-3.5 text-xs text-amber-950 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-2 font-black text-amber-950 hover:underline cursor-pointer"
        >
          <History className="h-4 w-4 text-amber-700" />
          <span>سجل الطلب التعديلات والتدقيق ({modifications?.length ?? 0} سجلات)</span>
          <span className="text-[10px] text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full font-bold">
            {open ? "إخفاء التفاصيل ▲" : "عرض التفاصيل ▼"}
          </span>
        </button>
        {lastEditedAt && (
          <span className="text-[11px] font-normal text-amber-800" dir="ltr">
            آخر تعديل:{" "}
            {new Date(lastEditedAt).toLocaleTimeString("ar-JO", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {/* ORIGINAL ORDER BASELINE BANNER */}
          {baselineMod && (
            <div className="rounded-xl border border-amber-400 bg-amber-100/90 p-3 text-xs text-amber-950 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between font-black text-amber-900 border-b border-amber-300/80 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <span>📌</span>
                  <span>الطلب الأساسي الأصلي (عند الإنشاء من السوشيل ميديا / النظام):</span>
                </span>
                {baselineMod.updatedAt && (
                  <span className="text-[10px] font-mono text-amber-800 shrink-0" dir="ltr">
                    {new Date(baselineMod.updatedAt).toLocaleTimeString("ar-JO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
              <div className="whitespace-pre-line text-xs font-bold leading-relaxed text-amber-950 bg-white/70 p-2.5 rounded-lg border border-amber-200/90">
                {baselineMod.oldValue}
              </div>
            </div>
          )}

          {/* SUBSEQUENT MODIFICATIONS LIST */}
          {regularMods.length > 0 ? (
            <div className="space-y-2 pt-1">
              <div className="font-black text-xs text-amber-950 flex items-center gap-1">
                <span>📝</span>
                <span>التعديلات والتغييرات التي جرت عليه ({regularMods.length}):</span>
              </div>
              <ul className="space-y-2 divide-y divide-amber-200/60">
                {regularMods.map((mod, idx) => (
                  <li key={idx} className="pt-2 first:pt-0 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-black text-amber-950 text-xs">{mod.field}</span>
                      {mod.updatedAt && (
                        <span className="text-[10px] text-amber-800 shrink-0 font-mono" dir="ltr">
                          {new Date(mod.updatedAt).toLocaleTimeString("ar-JO", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      {mod.oldValue && (
                        <div className="rounded-lg bg-rose-500/10 p-2 text-rose-900 border border-rose-400/30">
                          <span className="font-bold block text-[10px] text-rose-700">❌ القيمة الأصلية:</span>
                          <span className="line-through font-semibold">{mod.oldValue}</span>
                        </div>
                      )}
                      {mod.newValue && (
                        <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-950 font-black border border-emerald-400/30">
                          <span className="font-bold block text-[10px] text-emerald-700">✨ القيمة المعدلة (الجديدة):</span>
                          <span>{mod.newValue}</span>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : !baselineMod ? (
            <p className="text-[11px] text-amber-800">تم حفظ وتأكيد التعديلات على هذا الطلب ✅</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Radical ground-up redesign of ModificationsPanel:
 * A high-efficiency Cake Order Modification Studio with a responsive split pane:
 * - Live Order Selector on the right (with search, category filters, and quick stats).
 * - Full-Featured Interactive Modification Studio on the left with zero feature deletion.
 */
export function ModificationsPanel({
  initialSelectedId = null,
  onCloseEdit,
}: {
  initialSelectedId?: string | null;
  onCloseEdit?: () => void;
}) {
  const queryClient = useQueryClient();
  const ordersFn = useServerFn(getSalesOrders);
  const updateFn = useServerFn(updateSalesOrder);
  const updateItemFn = useServerFn(updateSalesOrderItemPrice);
  const rebuildFn = useServerFn(replaceSalesOrderItems);
  const discountFn = useServerFn(applyOrderDiscount);
  const authorizationFn = useServerFn(getMyAuthorization);

  const [term, setTerm] = useState("");
  const search = useDebouncedValue(term, 180);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [statusFilter, setStatusFilter] = useState<"all" | SalesStatus>("all");

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);

  const orders = useQuery({ queryKey: ORDERS_KEY, queryFn: () => ordersFn({}) });
  const authorization = useQuery({
    queryKey: ["staff-authorization"],
    queryFn: () => authorizationFn({}),
  });
  useOrdersRealtime(ORDERS_KEY, true, "modifications-orders");
  const storefront = useStorefrontContent();

  const rows = orders.data ?? [];

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    let list = rows;

    if (statusFilter !== "all") {
      list = list.filter((order) => order.status === statusFilter);
    }

    const needle = search.trim().toLowerCase();
    if (needle) {
      list = list.filter((order) =>
        [
          order.order_number,
          order.order_name ?? "",
          order.customer_name,
          order.customer_phone,
          order.sender_phone ?? "",
          order.recipient_phone ?? "",
          order.area ?? "",
          order.inscription ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }

    return list.slice(0, 80);
  }, [rows, search, statusFilter]);

  const selected = rows.find((order) => order.id === selectedId) ?? null;

  // Mutations
  const save = useMutation({
    mutationFn: (input: OrderPatch) => updateFn({ data: input }),
    onSuccess: (order) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (current) =>
        (current ?? []).map((row) => (row.id === order.id ? order : row)),
      );
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveItem = useMutation({
    mutationFn: (input: OrderItemPatch) => updateItemFn({ data: input }),
    onSuccess: (order) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (current) =>
        (current ?? []).map((row) => (row.id === order.id ? order : row)),
      );
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      toast.success("تم حفظ تعديل الصنف ✅");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rebuild = useMutation({
    mutationFn: (input: { orderId: string; lines: RebuildLine[] }) => rebuildFn({ data: input }),
    onSuccess: (order) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (current) =>
        (current ?? []).map((row) => (row.id === order.id ? order : row)),
      );
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      toast.success("تم استبدال أصناف الطلب ✅ — تم إشعار المطبخ");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const discount = useMutation({
    mutationFn: (input: { orderId: string; percent: number; reason: string }) =>
      discountFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      toast.success("تم تطبيق الخصم الإداري بنجاح ✅");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleFinishEdit = async (patchPayload: Omit<OrderPatch, "orderId">) => {
    if (!selectedId) return;
    try {
      await save.mutateAsync({ orderId: selectedId, ...patchPayload });
      toast.success("تم حفظ كافة التعديلات على الطلب بنجاح ✅");
      if (onCloseEdit) {
        setSelectedId(null);
        onCloseEdit();
      }
    } catch (err) {
      toast.error((err as Error).message || "حدث خطأ أثناء حفظ التعديل");
    }
  };

  if (orders.isPending) {
    return (
      <div className="grid place-items-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-primary" aria-label="جار التحميل" />
          <span className="text-sm font-bold text-muted-foreground">
            جار تحميل استوديو تعديل الطلبات...
          </span>
        </div>
      </div>
    );
  }

  // Quick stats
  const pendingCount = rows.filter((o) => o.status === "new" || o.status === "confirmed").length;
  const inPrepCount = rows.filter((o) => o.status === "baking").length;
  const readyCount = rows.filter((o) => o.status === "ready").length;

  return (
    <div className="min-w-0 space-y-4" dir="rtl">
      {/* Studio Master Header Bar */}
      <div className="rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card/95 to-secondary/30 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Pencil className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg sm:text-xl font-black text-foreground">
                  استوديو تعديل وتخصيص الطلبات
                </h1>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  Order Studio 2.0
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                تحكم كامل وفوري ببيانات الطلب، الحشوات، أرقام الشموع، البالونات، أوقات التسليم، الحسابات والخصومات.
              </p>
            </div>
          </div>

          {/* Quick Counter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>قيد الانتظار: {pendingCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-900">
              <Cake className="h-3.5 w-3.5 text-purple-600" />
              <span>في المطبخ: {inPrepCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>جاهز للتسليم: {readyCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Right Selector + Left Studio Workspace */}
      <div className="grid gap-4 lg:grid-cols-12 min-w-0 items-start">
        {/* RIGHT COLUMN: Order Navigator (4 cols on lg) */}
        <aside
          className={`space-y-3 lg:col-span-4 min-w-0 ${
            selected ? "hidden lg:block" : "block"
          }`}
        >
          <div className="rounded-3xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-sm space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="بحث: رقم الطلب · اسم العميل · هاتف · منطقة"
                className="w-full rounded-2xl border border-input bg-background ps-10 pe-9 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
              {term && (
                <button
                  type="button"
                  onClick={() => setTerm("")}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Quick Status Chips */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                الكل ({rows.length})
              </button>
              {(
                [
                  { key: "new", label: "جديد" },
                  { key: "confirmed", label: "مؤكد" },
                  { key: "baking", label: "مطبخ" },
                  { key: "ready", label: "جاهز" },
                  { key: "out_for_delivery", label: "توصيل" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    statusFilter === tab.key
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Counter */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 border-t border-border/50 pt-2">
              <span>النتائج المعروضة: {filteredOrders.length} طلب</span>
              {selectedId && (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-primary hover:underline font-bold"
                >
                  إلغاء التحديد
                </button>
              )}
            </div>

            {/* Orders Navigator List */}
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pe-1">
              {filteredOrders.map((order) => {
                const isSelected = order.id === selectedId;
                const statusInfo = statusMeta[order.status];
                const remaining = Math.max(order.total - order.deposit_paid, 0);

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedId(order.id)}
                    className={`w-full text-start rounded-2xl border p-3.5 transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                        : "border-border/70 bg-card hover:border-primary/40 hover:bg-secondary/20"
                    }`}
                  >
                    {/* Active Accent Strip */}
                    {isSelected && (
                      <div className="absolute top-0 bottom-0 start-0 w-1.5 bg-primary" />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-black text-foreground">
                            {orderLabel(order.order_number, order.staff_code)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${statusInfo.chip}`}
                          >
                            {statusInfo.ar}
                          </span>
                        </div>
                        <p className="mt-1 font-bold text-xs text-foreground truncate">
                          {order.order_name?.trim() || order.customer_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground" dir="ltr">
                          {order.customer_phone}
                        </p>
                      </div>

                      {/* Right Total & Balance */}
                      <div className="text-end shrink-0">
                        <div className="text-xs font-black text-foreground">
                          {jd(order.total)}
                        </div>
                        {remaining > 0 ? (
                          <div className="text-[10px] font-bold text-rose-600">
                            متبقي: {jd(remaining)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-emerald-600">
                            مدفوع بالكامل ✅
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Logistics Badge */}
                    <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{order.requested_date}</span>
                        <Clock className="h-3 w-3 ms-1" />
                        <span>{order.requested_time.slice(0, 5)}</span>
                      </span>

                      <span className="flex items-center gap-1 font-medium">
                        {order.method === "delivery" ? (
                          <>
                            <Bike className="h-3 w-3 text-orange-600" />
                            <span>توصيل ({order.area || "عمان"})</span>
                          </>
                        ) : (
                          <>
                            <Store className="h-3 w-3 text-blue-600" />
                            <span>استلام محلي</span>
                          </>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredOrders.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                  <Cake className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="font-bold">لا توجد طلبات مطابقة لمعايير البحث</p>
                  <p className="mt-1 text-[11px]">جرب البحث باسم أو رقم آخر أو أعد تعيين الفلتر</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* LEFT COLUMN: Master Interactive Modification Studio (8 cols on lg) */}
        <main className={`lg:col-span-8 min-w-0 ${selected ? "block" : "hidden lg:block"}`}>
          {selected ? (
            <MasterOrderEditor
              key={selected.id}
              order={selected}
              busy={save.isPending || saveItem.isPending || rebuild.isPending}
              mayDiscount={Boolean(authorization.data?.allow_custom_discount)}
              discountCap={authorization.data?.max_discount_percent ?? 0}
              products={storefront.data?.products ?? []}
              onBackToList={() => setSelectedId(null)}
              onPatch={(patch) => save.mutate({ orderId: selected.id, ...patch })}
              onItemPatch={(patch) => saveItem.mutate({ orderId: selected.id, ...patch })}
              onReplaceItems={(lines) => rebuild.mutate({ orderId: selected.id, lines })}
              onDiscount={(percent, reason) =>
                discount.mutate({ orderId: selected.id, percent, reason })
              }
              onFinishEdit={handleFinishEdit}
            />
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-12 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary/10 text-primary mb-4">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">
                اختر طلباً من القائمة الجانبية لبدء التعديل
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground leading-relaxed">
                يمكنك البحث بأي رقم طلب، اسم عميل، أو رقم هاتف على اليمين لفتح استوديو التعديل
                الشامل، وتعديل الحشوات، أرقام الشموع، البالونات، التسليم والمالية.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * The Master Interactive Editor Studio for a single selected order:
 * Preserves 100% of all functions, fields, and options with a fresh, flexible, modern design.
 */
function MasterOrderEditor({
  order,
  busy,
  mayDiscount,
  discountCap,
  products,
  onBackToList,
  onPatch,
  onItemPatch,
  onReplaceItems,
  onDiscount,
  onFinishEdit,
}: {
  order: SalesOrder;
  busy: boolean;
  products: StorefrontProduct[];
  mayDiscount: boolean;
  discountCap: number;
  onBackToList: () => void;
  onPatch: (patch: Omit<OrderPatch, "orderId">) => void;
  onItemPatch: (patch: Omit<OrderItemPatch, "orderId">) => void;
  onReplaceItems: (lines: RebuildLine[]) => void;
  onDiscount: (percent: number, reason: string) => void;
  onFinishEdit: (patch: Omit<OrderPatch, "orderId">) => Promise<void> | void;
}) {
  const [itemsMode, setItemsMode] = useState<"cards" | "builder">("cards");
  const [activeSheetItem, setActiveSheetItem] = useState<
    SalesOrder["items"][number] | null | undefined
  >(undefined);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Form State
  const [orderName, setOrderName] = useState(order.order_name ?? "");
  const [customerName, setCustomerName] = useState(order.customer_name);
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone);
  const [isGift, setIsGift] = useState(Boolean(order.sender_phone || order.recipient_phone));
  const [senderPhone, setSenderPhone] = useState(order.sender_phone ?? "");
  const [recipientPhone, setRecipientPhone] = useState(order.recipient_phone ?? "");
  const [date, setDate] = useState(order.requested_date);
  const [time, setTime] = useState(order.requested_time.slice(0, 5));
  const [address, setAddress] = useState(order.address ?? "");
  const [inscription, setInscription] = useState(order.inscription ?? "");
  const [cardNote, setCardNote] = useState(order.card_note ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [staffNotes, setStaffNotes] = useState(order.staff_notes ?? "");
  const [deposit, setDeposit] = useState(String(order.deposit_paid));
  const [discountPercent, setDiscountPercent] = useState(
    String(order.discount_percent || ""),
  );
  const [discountReason, setDiscountReason] = useState("");

  useEffect(() => {
    setDeposit(String(order.deposit_paid));
  }, [order.deposit_paid]);

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      await onFinishEdit({
        order_name: orderName.trim() || null,
        customer_name: customerName.trim() || order.customer_name,
        customer_phone: customerPhone.trim() || order.customer_phone,
        sender_phone: senderPhone.trim() || null,
        recipient_phone: recipientPhone.trim() || null,
        requested_date: date,
        requested_time: time,
        address: address.trim() || null,
        inscription: inscription.trim() || null,
        card_note: cardNote.trim() || null,
        notes: notes.trim() || null,
        staff_notes: staffNotes.trim() || null,
        deposit_paid: Number(deposit) || 0,
      });
    } finally {
      setIsFinishing(false);
    }
  };

  const remaining = Math.max(order.total - (Number(deposit) || 0), 0);
  const statusInfo = statusMeta[order.status];

  // Helper date presets
  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    setDate(iso);
    onPatch({ requested_date: iso });
  };

  // Helper quick phrases for cake inscription
  const quickInscriptions = [
    "Happy Birthday",
    "مبروك التخرج 🎓",
    "كل عام وأنت بخير 🤍",
    "ألف مبروك الزواج 💍",
    "حمدالله ع السلامة 🌸",
    "Welcome Baby 👶",
  ];

  return (
    <div className="space-y-4 pb-20">
      {/* Top Sticky Command Header */}
      <div className="sticky top-2 z-20 rounded-3xl border border-primary/30 bg-card/95 backdrop-blur-md p-3.5 sm:p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToList}
              className="lg:hidden grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground hover:bg-secondary/80"
              title="الرجوع للقائمة"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base sm:text-lg font-black text-foreground">
                  {orderLabel(order.order_number, order.staff_code)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${statusInfo.chip}`}
                >
                  {statusInfo.ar}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {order.order_name?.trim() || order.customer_name} · {order.customer_phone}
              </span>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Print Receipt */}
            <button
              type="button"
              onClick={() => printReceipt(order)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground hover:bg-secondary transition cursor-pointer"
              title="طباعة إيصال حراري"
            >
              <Printer className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">إيصال حراري</span>
            </button>

            {/* WhatsApp Contact */}
            <a
              href={`https://wa.me/${waNumber(order.customer_phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
              title="محادثة واتساب"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">واتساب</span>
            </a>

            {/* Master Save Button */}
            <button
              type="button"
              onClick={handleFinish}
              disabled={busy || isFinishing}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 sm:px-5 text-xs sm:text-sm font-extrabold text-white shadow-md hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition cursor-pointer"
            >
              {busy || isFinishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>حفظ وتأكيد التعديلات ✅</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: Customer Identity & Gifting */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <h3 className="font-display text-sm font-bold text-foreground">
              هوية العميل والمستلم · Customer Identity
            </h3>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isGift}
              onChange={(e) => setIsGift(e.target.checked)}
              className="h-4 w-4 rounded text-primary focus:ring-primary/20"
            />
            <Gift className="h-3.5 w-3.5 text-primary" />
            <span>طلب هدية / مستلم مختلف</span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-bold text-foreground">
            اسم الطلب · Order Label
            <input
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              onBlur={() => onPatch({ order_name: orderName.trim() || null })}
              placeholder="مثال: كيكة عيد ميلاد سارة"
              className={inputClass}
            />
          </label>

          <label className="block text-xs font-bold text-foreground">
            اسم العميل · Customer Name
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onBlur={() => customerName.trim() && onPatch({ customer_name: customerName.trim() })}
              placeholder="الاسم الكامل"
              className={inputClass}
            />
          </label>

          <label className="block text-xs font-bold text-foreground">
            هاتف العميل الأساسي · Phone
            <input
              dir="ltr"
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              onBlur={() =>
                customerPhone.trim() && onPatch({ customer_phone: customerPhone.trim() })
              }
              placeholder="07XXXXXXXX"
              className={inputClass}
            />
          </label>
        </div>

        {/* Gift / Alternate Recipient Fields */}
        {isGift && (
          <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 animate-fadeIn">
            <label className="block text-xs font-bold text-foreground">
              رقم هاتف المرسل · Sender Phone
              <input
                dir="ltr"
                inputMode="tel"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                onBlur={() => onPatch({ sender_phone: senderPhone.trim() || null })}
                placeholder="07XXXXXXXX"
                className={inputClass}
              />
            </label>

            <label className="block text-xs font-bold text-foreground">
              رقم هاتف المستلم (المفاجأة) · Recipient Phone
              <input
                dir="ltr"
                inputMode="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                onBlur={() => onPatch({ recipient_phone: recipientPhone.trim() || null })}
                placeholder="07XXXXXXXX"
                className={inputClass}
              />
            </label>
          </div>
        )}
      </div>

      {/* SECTION 2: Fulfillment & Logistics */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-orange-100 text-orange-700">
            <Truck className="h-4 w-4" />
          </div>
          <h3 className="font-display text-sm font-bold text-foreground">
            التوقيت وطريقة التسليم اللوجستية · Logistics &amp; Schedule
          </h3>
        </div>

        {/* Method Toggle: Pickup vs Delivery */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPatch({ method: "pickup", delivery_fee: 0 })}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-xs sm:text-sm font-bold transition cursor-pointer ${
              order.method === "pickup"
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-foreground hover:bg-secondary"
            }`}
          >
            <Store className="h-4 w-4" />
            <span>🏪 استلام من المحل (مجاني)</span>
          </button>

          <button
            type="button"
            onClick={() => onPatch({ method: "delivery" })}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-xs sm:text-sm font-bold transition cursor-pointer ${
              order.method === "delivery"
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-foreground hover:bg-secondary"
            }`}
          >
            <Bike className="h-4 w-4" />
            <span>🛵 توصيل منازل</span>
          </button>
        </div>

        {/* Date and Time Pickers with Quick Presets */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">تاريخ التسليم المطلوب · Date</label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="rounded-lg bg-secondary px-2 py-0.5 hover:bg-secondary/80 font-bold"
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="rounded-lg bg-secondary px-2 py-0.5 hover:bg-secondary/80 font-bold"
                >
                  غداً
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(2)}
                  className="rounded-lg bg-secondary px-2 py-0.5 hover:bg-secondary/80 font-bold"
                >
                  بعد يومين
                </button>
              </div>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onBlur={() => date && onPatch({ requested_date: date })}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">وقت التسليم المحدد · Time</label>
              <div className="flex items-center gap-1 text-[11px]">
                {["12:00", "15:00", "18:00", "20:00"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTime(t);
                      onPatch({ requested_time: t });
                    }}
                    className="rounded-lg bg-secondary px-2 py-0.5 hover:bg-secondary/80 font-bold"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onBlur={() => time && onPatch({ requested_time: time })}
              className={inputClass}
            />
          </div>
        </div>

        {/* Delivery Area & Address */}
        {order.method === "delivery" && (
          <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-orange-200 bg-orange-50/40 p-3.5 animate-fadeIn">
            <label className="block text-xs font-bold text-foreground">
              منطقة التوصيل وأجرتها · Delivery Zone
              <select
                value={order.area ?? ""}
                onChange={(e) => {
                  const area = e.target.value;
                  onPatch(area ? { area } : { area: null, delivery_fee: 0 });
                }}
                className={inputClass}
              >
                <option value="">— اختر منطقة التوصيل —</option>
                {DELIVERY_ZONES.map((zone) => (
                  <optgroup key={zone.labelAr} label={zone.labelAr}>
                    {zone.areas.map((area) => (
                      <option key={area} value={area}>
                        {area === OTHER_GOVERNORATES_AREA ? `${area} (٥–٨ د.أ)` : area}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="mt-1 block text-[11px] font-bold text-orange-900">
                أجرة التوصيل المحسوبة: {jd(feeForArea(order.area ?? "") ?? order.delivery_fee)}
              </span>
            </label>

            <label className="block text-xs font-bold text-foreground">
              العنوان بالتفصيل · Delivery Address
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => onPatch({ address: address.trim() || null })}
                placeholder="الشارع، البناية، رقم الطابق، معالم قريبة"
                className={inputClass}
              />
            </label>
          </div>
        )}
      </div>

      {/* SECTION 3: Cake Inscription & Notes */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="font-display text-sm font-bold text-foreground">
            الكتابة على الكيك والكرت وملاحظات المطبخ · Writing &amp; Notes
          </h3>
        </div>

        {/* Cake Inscription with Gold Ribbon */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-foreground">
            الكتابة على الكيك (بالكريمة أو الأكريليك) · Cake Writing
            <input
              value={inscription}
              onChange={(e) => setInscription(e.target.value)}
              onBlur={() => onPatch({ inscription: inscription.trim() || null })}
              placeholder="مثال: Happy Birthday Sarah 🎂"
              className={inputClass}
            />
          </label>

          {/* Quick Phrase Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {quickInscriptions.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => {
                  setInscription(phrase);
                  onPatch({ inscription: phrase });
                }}
                className="rounded-full border border-amber-300 bg-amber-50/80 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition cursor-pointer"
              >
                + {phrase}
              </button>
            ))}
          </div>

          {/* Golden Ribbon Preview */}
          {inscription && (
            <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-amber-100/50 to-amber-50 p-3 text-center shadow-xs">
              <span className="text-[10px] font-bold text-amber-700 block uppercase tracking-wider mb-1">
                معاينة النص على سطح الكيك
              </span>
              <p className="font-display text-base font-black text-amber-950">
                ✨ « {inscription} » ✨
              </p>
            </div>
          )}
        </div>

        {/* Card Note, Customer Notes, Staff Notes */}
        <div className="grid gap-3 sm:grid-cols-3 pt-2">
          <label className="block text-xs font-bold text-foreground">
            الكتابة على الكرت · Card Note
            <textarea
              rows={3}
              value={cardNote}
              onChange={(e) => setCardNote(e.target.value)}
              onBlur={() => onPatch({ card_note: cardNote.trim() || null })}
              placeholder="نص بطاقة المعايدة المرفقة بالهدية..."
              className={boxedTextarea}
            />
          </label>

          <label className="block text-xs font-bold text-foreground">
            ملاحظات خاصة من العميل · Customer Notes
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => onPatch({ notes: notes.trim() || null })}
              placeholder="حساسية طعام، تقليل سكر، تفاصيل تسليم..."
              className={boxedTextarea}
            />
          </label>

          <label className="block text-xs font-bold text-amber-950">
            ملاحظات داخلية سرية للمطبخ · Secret Staff Notes
            <textarea
              rows={3}
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              onBlur={() => onPatch({ staff_notes: staffNotes.trim() || null })}
              placeholder="ملاحظات الموظفين (لا تطبع للعميل)..."
              className={`${boxedTextarea} bg-amber-50/50 border-amber-300`}
            />
          </label>
        </div>
      </div>

      {/* SECTION 4: Line Items & Add-ons Studio */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-100 text-purple-700">
              <Cake className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">
                الأصناف والحشوات والإضافات · Items &amp; Extras
              </h3>
              <span className="text-[11px] text-muted-foreground">
                تحكم بكافة الأصناف، الكميات، الأسعار، والنكهات والإكسسوارات
              </span>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex rounded-xl bg-secondary p-1">
            <button
              type="button"
              onClick={() => setItemsMode("cards")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                itemsMode === "cards"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              بطاقات الأصناف 📱
            </button>
            <button
              type="button"
              onClick={() => setItemsMode("builder")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                itemsMode === "builder"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              كتالوج الموقع 🌐
            </button>
          </div>
        </div>

        {itemsMode === "builder" ? (
          <WebsiteRebuildPanel
            key={order.id}
            order={order}
            products={products}
            busy={busy}
            onReplace={onReplaceItems}
          />
        ) : (
          <div className="space-y-4">
            {/* Interactive Items Cards List */}
            <div className="grid gap-3.5">
              {order.items.map((item) => (
                <InteractiveItemEditorCard
                  key={item.id}
                  item={item}
                  products={products}
                  onItemPatch={onItemPatch}
                  onOpenSheet={() => {
                    setActiveSheetItem(item);
                    setIsSheetOpen(true);
                  }}
                  onDelete={() => {
                    if (order.items.length <= 1) {
                      toast.error("لا يمكن حذف آخر صنف، يجب أن يحتوي الطلب على صنف واحد على الأقل");
                      return;
                    }
                    const remainingLines: RebuildLine[] = order.items
                      .filter((it) => it.id !== item.id)
                      .map((it) => ({
                        productId: it.product_id ?? null,
                        name: it.name_ar,
                        quantity: it.quantity,
                        unitPrice: it.unit_price,
                        options: it.options_ar,
                        notes: it.notes ?? null,
                      }));
                    onReplaceItems(remainingLines);
                  }}
                />
              ))}
            </div>

            {/* Add New Item Button */}
            <button
              type="button"
              onClick={() => {
                setActiveSheetItem(null);
                setIsSheetOpen(true);
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-primary/5 px-4 text-sm font-extrabold text-primary hover:bg-primary/10 transition cursor-pointer"
            >
              <Plus className="h-5 w-5" />
              <span>+ إضافة صنف أو كيكة جديدة للطلب · Add Item</span>
            </button>
          </div>
        )}

        {/* Touch Item Drawer Sheet */}
        <TouchItemEditorSheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          item={activeSheetItem}
          products={products}
          onSave={(payload) => {
            if (activeSheetItem) {
              onItemPatch({
                itemId: activeSheetItem.id,
                name: payload.name,
                quantity: payload.quantity,
                newUnitPrice: payload.unitPrice,
                options: payload.options,
                notes: payload.notes ?? null,
              });
            } else {
              const nextLines: RebuildLine[] = [
                ...order.items.map((it) => ({
                  productId: it.product_id ?? null,
                  name: it.name_ar,
                  quantity: it.quantity,
                  unitPrice: it.unit_price,
                  options: it.options_ar,
                  notes: it.notes ?? null,
                })),
                {
                  productId: payload.productId ?? null,
                  name: payload.name,
                  quantity: payload.quantity,
                  unitPrice: payload.unitPrice,
                  options: payload.options,
                  notes: payload.notes ?? null,
                },
              ];
              onReplaceItems(nextLines);
            }
          }}
        />
      </div>

      {/* SECTION 5: Financials, Discount & Payments */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
            <BadgeDollarSign className="h-4 w-4" />
          </div>
          <h3 className="font-display text-sm font-bold text-foreground">
            الحسابات والخصومات والمدفوعات · Financials &amp; Payments
          </h3>
        </div>

        {/* Financial Summary Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Breakdown Card */}
          <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>المجموع الفرعي للأصناف</span>
              <span className="font-bold text-foreground">{jd(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>أجرة التوصيل</span>
              <span className="font-bold text-foreground">
                {jd(order.method === "delivery" ? order.delivery_fee : 0)}
              </span>
            </div>

            {order.discount_amount > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>الخصم المطبق ({order.discount_percent}%)</span>
                <span>− {jd(order.discount_amount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-border flex justify-between text-base font-black text-foreground">
              <span>الإجمالي الكلي النهائي</span>
              <span>{jd(order.total)}</span>
            </div>

            <div
              className={`flex justify-between font-black text-sm pt-1 ${
                remaining > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              <span>المتبقي للتحصيل</span>
              <span>{jd(remaining)}</span>
            </div>
          </div>

          {/* Payment & Deposit Inputs */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-foreground">
              المبلغ المدفوع كعربون / كاش · Deposit Paid
              <input
                type="number"
                min="0"
                step="0.25"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                onBlur={() => onPatch({ deposit_paid: Number(deposit) || 0 })}
                className={inputClass}
              />
            </label>

            {/* Quick Deposit Buttons */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const val = (Number(deposit) || 0) + 5;
                  setDeposit(String(val));
                  onPatch({ deposit_paid: val });
                }}
                className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold hover:bg-secondary/80"
              >
                + 5 د.أ
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = (Number(deposit) || 0) + 10;
                  setDeposit(String(val));
                  onPatch({ deposit_paid: val });
                }}
                className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold hover:bg-secondary/80"
              >
                + 10 د.أ
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeposit(String(order.total));
                  onPatch({ deposit_paid: order.total });
                }}
                className="rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 text-xs font-bold hover:bg-emerald-200"
              >
                دفع كامل المبلغ ({jd(order.total)})
              </button>
            </div>

            {/* Managerial Discount Box */}
            <div className="rounded-2xl border border-dashed border-border p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Percent className="h-3.5 w-3.5 text-primary" />
                  <span>تطبيق خصم إداري خاص</span>
                </span>
                {mayDiscount ? (
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                    مصرح حتى {discountCap}%
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    يتطلب صلاحية مدير
                  </span>
                )}
              </div>

              {mayDiscount ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    type="number"
                    min="0"
                    max={discountCap}
                    step="1"
                    placeholder="نسبة %"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="h-10 rounded-xl border border-input bg-background px-3 text-xs text-foreground"
                  />
                  <input
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="سبب الخصم..."
                    className="h-10 sm:col-span-2 rounded-xl border border-input bg-background px-3 text-xs text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => onDiscount(Number(discountPercent) || 0, discountReason)}
                    className="sm:col-span-3 min-h-10 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
                  >
                    تطبيق الخصم على الطلب · Apply Discount
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  لا تملك صلاحية تطبيق خصومات مخصصة. يرجى مراجعة إدارة المحل.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-2 z-20 rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 p-4 shadow-2xl text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold opacity-90">
              إجمالي الطلب: {jd(order.total)} · المتبقي: {jd(remaining)}
            </div>
            <p className="text-[11px] opacity-80">
              عند الحفظ، سيتم تحديث شاشات المطبخ والسائق فوراً بالبيانات الجديدة.
            </p>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            disabled={busy || isFinishing}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-black text-emerald-950 shadow-md hover:bg-emerald-50 active:scale-95 disabled:opacity-50 transition cursor-pointer"
          >
            {busy || isFinishing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
            <span>✅ حفظ وتأكيد كافة التعديلات وتنبيه المطبخ</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Single Item Interactive Card:
 * Gives quick access to quantity steppers, price editing, quick extras pills (candles, balloons, toppings),
 * and custom requests without clunky navigation.
 */
function InteractiveItemEditorCard({
  item,
  products,
  onItemPatch,
  onOpenSheet,
  onDelete,
}: {
  item: SalesOrder["items"][number];
  products: StorefrontProduct[];
  onItemPatch: (patch: Omit<OrderItemPatch, "orderId">) => void;
  onOpenSheet: () => void;
  onDelete: () => void;
}) {
  const [options, setOptions] = useState<string[]>(item.options_ar);
  const [draft, setDraft] = useState("");
  const [showWebsiteOptions, setShowWebsiteOptions] = useState(false);
  const [custom, setCustom] = useState<Customization>(emptyCustomization);
  const [productId, setProductId] = useState(item.product_id ?? "");
  const [sizeLabel, setSizeLabel] = useState("");
  const [filling, setFilling] = useState("");

  const product = products.find((row) => row.id === productId) ?? null;
  const fillings = useMemo(() => {
    const set = new Set<string>();
    for (const row of products) if (row.filling_ar?.trim()) set.add(row.filling_ar.trim());
    return [...set].sort();
  }, [products]);

  useEffect(() => {
    setOptions(item.options_ar);
  }, [item.options_ar]);

  const commitOptions = (next: string[]) => {
    setOptions(next);
    onItemPatch({ itemId: item.id, options: next });
  };

  const addOptionPill = (text: string) => {
    if (options.includes(text)) return;
    const next = [...options, text];
    commitOptions(next);
  };

  // Popular quick extra accessories
  const quickAccessories = [
    { label: "🕯️ شموع أرقام", value: "شموع أرقام" },
    { label: "✨ شمعة سحرية", value: "شمعة سحرية مضيئة" },
    { label: "🎈 بالونات هيليوم", value: "بالونات هيليوم" },
    { label: "🎂 توبير أكريليك", value: "توبير أكريليك مخصص" },
    { label: "🍫 حشوة نوتيلا", value: "الحشوة: نوتيلا" },
    { label: "🌾 حشوة لوتس", value: "الحشوة: لوتس" },
    { label: "🥜 حشوة بستاشيو", value: "الحشوة: بستاشيو" },
    { label: "🍓 فراولة وتوت", value: "الحشوة: فراولة وتوت" },
  ];

  return (
    <div className="rounded-2xl border border-border/80 bg-background p-4 shadow-2xs space-y-3">
      {/* Item Title and Price Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <input
            defaultValue={item.name_ar}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && val !== item.name_ar) onItemPatch({ itemId: item.id, name: val });
            }}
            placeholder="اسم الصنف أو الكيكة..."
            className="w-full font-display text-sm font-black text-foreground bg-transparent border-b border-dashed border-border/70 pb-1 outline-none focus:border-primary transition"
          />
        </div>

        {/* Quantity Stepper & Unit Price */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Stepper */}
          <div className="flex items-center rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => {
                if (item.quantity > 1) {
                  onItemPatch({ itemId: item.id, quantity: item.quantity - 1 });
                }
              }}
              disabled={item.quantity <= 1}
              className="grid h-8 w-8 place-items-center text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
            >
              −
            </button>
            <span className="w-8 text-center text-xs font-bold text-foreground">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => {
                onItemPatch({ itemId: item.id, quantity: item.quantity + 1 });
              }}
              className="grid h-8 w-8 place-items-center text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
            >
              +
            </button>
          </div>

          {/* Unit Price */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.25"
              defaultValue={item.unit_price}
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                if (!Number.isNaN(val) && val !== item.unit_price) {
                  onItemPatch({ itemId: item.id, newUnitPrice: val });
                }
              }}
              className="h-8 w-20 rounded-xl border border-input bg-card px-2 text-center text-xs font-bold text-foreground"
            />
            <span className="text-[11px] text-muted-foreground">د.أ</span>
          </div>

          {/* Line Total Badge */}
          <span className="rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
            {jd(item.unit_price * item.quantity)}
          </span>

          {/* Delete Item */}
          <button
            type="button"
            onClick={onDelete}
            title="حذف الصنف"
            className="grid h-8 w-8 place-items-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Item Note */}
      <input
        defaultValue={item.notes ?? ""}
        onBlur={(e) => {
          const val = e.target.value.trim();
          if (val !== (item.notes ?? "")) {
            onItemPatch({ itemId: item.id, notes: val || null });
          }
        }}
        placeholder="ملاحظة خاصة على هذا الصنف (مثل: كتابة خاصة، بدون مكسرات...)"
        className="w-full text-xs text-muted-foreground bg-secondary/30 rounded-xl px-3 py-1.5 border border-transparent focus:border-border outline-none transition"
      />

      {/* Active Options Tag Cloud */}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {options.map((opt, idx) => (
            <span
              key={`${idx}-${opt}`}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-[11px] font-bold text-primary"
            >
              <span>{opt}</span>
              <button
                type="button"
                onClick={() => commitOptions(options.filter((_, i) => i !== idx))}
                className="text-primary/70 hover:text-rose-600 cursor-pointer"
                title="إزالة الإضافة"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Quick Accessories & Fillings Pill Deck */}
      <div className="pt-1 border-t border-border/50">
        <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground mb-1.5">
          <span>إضافات سريعة ونكهات (بنقرة واحدة):</span>
          <button
            type="button"
            onClick={onOpenSheet}
            className="text-primary hover:underline flex items-center gap-1"
          >
            <Pencil className="h-3 w-3" />
            <span>تخصيص متقدم</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickAccessories.map((acc) => (
            <button
              key={acc.value}
              type="button"
              onClick={() => addOptionPill(acc.value)}
              className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-primary hover:text-primary-foreground transition cursor-pointer"
            >
              + {acc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Draft Extra Input */}
      <div className="flex items-center gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="إضافة طلب خاص مخصص لهذا الصنف..."
          className="min-h-9 flex-1 rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-primary"
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              commitOptions([...options, draft.trim()]);
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (!draft.trim()) return;
            commitOptions([...options, draft.trim()]);
            setDraft("");
          }}
          className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Website Catalogue Expander Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowWebsiteOptions((prev) => !prev)}
          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>{showWebsiteOptions ? "▲ إخفاء خيارات كتالوج الموقع" : "▼ خيارات كتالوج الموقع (أحجام، حشوات متقدمة)"}</span>
        </button>

        {showWebsiteOptions && (
          <div className="mt-2 space-y-3 rounded-2xl border border-primary/20 bg-secondary/20 p-3 animate-fadeIn">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-bold text-foreground">
                المنتج من الموقع · Website Product
                <select
                  value={productId}
                  onChange={(event) => {
                    setProductId(event.target.value);
                    setSizeLabel("");
                    const picked = products.find((row) => row.id === event.target.value);
                    if (picked) {
                      onItemPatch({ itemId: item.id, name: picked.name_ar });
                      if (!picked.price_on_request && picked.price > 0) {
                        onItemPatch({ itemId: item.id, newUnitPrice: picked.price });
                      }
                      if (picked.filling_ar?.trim()) setFilling(picked.filling_ar.trim());
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">— اختر منتجاً من الموقع —</option>
                  {products.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name_ar}{" "}
                      {row.price_on_request ? "(السعر عند الطلب)" : `— ${jd(row.price)}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-foreground">
                الحجم · Size
                <select
                  value={sizeLabel}
                  onChange={(event) => {
                    const label = event.target.value;
                    setSizeLabel(label);
                    const size = product?.sizes.find((entry) => entry.label === label);
                    if (!size) return;
                    onItemPatch({ itemId: item.id, newUnitPrice: size.price });
                    commitOptions(withLabel(options, "الحجم", size.label));
                  }}
                  disabled={!product || product.sizes.length === 0}
                  className={inputClass}
                >
                  <option value="">— اختر الحجم —</option>
                  {(product?.sizes ?? []).map((size) => (
                    <option key={size.label} value={size.label}>
                      {size.label} — {jd(size.price)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-foreground sm:col-span-2">
                الحشوة · Filling
                <input
                  list={`fillings-${item.id}`}
                  value={filling}
                  onChange={(event) => setFilling(event.target.value)}
                  onBlur={() => commitOptions(withLabel(options, "الحشوة", filling.trim()))}
                  placeholder="مثال: نوتيلا · لوتس · بستاشيو"
                  className={inputClass}
                />
                <datalist id={`fillings-${item.id}`}>
                  {fillings.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </label>
            </div>

            <div dir="rtl" className="rounded-2xl bg-white p-2 border border-border/50">
              <CakeCustomizationPanel value={custom} onChange={setCustom} />
            </div>

            <button
              type="button"
              onClick={() => {
                const lines = customizationSummary(custom).ar;
                if (lines.length === 0) {
                  toast.error("لم يتم اختيار أي إضافة");
                  return;
                }
                let merged = options;
                for (const line of lines) {
                  const [key, ...rest] = line.split(":");
                  merged = rest.length
                    ? withLabel(merged, key ?? line, rest.join(":").trim())
                    : merged.includes(line)
                      ? merged
                      : [...merged, line];
                }
                commitOptions(merged);
                setCustom(emptyCustomization);
                toast.success("تم تطبيق الخيارات على الصنف ✅");
              }}
              className="min-h-10 w-full rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
            >
              تطبيق خيارات الكستمايزيشن على الصنف ✅
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
