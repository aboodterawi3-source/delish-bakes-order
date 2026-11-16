import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Bike,
  Cake,
  Calendar,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { InteractiveItemEditorCard } from "@/components/staff/InteractiveItemEditorCard";
import {
  MasterOrderCustomerSection,
  MasterOrderFinancialsSection,
  MasterOrderLogisticsSection,
  MasterOrderNotesSection,
} from "@/components/staff/MasterOrderSections";
import { TouchItemEditorSheet } from "@/components/staff/TouchItemEditorSheet";
import { WebsiteRebuildPanel } from "@/components/staff/WebsiteRebuildPanel";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOrdersRealtime, broadcastKitchenUpdate } from "@/hooks/use-orders-realtime";
import { useReceiptUpload } from "@/hooks/use-receipt-upload";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { applyOrderDiscount, getMyAuthorization } from "@/lib/authorization.functions";
import { copyToClipboard } from "@/lib/clipboard";
import {
  buildModificationMessage,
  formatArabicDate,
  formatArabicTime,
} from "@/lib/confirmation-message";
import { jd } from "@/lib/currency";
import { orderLabel } from "@/lib/order-label";
import { printCustomerReceipt } from "@/lib/receipt-templates";
import {
  getSalesOrders,
  recordOrderPayment,
  replaceSalesOrderItems,
  updateSalesOrder,
  updateSalesOrderItemPrice,
  type OrderItemPatch,
  type OrderPatch,
  type RebuildLine,
  type SalesOrder,
  type SalesStatus,
} from "@/lib/sales.functions";
import { ORDERS_KEY, statusMeta } from "@/lib/staff-orders-shared";
import type { StorefrontProduct } from "@/lib/storefront-content";
import { attachReceiptImageUrl, extractReceiptImageUrl } from "@/lib/utils";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

const MOD_FIELD_LABELS: Record<string, string> = {
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

/** Split-pane studio for inspecting and editing active sales orders. */
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

  const rows = useMemo(() => orders.data ?? [], [orders.data]);

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

  const syncOrderCache = (order: SalesOrder, message?: string) => {
    queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (current) =>
      (current ?? []).map((row) => (row.id === order.id ? order : row)),
    );
    void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
    broadcastKitchenUpdate();
    if (message) toast.success(message);
  };

  const save = useMutation({
    mutationFn: (input: OrderPatch) => updateFn({ data: input }),
    onSuccess: (order) => syncOrderCache(order),
    onError: (error: Error) => toast.error(error.message),
  });

  const saveItem = useMutation({
    mutationFn: (input: OrderItemPatch) => updateItemFn({ data: input }),
    onSuccess: (order) => syncOrderCache(order, "تم حفظ تعديل الصنف ✅"),
    onError: (error: Error) => toast.error(error.message),
  });

  const rebuild = useMutation({
    mutationFn: (input: {
      orderId: string;
      lines: RebuildLine[];
      expectedVersion?: number | null;
    }) => rebuildFn({ data: input }),
    onSuccess: (order) => syncOrderCache(order, "تم استبدال أصناف الطلب ✅ — تم إشعار المطبخ"),
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

  const pendingCount = rows.filter((o) => o.status === "new" || o.status === "confirmed").length;
  const inPrepCount = rows.filter((o) => o.status === "baking").length;
  const readyCount = rows.filter((o) => o.status === "ready").length;

  return (
    <div className="min-w-0 space-y-4" dir="rtl">
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

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-12">
        <aside
          className={`min-w-0 space-y-3 lg:col-span-4 ${selected ? "hidden lg:block" : "block"}`}
        >
          <div className="space-y-3 rounded-3xl border border-border/80 bg-card p-3.5 shadow-sm sm:p-4">
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
                  expectedVersion: expectedVersion ?? selected.version ?? null,
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

/** Interactive Editor Studio for a single selected order. */
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
  const receiptUrl = extractReceiptImageUrl(order.staff_notes);

  const settleVersionPromise = (p: any) => {
    if (p && typeof p.then === "function") {
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

  const onPatch = (patch: Omit<OrderPatch, "orderId">) => {
    pendingSelfMutationRef.current = true;
    return settleVersionPromise(
      onPatchProp({ ...patch, expected_version: initialVersionRef.current }),
    );
  };

  const { uploading: uploadingReceipt, handleFile: handleUploadReceipt } = useReceiptUpload(
    async (url) => {
      await onPatch({ staff_notes: attachReceiptImageUrl(order.staff_notes, url) });
    },
  );

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
    settleVersionPromise(onDiscount(percent, reason, initialVersionRef.current));
  };

  const handleReplaceItems = (lines: RebuildLine[], expectedVersion?: number | null) => {
    pendingSelfMutationRef.current = true;
    return settleVersionPromise(
      onReplaceItems(
        lines,
        expectedVersion !== undefined && expectedVersion !== null
          ? expectedVersion
          : initialVersionRef.current,
      ),
    );
  };

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
        initialVersionRef.current = (res as any).version;
      }
      return res;
    } finally {
      setIsFinishing(false);
    }
  };

  const remaining = Math.max(order.total - (Number(deposit) || 0), 0);
  const statusInfo = statusMeta[order.status];

  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  };

  const modificationText = useMemo(() => {
    const formattedMods = (order.modifications ?? []).map((m) => {
      const label = MOD_FIELD_LABELS[m.field] || m.field;
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

  const copyModification = async () => {
    const ok = await copyToClipboard(modificationText);
    if (ok) {
      toast.success("تم نسخ مسج التعديل (🛑🛑🛑تعديل) بنجاح 📋✨");
    } else {
      toast.error("تعذر النسخ التلقائي — انسخ يدوياً");
    }
  };

  return (
    <div className="space-y-4 pb-20">
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyModification()}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 text-xs font-black text-rose-800 transition hover:bg-rose-100"
              title="نسخ مسج التعديل (🛑🛑🛑تعديل)"
            >
              <ClipboardCopy className="h-4 w-4 text-rose-600" />
              <span>🛑 نسخ مسج التعديل</span>
            </button>

            <button
              type="button"
              onClick={() => printCustomerReceipt(order)}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-secondary"
              title="طباعة إيصال حراري"
            >
              <Printer className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">إيصال حراري</span>
            </button>

            <a
              href={getWhatsAppChatUrl(order.customer_phone, modificationText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
              title="إرسال التعديل على واتساب"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">واتساب التعديل</span>
            </a>

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

      <MasterOrderCustomerSection
        orderName={orderName}
        customerName={customerName}
        customerPhone={customerPhone}
        isGift={isGift}
        senderPhone={senderPhone}
        recipientPhone={recipientPhone}
        onChangeOrderName={setOrderName}
        onChangeCustomerName={setCustomerName}
        onChangeCustomerPhone={setCustomerPhone}
        onChangeIsGift={setIsGift}
        onChangeSenderPhone={setSenderPhone}
        onChangeRecipientPhone={setRecipientPhone}
      />

      <MasterOrderLogisticsSection
        order={order}
        date={date}
        time={time}
        address={address}
        onChangeDate={setDate}
        onChangeTime={setTime}
        onChangeAddress={setAddress}
        onSetQuickDate={setQuickDate}
        onPatch={onPatch}
      />

      <MasterOrderNotesSection
        inscription={inscription}
        cardNote={cardNote}
        notes={notes}
        staffNotes={staffNotes}
        onChangeInscription={setInscription}
        onChangeCardNote={setCardNote}
        onChangeNotes={setNotes}
        onChangeStaffNotes={setStaffNotes}
      />

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
              handleReplaceItems(nextLines);
            }
          }}
        />
      </div>

      <MasterOrderFinancialsSection
        order={order}
        deposit={deposit}
        remaining={remaining}
        receiptUrl={receiptUrl}
        uploadingReceipt={uploadingReceipt}
        mayDiscount={mayDiscount}
        discountCap={discountCap}
        discountPercent={discountPercent}
        discountReason={discountReason}
        onChangeDiscountPercent={setDiscountPercent}
        onChangeDiscountReason={setDiscountReason}
        onQuickAddPayment={(amount, type) => void handleQuickAddPayment(amount, type)}
        onUploadReceipt={(file) => void handleUploadReceipt(file)}
        onApplyDiscount={handleDiscount}
      />

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
