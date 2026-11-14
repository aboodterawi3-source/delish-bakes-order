import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Bike,
  Cake,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardCopy,
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

import {
  buildConfirmationMessage,
  buildModificationMessage,
  formatArabicDate,
  formatArabicTime,
} from "@/lib/confirmation-message";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOrdersRealtime, broadcastKitchenUpdate } from "@/hooks/use-orders-realtime";
import { orderLabel } from "@/lib/order-label";
import { ORDERS_KEY, statusMeta, payMeta, printReceipt } from "@/components/staff/OrdersWorkspace";
import { waNumber } from "@/lib/whatsapp";
import { jd } from "@/lib/currency";
import {
  getSalesOrders,
  updateSalesOrder,
  recordOrderPayment,
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
import { DELIVERY_ZONES, OTHER_GOVERNORATES_AREA, feeForArea } from "@/lib/delivery-zones";
import { uploadPaymentReceipt } from "@/lib/receipt-upload.functions";
import { convertToWebp } from "@/lib/image-webp";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import { extractReceiptImageUrl, attachReceiptImageUrl } from "@/lib/utils";
import { DeliveryZoneSelect } from "@/components/delish/DeliveryZoneSelect";
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

  const baselineMod = (modifications ?? []).find(
    (m) => m.field.includes("الطلب الأساسي") || m.field.includes("النسخة الأصلية"),
  );
  const regularMods = (modifications ?? []).filter(
    (m) => !m.field.includes("الطلب الأساسي") && !m.field.includes("النسخة الأصلية"),
  );

  return (
    <div className="rounded-2xl border border-amber-300/80 bg-amber-50/70 p-3.5 text-xs text-amber-950 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex cursor-pointer items-center gap-2 font-black text-amber-950 hover:underline"
        >
          <History className="h-4 w-4 text-amber-700" />
          <span>سجل الطلب التعديلات والتدقيق ({modifications?.length ?? 0} سجلات)</span>
          <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-800">
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
            <div className="space-y-1.5 rounded-xl border border-amber-400 bg-amber-100/90 p-3 text-xs text-amber-950 shadow-2xs">
              <div className="flex items-center justify-between border-b border-amber-300/80 pb-1.5 font-black text-amber-900">
                <span className="flex items-center gap-1.5">
                  <span>📌</span>
                  <span>الطلب الأساسي الأصلي (عند الإنشاء من السوشيل ميديا / النظام):</span>
                </span>
                {baselineMod.updatedAt && (
                  <span className="shrink-0 font-mono text-[10px] text-amber-800" dir="ltr">
                    {new Date(baselineMod.updatedAt).toLocaleTimeString("ar-JO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-amber-200/90 bg-white/70 p-2.5 text-xs leading-relaxed font-bold whitespace-pre-line text-amber-950">
                {baselineMod.oldValue}
              </div>
            </div>
          )}

          {/* SUBSEQUENT MODIFICATIONS LIST */}
          {regularMods.length > 0 ? (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1 text-xs font-black text-amber-950">
                <span>📝</span>
                <span>التعديلات والتغييرات التي جرت عليه ({regularMods.length}):</span>
              </div>
              <ul className="space-y-2 divide-y divide-amber-200/60">
                {regularMods.map((mod, idx) => (
                  <li key={idx} className="space-y-1 pt-2 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-xs font-black text-amber-950">{mod.field}</span>
                      {mod.updatedAt && (
                        <span className="shrink-0 font-mono text-[10px] text-amber-800" dir="ltr">
                          {new Date(mod.updatedAt).toLocaleTimeString("ar-JO", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2">
                      {mod.oldValue && (
                        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-rose-900">
                          <span className="block text-[10px] font-bold text-rose-700">
                            ❌ القيمة الأصلية:
                          </span>
                          <span className="font-semibold line-through">{mod.oldValue}</span>
                        </div>
                      )}
                      {mod.newValue && (
                        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 font-black text-emerald-950">
                          <span className="block text-[10px] font-bold text-emerald-700">
                            ✨ القيمة المعدلة (الجديدة):
                          </span>
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

  const orders = useQuery({ queryKey: ORDERS_KEY, queryFn: () => ordersFn({ data: {} }) });
  const authorization = useQuery({
    queryKey: ["staff-authorization"],
    queryFn: () => authorizationFn({ data: undefined }),
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
      broadcastKitchenUpdate();
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
      broadcastKitchenUpdate();
      toast.success("تم حفظ تعديل الصنف ✅");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rebuild = useMutation({
    mutationFn: (input: {
      orderId: string;
      lines: RebuildLine[];
      expectedVersion?: number | null;
    }) => rebuildFn({ data: input }),
    onSuccess: (order) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (current) =>
        (current ?? []).map((row) => (row.id === order.id ? order : row)),
      );
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      broadcastKitchenUpdate();
      toast.success("تم استبدال أصناف الطلب ✅ — تم إشعار المطبخ");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const discount = useMutation({
    mutationFn: (input: {
      orderId: string;
      percent: number;
      reason: string;
      expectedVersion?: number | null;
    }) => discountFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      toast.success("تم تطبيق الخصم الإداري بنجاح ✅");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleFinishEdit = async (patchPayload: Omit<OrderPatch, "orderId">) => {
    if (!selectedId) return;
    try {
      const res = await (save.mutateAsync || save.mutate)({
        orderId: selectedId,
        ...patchPayload,
        expected_version:
          patchPayload.expected_version !== undefined && patchPayload.expected_version !== null
            ? patchPayload.expected_version
            : selected?.version,
      });
      toast.success("تم حفظ كافة التعديلات على الطلب بنجاح ✅");
      if (onCloseEdit) {
        setSelectedId(null);
        onCloseEdit();
      }
      return res;
    } catch (err) {
      const msg = (err as Error).message || "";
      if (msg.includes("تعارض") || msg.includes("conflict")) {
        toast.error(
          "⚠️ تنبيه تعارض: قام موظف آخر بتعديل هذا الطلب أثناء تحريرك! تم الاحتفاظ بتعديلاتك الحالية لمراجعتها قبل الحفظ.",
          { duration: 8000 },
        );
      } else {
        toast.error(msg || "حدث خطأ أثناء حفظ التعديل");
      }
      throw err;
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
      <div className="rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card/95 to-secondary/30 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Pencil className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-black text-foreground sm:text-xl">
                  استوديو تعديل وتخصيص الطلبات
                </h1>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  Order Studio 2.0
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                تحكم كامل وفوري ببيانات الطلب، الحشوات، أرقام الشموع، البالونات، أوقات التسليم،
                الحسابات والخصومات.
              </p>
            </div>
          </div>

          {/* Quick Counter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
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
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-12">
        {/* RIGHT COLUMN: Order Navigator (4 cols on lg) */}
        <aside
          className={`min-w-0 space-y-3 lg:col-span-4 ${selected ? "hidden lg:block" : "block"}`}
        >
          <div className="space-y-3 rounded-3xl border border-border/80 bg-card p-3.5 shadow-sm sm:p-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="بحث: رقم الطلب · اسم العميل · هاتف · منطقة"
                className="w-full rounded-2xl border border-input bg-background py-2.5 ps-10 pe-9 text-xs text-foreground transition outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm"
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
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-bold transition ${
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
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-bold transition ${
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
            <div className="flex items-center justify-between border-t border-border/50 px-1 pt-2 text-[11px] text-muted-foreground">
              <span>النتائج المعروضة: {filteredOrders.length} طلب</span>
              {selectedId && (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="font-bold text-primary hover:underline"
                >
                  إلغاء التحديد
                </button>
              )}
            </div>

            {/* Orders Navigator List */}
            <div className="max-h-[calc(100vh-280px)] space-y-2 overflow-y-auto pe-1">
              {filteredOrders.map((order) => {
                const isSelected = order.id === selectedId;
                const statusInfo = statusMeta[order.status];
                const remaining = Math.max(order.total - order.deposit_paid, 0);

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedId(order.id)}
                    className={`relative w-full cursor-pointer overflow-hidden rounded-2xl border p-3.5 text-start transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                        : "border-border/70 bg-card hover:border-primary/40 hover:bg-secondary/20"
                    }`}
                  >
                    {/* Active Accent Strip */}
                    {isSelected && (
                      <div className="absolute start-0 top-0 bottom-0 w-1.5 bg-primary" />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-black text-foreground">
                            {orderLabel(order.order_number, order.staff_code)}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusInfo.chip}`}
                          >
                            {statusInfo.ar}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-bold text-foreground">
                          {order.order_name?.trim() || order.customer_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground" dir="ltr">
                          {order.customer_phone}
                        </p>
                      </div>

                      {/* Right Total & Balance */}
                      <div className="shrink-0 text-end">
                        <div className="text-xs font-black text-foreground">{jd(order.total)}</div>
                        {order.deposit_paid > order.total ? (
                          <div className="rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-black text-purple-600">
                            إرجاع: {jd(order.deposit_paid - order.total)} 🔄
                          </div>
                        ) : remaining > 0 ? (
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
                    <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{order.requested_date}</span>
                        <Clock className="ms-1 h-3 w-3" />
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
                  <Cake className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="font-bold">لا توجد طلبات مطابقة لمعايير البحث</p>
                  <p className="mt-1 text-[11px]">جرب البحث باسم أو رقم آخر أو أعد تعيين الفلتر</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* LEFT COLUMN: Master Interactive Modification Studio (8 cols on lg) */}
        <main className={`min-w-0 lg:col-span-8 ${selected ? "block" : "hidden lg:block"}`}>
          {selected ? (
            <MasterOrderEditor
              key={selected.id}
              order={selected}
              busy={save.isPending || saveItem.isPending || rebuild.isPending}
              mayDiscount={Boolean(authorization.data?.allow_custom_discount)}
              discountCap={authorization.data?.max_discount_percent ?? 0}
              products={storefront.data?.products ?? []}
              onBackToList={() => setSelectedId(null)}
              onPatch={(patch) =>
                (save.mutateAsync || save.mutate)({ orderId: selected.id, ...patch })
              }
              onItemPatch={(patch) =>
                (saveItem.mutateAsync || saveItem.mutate)({ orderId: selected.id, ...patch })
              }
              onReplaceItems={(lines, expectedVersion) =>
                (rebuild.mutateAsync || rebuild.mutate)({
                  orderId: selected.id,
                  lines,
                  expectedVersion:
                    expectedVersion !== undefined && expectedVersion !== null
                      ? expectedVersion
                      : ((lines as any)?.version ??
                        (lines as any)?.[0]?.draftVersion ??
                        selected.version ??
                        null),
                })
              }
              onDiscount={(percent, reason, expectedVersion) =>
                (discount.mutateAsync || discount.mutate)({
                  orderId: selected.id,
                  percent,
                  reason,
                  ...(expectedVersion !== undefined ? { expectedVersion } : {}),
                })
              }
              onFinishEdit={handleFinishEdit}
            />
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-12 text-center">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-primary/10 text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">
                اختر طلباً من القائمة الجانبية لبدء التعديل
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
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
  onPatch: onPatchProp,
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
  onPatch: (patch: Omit<OrderPatch, "orderId">) => void | Promise<any>;
  onItemPatch: (patch: Omit<OrderItemPatch, "orderId">) => void | Promise<any>;
  onReplaceItems: (lines: RebuildLine[], expectedVersion?: number | null) => void | Promise<any>;
  onDiscount: (
    percent: number,
    reason: string,
    expectedVersion?: number | null,
  ) => void | Promise<any>;
  onFinishEdit: (patch: Omit<OrderPatch, "orderId">) => Promise<any> | any;
}) {
  const [itemsMode, setItemsMode] = useState<"cards" | "builder">("cards");
  const [activeSheetItem, setActiveSheetItem] = useState<
    SalesOrder["items"][number] | null | undefined
  >(undefined);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const initialVersionRef = useRef<number>(order.version || 1);
  const pendingSelfMutationRef = useRef(false);
  const currentOrderIdRef = useRef(order.id);

  if (currentOrderIdRef.current !== order.id) {
    currentOrderIdRef.current = order.id;
    initialVersionRef.current = order.version || 1;
    pendingSelfMutationRef.current = false;
  }

  useEffect(() => {
    if (pendingSelfMutationRef.current) {
      pendingSelfMutationRef.current = false;
    }
  }, [order.version]);

  const hasConcurrentConflict =
    !pendingSelfMutationRef.current && (order.version || 1) > initialVersionRef.current;

  const [isProcessingQuickPayment, setIsProcessingQuickPayment] = useState(false);
  const quickPaymentIdempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const recordPaymentServer = useServerFn(recordOrderPayment);
  const uploadReceiptFn = useServerFn(uploadPaymentReceipt);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const receiptUrl = extractReceiptImageUrl(order.staff_notes);

  const handleUploadReceipt = async (file: File | undefined) => {
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const converted = await convertToWebp(file, {
        kind: "cake",
        maxDimension: 800,
        quality: 0.8,
      });
      const saved = await uploadReceiptFn({ data: { data_url: converted.dataUrl } });
      await handlePatch({ staff_notes: attachReceiptImageUrl(order.staff_notes, saved.url) });
      toast.success("تم رفع وإرفاق صورة حوالة كليك بنجاح ✅");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر رفع صورة الحوالة");
    } finally {
      setUploadingReceipt(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  };
  const handleQuickAddPayment = async (
    amount: number,
    type: "deposit" | "remainder" | "full" = "remainder",
  ) => {
    if (amount <= 0 || isProcessingQuickPayment) return;
    setIsProcessingQuickPayment(true);
    pendingSelfMutationRef.current = true;
    try {
      const res = await recordPaymentServer({
        data: {
          orderId: order.id,
          amount,
          paymentMethod: order.payment_method || "cash",
          paymentType: type,
          notes: `دفعة عبر استوديو التعديل (${amount} د.أ)`,
          idempotencyKey: quickPaymentIdempotencyKeyRef.current,
        },
      });
      if (res && typeof (res as any).version === "number") {
        initialVersionRef.current = (res as any).version;
      }
      pendingSelfMutationRef.current = false;
      quickPaymentIdempotencyKeyRef.current = crypto.randomUUID();
      toast.success(`تم تسجيل دفعة بقيمة ${jd(amount)} في سجل الحركات المالية بنجاح ✅`);
    } catch (err: any) {
      pendingSelfMutationRef.current = false;
      toast.error(err?.message || "تعذّر تسجيل الدفعة");
    } finally {
      setIsProcessingQuickPayment(false);
    }
  };

  const handlePatch = (patch: Omit<OrderPatch, "orderId">) => {
    pendingSelfMutationRef.current = true;
    const caller =
      (typeof onPatchProp !== "undefined" && onPatchProp) ||
      (typeof (globalThis as any).onPatchProp !== "undefined" && (globalThis as any).onPatchProp) ||
      (typeof (globalThis as any).onPatch !== "undefined" && (globalThis as any).onPatch);
    const p = caller({ ...patch, expected_version: initialVersionRef.current });
    if (p && typeof (p as any).then === "function") {
      (p as Promise<any>).then(
        (res) => {
          if (res && typeof res === "object" && typeof res.version === "number") {
            initialVersionRef.current = res.version;
          }
          pendingSelfMutationRef.current = false;
        },
        () => {
          pendingSelfMutationRef.current = false;
        },
      );
    }
    return p;
  };
  const onPatch = handlePatch;

  const handleItemPatch = (patch: Omit<OrderItemPatch, "orderId">) => {
    pendingSelfMutationRef.current = true;
    const p = onItemPatch({ ...patch, expectedVersion: initialVersionRef.current });
    if (p && typeof (p as any).then === "function") {
      (p as Promise<any>).then(
        (res) => {
          if (res && typeof res === "object" && typeof res.version === "number") {
            initialVersionRef.current = res.version;
          }
          pendingSelfMutationRef.current = false;
        },
        () => {
          pendingSelfMutationRef.current = false;
        },
      );
    }
  };

  const handleDiscount = (percent: number, reason: string) => {
    pendingSelfMutationRef.current = true;
    const p = onDiscount(percent, reason, initialVersionRef.current);
    if (p && typeof (p as any).then === "function") {
      (p as Promise<any>).then(
        (res) => {
          if (res && typeof res === "object" && typeof res.version === "number") {
            initialVersionRef.current = res.version;
          }
          pendingSelfMutationRef.current = false;
        },
        () => {
          pendingSelfMutationRef.current = false;
        },
      );
    }
  };

  const handleReplaceItems = (lines: RebuildLine[], expectedVersion?: number | null) => {
    pendingSelfMutationRef.current = true;
    const p = onReplaceItems(
      lines,
      expectedVersion !== undefined && expectedVersion !== null
        ? expectedVersion
        : initialVersionRef.current,
    );
    if (p && typeof (p as any).then === "function") {
      (p as Promise<any>).then(
        (res) => {
          if (res && typeof res === "object" && typeof res.version === "number") {
            if (typeof initialVersionRef !== "undefined" && initialVersionRef) {
              initialVersionRef.current = res.version;
            }
          }
          pendingSelfMutationRef.current = false;
        },
        () => {
          pendingSelfMutationRef.current = false;
        },
      );
    }
    return p;
  };

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
  const [discountPercent, setDiscountPercent] = useState(String(order.discount_percent || ""));
  const [discountReason, setDiscountReason] = useState("");

  useEffect(() => {
    setDeposit(String(order.deposit_paid));
  }, [order.deposit_paid]);

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      const res = await onFinishEdit({
        order_name: orderName.trim() || null,
        customer_name: customerName.trim() || order.customer_name,
        customer_phone: customerPhone.trim() || order.customer_phone,
        sender_phone: senderPhone.trim() || null,
        recipient_phone: recipientPhone.trim() || null,
        expected_version: initialVersionRef.current,
        requested_date: date,
        requested_time: time,
        address: address.trim() || null,
        inscription: inscription.trim() || null,
        card_note: cardNote.trim() || null,
        notes: notes.trim() || null,
        staff_notes: staffNotes.trim() || null,
      });
      if (res && typeof res === "object" && typeof (res as any).version === "number") {
        if (typeof initialVersionRef !== "undefined" && initialVersionRef) {
          initialVersionRef.current = (res as any).version;
        }
      }
      return res;
    } finally {
      setIsFinishing(false);
    }
  };

  const remaining = Math.max(order.total - (Number(deposit) || 0), 0);
  const statusInfo = statusMeta[order.status];

  // Helper date presets (updates local date without premature server mutation)
  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    setDate(iso);
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

  const modificationText = useMemo(() => {
    const rawMods = order.modifications ?? [];
    const formattedMods = rawMods.map((m) => {
      const fieldLabels: Record<string, string> = {
        area: "توصيل منطقة",
        address: "العنوان",
        method: "طريقة التسليم",
        total: "المبلغ الإجمالي",
        requested_date: "التاريخ",
        requested_time: "الوقت",
        inscription: "الكتابة على الكيك",
        card_note: "الكرت",
        notes: "ملاحظات",
      };
      const label = fieldLabels[m.field] || m.field;
      return `${label}: ${m.newValue ?? ""}`;
    });

    return buildModificationMessage({
      orderNumber: orderLabel(order.order_number, order.staff_code),
      time: `${formatArabicDate(date)} الساعة ${formatArabicTime(time)}`.trim(),
      fulfilment:
        order.method === "delivery" ? order.area || address || "توصيل" : "استلام من المحل",
      orderDetails:
        order.items.map((i) => `${i.quantity} × ${i.name_ar}`).join(" · ") ||
        order.order_name ||
        "نفس البكج يلي بالصوره",
      designNotes: [
        ...(inscription ? [`الكتابة: ${inscription}`] : []),
        ...(notes ? [notes] : []),
        ...(cardNote ? [`الكرت: ${cardNote}`] : []),
      ],
      modifications:
        formattedMods.length > 0 ? formattedMods : staffNotes ? [staffNotes] : undefined,
    });
  }, [order, date, time, address, inscription, notes, cardNote, staffNotes]);

  const copyModification = () => {
    void navigator.clipboard
      ?.writeText(modificationText)
      .then(() => {
        toast.success("تم نسخ مسج التعديل (🛑🛑🛑تعديل) بنجاح 📋✨");
      })
      .catch(() => {
        toast.error("تعذر النسخ التلقائي — انسخ يدوياً");
      });
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Concurrency Conflict Warning Banner */}
      {hasConcurrentConflict && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-500 bg-amber-50 p-3.5 text-xs font-bold text-amber-900 shadow-md dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              تم تحديث هذا الطلب في الخلفية بواسطة موظف آخر (إصدار الخادم: {order.version}، إصدارك
              الحالي: {initialVersionRef.current}).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                initialVersionRef.current = order.version ?? 1;
                toast.success(
                  "تم تحديث مرجع النسخة مع الحفاظ على مدخلاتك الحالية، يمكنك المتابعة والحفظ الآن ✅",
                );
              }}
              className="cursor-pointer rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-amber-700"
            >
              مزامنة النسخة ومتابعة الحفظ
            </button>
            <button
              type="button"
              onClick={() => {
                initialVersionRef.current = order.version ?? 1;
                setOrderName(order.order_name ?? "");
                setCustomerName(order.customer_name);
                setCustomerPhone(order.customer_phone);
                setDate(order.requested_date);
                setTime(order.requested_time.slice(0, 5));
                setAddress(order.address ?? "");
                setInscription(order.inscription ?? "");
                setCardNote(order.card_note ?? "");
                setNotes(order.notes ?? "");
                setStaffNotes(order.staff_notes ?? "");
                setDeposit(String(order.deposit_paid));
                toast.info("تمت إعادة تحميل بيانات الخادم ومسح المدخلات المحلية");
              }}
              className="cursor-pointer rounded-xl border border-input bg-background/80 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-background"
            >
              استرجاع بيانات الخادم
            </button>
          </div>
        </div>
      )}

      {/* Top Sticky Command Header */}
      <div className="sticky top-2 z-20 rounded-3xl border border-primary/30 bg-card/95 p-3.5 shadow-lg backdrop-blur-md sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToList}
              className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground hover:bg-secondary/80 lg:hidden"
              title="الرجوع للقائمة"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-black text-foreground sm:text-lg">
                  {orderLabel(order.order_number, order.staff_code)}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusInfo.chip}`}
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
            {/* Copy Modification Message Button */}
            <button
              type="button"
              onClick={copyModification}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 text-xs font-black text-rose-800 transition hover:bg-rose-100"
              title="نسخ مسج التعديل (🛑🛑🛑تعديل)"
            >
              <ClipboardCopy className="h-4 w-4 text-rose-600" />
              <span>🛑 نسخ مسج التعديل</span>
            </button>

            {/* Print Receipt */}
            <button
              type="button"
              onClick={() => printReceipt(order)}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-secondary"
              title="طباعة إيصال حراري"
            >
              <Printer className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">إيصال حراري</span>
            </button>

            {/* WhatsApp Contact with Modification text */}
            <a
              href={`https://wa.me/${waNumber(order.customer_phone)}?text=${encodeURIComponent(modificationText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
              title="إرسال التعديل على واتساب"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">واتساب التعديل</span>
            </a>

            {/* Master Save Button */}
            <button
              type="button"
              onClick={handleFinish}
              disabled={busy || isFinishing}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white shadow-md transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50 sm:px-5 sm:text-sm"
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
      <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <h3 className="font-display text-sm font-bold text-foreground">
              هوية العميل والمستلم · Customer Identity
            </h3>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-muted-foreground select-none">
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
              placeholder="مثال: كيكة عيد ميلاد سارة"
              className={inputClass}
            />
          </label>

          <label className="block text-xs font-bold text-foreground">
            اسم العميل · Customer Name
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
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
              placeholder="07XXXXXXXX"
              className={inputClass}
            />
          </label>
        </div>

        {/* Gift / Alternate Recipient Fields */}
        {isGift && (
          <div className="animate-fadeIn grid gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 sm:grid-cols-2">
            <label className="block text-xs font-bold text-foreground">
              رقم هاتف المرسل · Sender Phone
              <input
                dir="ltr"
                inputMode="tel"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
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
                placeholder="07XXXXXXXX"
                className={inputClass}
              />
            </label>
          </div>
        )}
      </div>

      {/* SECTION 2: Fulfillment & Logistics */}
      <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
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
            className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-xs font-bold transition sm:text-sm ${
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
            className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-xs font-bold transition sm:text-sm ${
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
              <label className="text-xs font-bold text-foreground">
                تاريخ التسليم المطلوب · Date
              </label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="rounded-lg bg-secondary px-2 py-0.5 font-bold hover:bg-secondary/80"
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="rounded-lg bg-secondary px-2 py-0.5 font-bold hover:bg-secondary/80"
                >
                  غداً
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(2)}
                  className="rounded-lg bg-secondary px-2 py-0.5 font-bold hover:bg-secondary/80"
                >
                  بعد يومين
                </button>
              </div>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
                    }}
                    className="rounded-lg bg-secondary px-2 py-0.5 font-bold hover:bg-secondary/80"
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
              className={inputClass}
            />
          </div>
        </div>

        {/* Delivery Area & Address */}
        {order.method === "delivery" && (
          <div className="animate-fadeIn grid gap-3 rounded-2xl border border-orange-200 bg-orange-50/40 p-3.5 sm:grid-cols-2">
            <label className="block text-xs font-bold text-foreground">
              منطقة التوصيل وأجرتها · Delivery Zone
              <DeliveryZoneSelect
                value={order.area ?? ""}
                onChange={(area) => {
                  onPatch(area ? { area } : { area: null, delivery_fee: 0 });
                }}
                className={inputClass}
                placeholder="— اختر منطقة التوصيل —"
                noteClassName="mt-1 block text-[11px] font-bold text-orange-900"
              />
            </label>

            <label className="block text-xs font-bold text-foreground">
              العنوان بالتفصيل · Delivery Address
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="الشارع، البناية، رقم الطابق، معالم قريبة"
                className={inputClass}
              />
            </label>
          </div>
        )}
      </div>

      {/* SECTION 3: Cake Inscription & Notes */}
      <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
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
                }}
                className="cursor-pointer rounded-full border border-amber-300 bg-amber-50/80 px-2.5 py-1 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100"
              >
                + {phrase}
              </button>
            ))}
          </div>

          {/* Golden Ribbon Preview */}
          {inscription && (
            <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-amber-100/50 to-amber-50 p-3 text-center shadow-xs">
              <span className="mb-1 block text-[10px] font-bold tracking-wider text-amber-700 uppercase">
                معاينة النص على سطح الكيك
              </span>
              <p className="font-display text-base font-black text-amber-950">
                ✨ « {inscription} » ✨
              </p>
            </div>
          )}
        </div>

        {/* Card Note, Customer Notes, Staff Notes */}
        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          <label className="block text-xs font-bold text-foreground">
            الكتابة على الكرت · Card Note
            <textarea
              rows={3}
              value={cardNote}
              onChange={(e) => setCardNote(e.target.value)}
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
              placeholder="ملاحظات الموظفين (لا تطبع للعميل)..."
              className={`${boxedTextarea} border-amber-300 bg-amber-50/50`}
            />
          </label>
        </div>
      </div>

      {/* SECTION 4: Line Items & Add-ons Studio */}
      <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
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
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition ${
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
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition ${
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
            onReplace={handleReplaceItems}
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
                  onItemPatch={handleItemPatch}
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
                    handleReplaceItems(remainingLines);
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
              className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-primary/5 px-4 text-sm font-extrabold text-primary transition hover:bg-primary/10"
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
              handleItemPatch({
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
              (typeof handleReplaceItems === "function" ? handleReplaceItems : onReplaceItems)(
                nextLines,
              );
            }
          }}
        />
      </div>

      {/* SECTION 5: Financials, Discount & Payments */}
      <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
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
          <div className="space-y-2 rounded-2xl border border-border/70 bg-secondary/20 p-4 text-sm">
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
              <div className="flex justify-between font-bold text-rose-600">
                <span>الخصم المطبق ({order.discount_percent}%)</span>
                <span>− {jd(order.discount_amount)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-border pt-2 text-base font-black text-foreground">
              <span>الإجمالي الكلي النهائي</span>
              <span>{jd(order.total)}</span>
            </div>

            {order.deposit_paid > order.total ? (
              <div className="flex justify-between rounded-lg border border-purple-500/20 bg-purple-500/10 p-2 pt-1 text-xs font-black text-purple-600">
                <span>مستحق إرجاع للزبون 🔄</span>
                <span>{jd(order.deposit_paid - order.total)}</span>
              </div>
            ) : (
              <div
                className={`flex justify-between pt-1 text-sm font-black ${
                  remaining > 0 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                <span>المتبقي للتحصيل</span>
                <span>{remaining > 0 ? jd(remaining) : "0.00 د.أ (مسدد بالكامل)"}</span>
              </div>
            )}
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
                readOnly
                disabled
                className={`${inputClass} cursor-not-allowed bg-muted`}
              />
            </label>

            {/* Quick Deposit Buttons */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void handleQuickAddPayment(5, "remainder")}
                className="cursor-pointer rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold hover:bg-secondary/80"
              >
                + تسجيل 5 د.أ
              </button>
              <button
                type="button"
                onClick={() => void handleQuickAddPayment(10, "remainder")}
                className="cursor-pointer rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold hover:bg-secondary/80"
              >
                + تسجيل 10 د.أ
              </button>
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => void handleQuickAddPayment(remaining, "full")}
                  className="cursor-pointer rounded-lg border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-200"
                >
                  تسجيل دفع المتبقي كاملاً ({jd(remaining)})
                </button>
              )}
            </div>

            {/* CliQ Receipt Upload / Preview */}
            <div className="space-y-2 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Camera className="h-3.5 w-3.5 text-amber-700" />
                  <span>صورة إشعار حوالة كليك · CliQ Receipt</span>
                </span>
                {receiptUrl && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    مرفقة ✅
                  </span>
                )}
              </div>

              <input
                ref={receiptInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadReceipt(file);
                }}
              />

              {receiptUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-card p-2">
                  <img
                    src={receiptUrl}
                    alt="صورة حوالة كليك"
                    onClick={() => window.open(receiptUrl, "_blank")}
                    className="h-14 w-14 shrink-0 cursor-pointer rounded-lg border border-border object-cover"
                    title="اضغط لفتح الصورة"
                  />
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(receiptUrl, "_blank")}
                      className="cursor-pointer text-xs font-bold text-primary hover:underline"
                    >
                      عرض الصورة 🔍
                    </button>
                    <button
                      type="button"
                      onClick={() => receiptInputRef.current?.click()}
                      disabled={uploadingReceipt}
                      className="cursor-pointer rounded-lg border border-border bg-secondary px-2.5 py-1 text-[11px] font-bold hover:bg-secondary/80"
                    >
                      {uploadingReceipt ? "جاري الرفع..." : "تغيير الصورة"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => receiptInputRef.current?.click()}
                  disabled={uploadingReceipt}
                  className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-400 bg-background px-3 text-xs font-bold text-amber-900 hover:bg-amber-50 dark:text-amber-200"
                >
                  {uploadingReceipt ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  <span>
                    {uploadingReceipt
                      ? "جاري رفع صورة الحوالة..."
                      : "📸 تحميل صورة إشعار حوالة كليك"}
                  </span>
                </button>
              )}
            </div>

            {/* Managerial Discount Box */}
            <div className="space-y-2 rounded-2xl border border-dashed border-border p-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Percent className="h-3.5 w-3.5 text-primary" />
                  <span>تطبيق خصم إداري خاص</span>
                </span>
                {mayDiscount ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                    مصرح حتى {discountCap}%
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
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
                    className="h-10 rounded-xl border border-input bg-background px-3 text-xs text-foreground sm:col-span-2"
                  />
                  <button
                    type="button"
                    onClick={() => handleDiscount(Number(discountPercent) || 0, discountReason)}
                    className="min-h-10 cursor-pointer rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 sm:col-span-3"
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
      <div className="sticky bottom-2 z-20 rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 p-4 text-white shadow-2xl">
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
            className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-black text-emerald-950 shadow-md transition hover:bg-emerald-50 active:scale-95 disabled:opacity-50"
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
    <div className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-2xs">
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
            className="w-full border-b border-dashed border-border/70 bg-transparent pb-1 font-display text-sm font-black text-foreground transition outline-none focus:border-primary"
          />
        </div>

        {/* Quantity Stepper & Unit Price */}
        <div className="flex shrink-0 items-center gap-2">
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
              className="grid h-8 w-8 cursor-pointer place-items-center text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30"
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
              className="grid h-8 w-8 cursor-pointer place-items-center text-xs font-bold text-muted-foreground hover:text-foreground"
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
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50"
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
        className="w-full rounded-xl border border-transparent bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground transition outline-none focus:border-border"
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
                className="cursor-pointer text-primary/70 hover:text-rose-600"
                title="إزالة الإضافة"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Quick Accessories & Fillings Pill Deck */}
      <div className="border-t border-border/50 pt-1">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
          <span>إضافات سريعة ونكهات (بنقرة واحدة):</span>
          <button
            type="button"
            onClick={onOpenSheet}
            className="flex items-center gap-1 text-primary hover:underline"
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
              className="cursor-pointer rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground transition hover:bg-primary hover:text-primary-foreground"
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
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Website Catalogue Expander Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowWebsiteOptions((prev) => !prev)}
          className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-primary hover:underline"
        >
          <span>
            {showWebsiteOptions
              ? "▲ إخفاء خيارات كتالوج الموقع"
              : "▼ خيارات كتالوج الموقع (أحجام، حشوات متقدمة)"}
          </span>
        </button>

        {showWebsiteOptions && (
          <div className="animate-fadeIn mt-2 space-y-3 rounded-2xl border border-primary/20 bg-secondary/20 p-3">
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
                      const patch: Parameters<typeof onItemPatch>[0] = {
                        itemId: item.id,
                        name: picked.name_ar,
                      };
                      if (!picked.price_on_request && picked.price > 0) {
                        patch.newUnitPrice = picked.price;
                      }
                      onItemPatch(patch);
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
                    const nextOptions = withLabel(options, "الحجم", size.label);
                    setOptions(nextOptions);
                    onItemPatch({
                      itemId: item.id,
                      newUnitPrice: size.price,
                      options: nextOptions,
                    });
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

            <div dir="rtl" className="rounded-2xl border border-border/50 bg-white p-2">
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
              className="min-h-10 w-full cursor-pointer rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              تطبيق خيارات الكستمايزيشن على الصنف ✅
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
