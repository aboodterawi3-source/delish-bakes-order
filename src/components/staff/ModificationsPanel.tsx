import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { orderLabel } from "@/lib/order-label";
import { ORDERS_KEY, statusMeta } from "@/components/staff/OrdersWorkspace";
import {
  getSalesOrders,
  updateSalesOrder,
  updateSalesOrderItemPrice,
  type OrderItemPatch,
  type OrderPatch,
  type SalesOrder,
} from "@/lib/sales.functions";
import { applyOrderDiscount, getMyAuthorization } from "@/lib/authorization.functions";
import { DELIVERY_ZONES, OTHER_GOVERNORATES_AREA, feeForArea } from "@/lib/delivery-zones";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import type { StorefrontProduct } from "@/lib/storefront-content";
import { WebsiteRebuildPanel } from "@/components/staff/WebsiteRebuildPanel";
import {
  CakeCustomizationPanel,
  customizationSummary,
  emptyCustomization,
  type Customization,
} from "@/components/delish/CakeCustomizationPanel";

const jd = (value: number) => `${value.toFixed(2)} د.أ`;

/** Replaces (or removes) a labelled extra such as «الحشوة: نوتيلا» in the list. */
const withLabel = (list: string[], label: string, value: string) => {
  const rest = list.filter((entry) => !entry.startsWith(`${label}:`));
  return value ? [...rest, `${label}: ${value}`] : rest;
};
const field = "mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm";
const boxed = "mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm";

/**
 * The single place where staff may change anything on an order: identity,
 * schedule, delivery, prices, quantities, fillings, candles, balloons, acrylic
 * items and every custom request the customer asked for.
 */
export function ModificationsPanel() {
  const queryClient = useQueryClient();
  const ordersFn = useServerFn(getSalesOrders);
  const updateFn = useServerFn(updateSalesOrder);
  const updateItemFn = useServerFn(updateSalesOrderItemPrice);
  const discountFn = useServerFn(applyOrderDiscount);
  const authorizationFn = useServerFn(getMyAuthorization);

  const [term, setTerm] = useState("");
  const search = useDebouncedValue(term, 180);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const orders = useQuery({ queryKey: ORDERS_KEY, queryFn: () => ordersFn({}) });
  const authorization = useQuery({
    queryKey: ["staff-authorization"],
    queryFn: () => authorizationFn({}),
  });
  useOrdersRealtime(ORDERS_KEY, true, "modifications-orders");
  // The very same catalogue the website shows: products, sizes and fillings.
  const storefront = useStorefrontContent();

  const rows = orders.data ?? [];

  const list = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows.slice(0, 60);
    return rows
      .filter((order) =>
        [
          order.order_number,
          order.order_name ?? "",
          order.customer_name,
          order.customer_phone,
          order.sender_phone ?? "",
          order.recipient_phone ?? "",
          order.area ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 60);
  }, [rows, search]);

  const selected = rows.find((order) => order.id === selectedId) ?? null;

  const save = useMutation({
    mutationFn: (input: OrderPatch) => updateFn({ data: input }),
    onSuccess: (order) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (current) =>
        (current ?? []).map((row) => (row.id === order.id ? order : row)),
      );
      toast.success("تم حفظ التعديل ✅");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveItem = useMutation({
    mutationFn: (input: OrderItemPatch) => updateItemFn({ data: input }),
    onSuccess: (order) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (current) =>
        (current ?? []).map((row) => (row.id === order.id ? order : row)),
      );
      toast.success("تم حفظ تعديل الصنف ✅");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const discount = useMutation({
    mutationFn: (input: { orderId: string; percent: number; reason: string }) =>
      discountFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      toast.success("تم تطبيق الخصم ✅");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (orders.isPending) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جار التحميل" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-base font-bold text-foreground">تعديلات · Modifications</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          ابحث عن الطلب ثم عدّل أي تفصيل: الأسعار، الحشوة، الشموع، البالونات، الأكريليك وأي طلب خاص.
        </p>
        <label className="mt-3 flex min-h-12 items-center gap-2 rounded-full border border-input bg-background px-4">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="رقم الطلب · اسم الطلب · العميل · الهاتف"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            aria-label="بحث عن طلب للتعديل"
          />
        </label>
      </div>

      <ul className="grid min-w-0 gap-2">
        {list.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => setSelectedId(order.id === selectedId ? null : order.id)}
              aria-expanded={order.id === selectedId}
              className={`flex min-h-12 w-full flex-wrap items-center gap-2 rounded-2xl border px-4 py-3 text-start ${
                order.id === selectedId ? "border-primary bg-secondary/50" : "border-border bg-card"
              }`}
            >
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta[order.status].chip}`}>
                {statusMeta[order.status].ar}
              </span>
              <span className="font-display text-sm font-bold text-foreground">
                {orderLabel(order.order_number, order.staff_code)}
              </span>
              <span className="min-w-0 break-words text-sm text-foreground">
                {order.order_name?.trim() || order.customer_name}
              </span>
              <span className="text-xs text-muted-foreground sm:ms-auto">
                {order.requested_date} · {order.requested_time.slice(0, 5)} · {jd(order.total)}
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            لا توجد طلبات مطابقة للبحث.
          </li>
        ) : null}
      </ul>

      {selected ? (
        <OrderEditor
          key={selected.id}
          order={selected}
          busy={save.isPending || saveItem.isPending || rebuild.isPending}
          mayDiscount={Boolean(authorization.data?.allow_custom_discount)}
          discountCap={authorization.data?.max_discount_percent ?? 0}
          products={storefront.data?.products ?? []}
          onPatch={(patch) => save.mutate({ orderId: selected.id, ...patch })}
          onItemPatch={(patch) => saveItem.mutate({ orderId: selected.id, ...patch })}
          onReplaceItems={(lines) => rebuild.mutate({ orderId: selected.id, lines })}
          onDiscount={(percent, reason) =>
            discount.mutate({ orderId: selected.id, percent, reason })
          }
        />
      ) : null}
    </div>
  );
}

function OrderEditor({
  order,
  busy,
  mayDiscount,
  discountCap,
  products,
  onPatch,
  onItemPatch,
  onReplaceItems,
  onDiscount,
}: {
  order: SalesOrder;
  busy: boolean;
  products: StorefrontProduct[];
  mayDiscount: boolean;
  discountCap: number;
  onPatch: (patch: Omit<OrderPatch, "orderId">) => void;
  onItemPatch: (patch: Omit<OrderItemPatch, "orderId">) => void;
  onReplaceItems: (lines: RebuildLine[]) => void;
  onDiscount: (percent: number, reason: string) => void;
}) {
  const [orderName, setOrderName] = useState(order.order_name ?? "");
  const [customerName, setCustomerName] = useState(order.customer_name);
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone);
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

  const remaining = Math.max(order.total - (Number(deposit) || 0), 0);

  return (
    <section className="min-w-0 space-y-5 rounded-2xl border border-primary/40 bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="me-auto font-display text-base font-bold text-foreground">
          تعديل الطلب {orderLabel(order.order_number, order.staff_code)}
        </h3>
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="جار الحفظ" /> : null}
      </header>

      {/* Identity and schedule */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-foreground sm:col-span-2">
          اسم الطلب · Order name
          <input
            value={orderName}
            onChange={(event) => setOrderName(event.target.value)}
            onBlur={() => onPatch({ order_name: orderName.trim() || null })}
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
        <label className="block text-sm font-bold text-foreground">
          هاتف التواصل · Phone
          <input
            dir="ltr"
            inputMode="tel"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            onBlur={() => customerPhone.trim() && onPatch({ customer_phone: customerPhone.trim() })}
            className={field}
          />
        </label>
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

      {/* Fulfilment */}
      <div className="space-y-3 rounded-2xl border border-border bg-background p-3.5">
        <h4 className="text-sm font-bold text-foreground">طريقة التسليم · Fulfilment</h4>
        <div className="flex flex-wrap gap-2">
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
          <>
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
                        {area === OTHER_GOVERNORATES_AREA ? `${area} (٥–٨ د.أ)` : area}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                أجرة التوصيل: {jd(feeForArea(order.area ?? "") ?? order.delivery_fee)}
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
          </>
        ) : null}
      </div>

      {/* Items: description, price, quantity and every customer extra */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-foreground">الأصناف والطلبات الخاصة · Items &amp; extras</h4>
        {order.items.map((item) => (
          <ItemEditor key={item.id} item={item} products={products} onItemPatch={onItemPatch} />
        ))}
        {order.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            لا توجد أصناف مسجلة على هذا الطلب.
          </p>
        ) : null}
      </div>

      {/* Writing and notes */}
      <div className="grid gap-3">
        <label className="block text-sm font-bold text-foreground">
          الكتابة على الكيك · Cake writing
          <input
            value={inscription}
            onChange={(event) => setInscription(event.target.value)}
            onBlur={() => onPatch({ inscription: inscription.trim() || null })}
            className={field}
          />
        </label>
        <label className="block text-sm font-bold text-foreground">
          الكتابة على الكرت · Card writing
          <input
            value={cardNote}
            onChange={(event) => setCardNote(event.target.value)}
            onBlur={() => onPatch({ card_note: cardNote.trim() || null })}
            className={field}
          />
        </label>
        <label className="block text-sm font-bold text-foreground">
          ملاحظات العميل · Customer notes
          <textarea
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => onPatch({ notes: notes.trim() || null })}
            className={boxed}
          />
        </label>
        <label className="block text-sm font-bold text-foreground">
          ملاحظات داخلية · Internal notes
          <textarea
            rows={2}
            value={staffNotes}
            onChange={(event) => setStaffNotes(event.target.value)}
            onBlur={() => onPatch({ staff_notes: staffNotes.trim() || null })}
            className={boxed}
          />
        </label>
      </div>

      {/* Money */}
      <div className="space-y-3 rounded-2xl border border-border bg-background p-3.5">
        <h4 className="text-sm font-bold text-foreground">المالية · Money</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-foreground"><span>المجموع الفرعي</span><span>{jd(order.subtotal)}</span></div>
          <div className="flex justify-between text-foreground"><span>التوصيل</span><span>{jd(order.method === "delivery" ? order.delivery_fee : 0)}</span></div>
          {order.discount_amount > 0 ? (
            <div className="flex justify-between text-destructive">
              <span>الخصم ({order.discount_percent}%)</span>
              <span>− {jd(order.discount_amount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between font-bold text-foreground"><span>الإجمالي</span><span>{jd(order.total)}</span></div>
          <div className={`flex justify-between font-bold ${remaining > 0 ? "text-destructive" : "text-foreground"}`}>
            <span>المتبقي</span><span>{jd(remaining)}</span>
          </div>
        </div>
        <label className="block text-sm font-bold text-foreground">
          المبلغ المدفوع · Paid
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
        {mayDiscount ? (
          <div className="space-y-2">
            <label className="block text-sm font-bold text-foreground">
              نسبة الخصم % (حتى {discountCap}%)
              <input
                type="number"
                min="0"
                max={discountCap}
                step="1"
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
                className={field}
              />
            </label>
            <input
              value={discountReason}
              onChange={(event) => setDiscountReason(event.target.value)}
              placeholder="سبب الخصم · Reason"
              className="min-h-12 w-full rounded-xl border border-input bg-card px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => onDiscount(Number(discountPercent) || 0, discountReason)}
              className="min-h-12 w-full rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
            >
              تطبيق الخصم · Apply discount
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            الخصم الخاص يحتاج تصريح المدير على هذا الحساب.
          </p>
        )}
      </div>
    </section>
  );
}

/** One order line: description, quantity, price and the customer's extras list. */
function ItemEditor({
  item,
  products,
  onItemPatch,
}: {
  item: SalesOrder["items"][number];
  products: StorefrontProduct[];
  onItemPatch: (patch: Omit<OrderItemPatch, "orderId">) => void;
}) {
  const [options, setOptions] = useState<string[]>(item.options_ar);
  const [draft, setDraft] = useState("");
  const [showWebsite, setShowWebsite] = useState(false);
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

  return (
    <div className="min-w-0 space-y-3 rounded-2xl border border-border bg-background p-3.5">
      <label className="block text-xs font-bold text-foreground">
        وصف الصنف · Item
        <textarea
          rows={2}
          defaultValue={item.name_ar}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value && value !== item.name_ar) onItemPatch({ itemId: item.id, name: value });
          }}
          className={boxed}
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
                onItemPatch({ itemId: item.id, quantity: value });
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
                onItemPatch({ itemId: item.id, newUnitPrice: value });
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
            if (value !== (item.notes ?? "")) onItemPatch({ itemId: item.id, notes: value || null });
          }}
          className="mt-1 min-h-11 w-full rounded-xl border border-input bg-card px-2 text-sm"
        />
      </label>

      {/* The website catalogue: product, size, filling and all add-ons */}
      <div className="space-y-3 rounded-2xl border border-primary/30 bg-secondary/30 p-3">
        <button
          type="button"
          onClick={() => setShowWebsite((open) => !open)}
          aria-expanded={showWebsite}
          className="min-h-11 w-full rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
        >
          {showWebsite ? "إخفاء خيارات الموقع" : "خيارات الموقع · Website options"}
        </button>

        {showWebsite ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-bold text-foreground">
                المنتج من الموقع · Website product
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
                  className={field}
                >
                  <option value="">— اختر منتجاً —</option>
                  {products.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name_ar} {row.price_on_request ? "(السعر عند الطلب)" : `— ${jd(row.price)}`}
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
                  className={field}
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
                  placeholder="مثال: نوتيلا · لوتس"
                  className={field}
                />
                <datalist id={`fillings-${item.id}`}>
                  {fillings.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </label>
            </div>

            <div dir="rtl" className="rounded-2xl bg-white p-2">
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
              }}
              className="min-h-11 w-full rounded-full border border-primary px-4 text-xs font-bold text-primary"
            >
              حفظ الخيارات على الصنف · Apply to item
            </button>
          </>
        ) : null}
      </div>

      {/* Candles, balloons, acrylic topper, filling and any custom request */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-foreground">
          الإضافات والطلبات الخاصة · الشموع، البالونات، الأكريليك، الحشوة…
        </p>
        <ul className="space-y-2">
          {options.map((option, index) => (
            <li key={`${index}-${option}`} className="flex min-w-0 items-center gap-2">
              <input
                value={option}
                onChange={(event) =>
                  setOptions((current) =>
                    current.map((value, i) => (i === index ? event.target.value : value)),
                  )
                }
                onBlur={() => {
                  const cleaned = options.map((value) => value.trim()).filter(Boolean);
                  if (cleaned.join("|") !== item.options_ar.join("|")) commitOptions(cleaned);
                }}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm"
                aria-label={`تعديل الإضافة ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => commitOptions(options.filter((_, i) => i !== index))}
                aria-label="حذف الإضافة"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-destructive text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex min-w-0 items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="مثال: ٦ شموع أرقام · بالونات ذهبية × ٣"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm"
            aria-label="إضافة طلب خاص جديد"
          />
          <button
            type="button"
            onClick={() => {
              const value = draft.trim();
              if (!value) return;
              commitOptions([...options, value]);
              setDraft("");
            }}
            aria-label="إضافة"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="text-xs font-bold text-muted-foreground">
        إجمالي الصنف: {jd(item.unit_price * item.quantity)}
      </p>
    </div>
  );
}
