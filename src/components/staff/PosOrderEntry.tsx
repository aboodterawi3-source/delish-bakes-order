import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bike,
  CheckCircle2,
  Gift,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  Printer,
  Receipt,
  Search,
  Store,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import type { StorefrontProduct } from "@/lib/storefront-content";
import {
  DELIVERY_ZONES,
  OTHER_GOVERNORATES_AREA,
  feeForArea,
} from "@/lib/delivery-zones";
import {
  createSalesOrder,
  getSalesOrders,
  type CreateSalesOrderInput,
  type PaymentMethod,
  type SalesOrder,
} from "@/lib/sales.functions";
import { printReceipt, ORDERS_KEY } from "@/components/staff/OrdersWorkspace";
import { esc, printDocument } from "@/lib/print";
import { orderLabel } from "@/lib/order-label";

const jd = (val: number) => `${val.toFixed(2)} د.أ`;

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const defaultTimeSlot = () => {
  const now = new Date();
  now.setHours(now.getHours() + 2);
  const h = String(now.getHours()).padStart(2, "0");
  return `${h}:00`;
};

export type PosCartItem = {
  id: string;
  productId?: string | null | undefined;
  name: string;
  quantity: number;
  unitPrice: number;
  size?: string | null | undefined;
  filling?: string | null | undefined;
  inscription?: string | null | undefined;
  options: string[];
  notes?: string | null | undefined;
};

export function PosOrderEntry() {
  const queryClient = useQueryClient();
  const ordersFn = useServerFn(getSalesOrders);
  const createOrderFn = useServerFn(createSalesOrder);
  const storefront = useStorefrontContent();

  const existingOrders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => ordersFn({}),
  });

  // Customer & Fulfillment Form State
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [senderPhone, setSenderPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  const [method, setMethod] = useState<"delivery" | "pickup">("delivery");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [requestedDate, setRequestedDate] = useState(todayIso());
  const [requestedTime, setRequestedTime] = useState(defaultTimeSlot());
  const [orderName, setOrderName] = useState("");
  const [notes, setNotes] = useState("");
  const [staffNotes, setStaffNotes] = useState("");
  const [cardNote, setCardNote] = useState("");
  const [inscription, setInscription] = useState("");
  const [designImageUrl, setDesignImageUrl] = useState<string | null>(null);

  // Cart & Financials
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [depositPaid, setDepositPaid] = useState<string>("0");
  const [discountPercent, setDiscountPercent] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  // Catalog search & filter
  const [catalogQuery, setCatalogQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Customer Auto-complete lookup
  const phoneSearch = useDebouncedValue(customerPhone, 200);
  const customerSuggestions = useMemo(() => {
    const q = phoneSearch.trim().toLowerCase();
    if (q.length < 3 || !existingOrders.data) return [];
    const map = new Map<string, { name: string; phone: string; address?: string | undefined; area?: string | undefined }>();
    for (const order of existingOrders.data) {
      if (order.customer_phone.toLowerCase().includes(q)) {
        if (!map.has(order.customer_phone)) {
          map.set(order.customer_phone, {
            name: order.customer_name,
            phone: order.customer_phone,
            address: order.address || undefined,
            area: order.area || undefined,
          });
        }
      }
    }
    return Array.from(map.values()).slice(0, 5);
  }, [existingOrders.data, phoneSearch]);

  const selectCustomerSuggestion = (sug: { name: string; phone: string; address?: string | undefined; area?: string | undefined }) => {
    setCustomerName(sug.name);
    setCustomerPhone(sug.phone);
    if (sug.address) setAddress(sug.address);
    if (sug.area) {
      setArea(sug.area);
      setMethod("delivery");
    }
    toast.info(`تم تحميل بيانات العميل: ${sug.name}`);
  };

  // Calculated Money Totals
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart],
  );

  const deliveryFee = useMemo(
    () => (method === "delivery" && area ? (feeForArea(area) ?? 0) : 0),
    [method, area],
  );

  const discountAmount = useMemo(() => {
    const p = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);
    return (subtotal * p) / 100;
  }, [subtotal, discountPercent]);

  const grandTotal = useMemo(
    () => Math.max(subtotal + deliveryFee - discountAmount, 0),
    [subtotal, deliveryFee, discountAmount],
  );

  const depositVal = Number(depositPaid) || 0;
  const remainingBalance = Math.max(grandTotal - depositVal, 0);

  // Cart operations
  const addToCart = (product: StorefrontProduct) => {
    const existingIndex = cart.findIndex((item) => item.productId === product.id);
    if (existingIndex >= 0) {
      setCart((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      );
    } else {
      const newItem: PosCartItem = {
        id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId: product.id,
        name: product.name_ar,
        quantity: 1,
        unitPrice: product.price || 0,
        filling: product.filling_ar || undefined,
        options: product.filling_ar ? [`الحشوة: ${product.filling_ar}`] : [],
      };
      setCart((prev) => [...prev, newItem]);
    }
    toast.success(`تمت إضافة ${product.name_ar} إلى السلة`);
  };

  const updateCartItemQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as PosCartItem[],
    );
  };

  const removeCartItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateCartItemPrice = (id: string, price: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unitPrice: Math.max(price, 0) } : item)),
    );
  };

  // Image Upload handler (Base64 data URL for design photo preview)
  const handleImageUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً (الأقصى 5 ميجابايت)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setDesignImageUrl(e.target?.result as string);
      toast.success("تم إرفاق صورة التصميم بنجاح 📸");
    };
    reader.readAsDataURL(file);
  };

  // Create Order Mutation
  const createOrder = useMutation({
    mutationFn: (input: CreateSalesOrderInput) => createOrderFn({ data: input }),
    onSuccess: (newOrder) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (curr) => [newOrder, ...(curr ?? [])]);
      toast.success(`تم إنشاء الطلب بنجاح ✅ (طلب ${orderLabel(newOrder.order_number, newOrder.staff_code)})`);
      // Reset POS Form
      setCustomerPhone("");
      setCustomerName("");
      setIsGift(false);
      setSenderPhone("");
      setRecipientName("");
      setRecipientPhone("");
      setCart([]);
      setAddress("");
      setNotes("");
      setStaffNotes("");
      setCardNote("");
      setInscription("");
      setDesignImageUrl(null);
      setDepositPaid("0");
      setDiscountPercent("0");
      setOrderName("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmitOrder = () => {
    if (!customerName.trim()) {
      toast.error("يرجى إدخال اسم العميل");
      return;
    }
    if (!customerPhone.trim()) {
      toast.error("يرجى إدخال رقم هاتف العميل");
      return;
    }
    if (method === "delivery" && !area) {
      toast.error("يرجى اختيار منطقة التوصيل");
      return;
    }
    if (cart.length === 0) {
      toast.error("يرجى إضافة صنف واحد على الأقل للسلة");
      return;
    }

    const payload: CreateSalesOrderInput = {
      customer_name: customerName,
      customer_phone: customerPhone,
      order_name: orderName.trim() || undefined,
      sender_phone: isGift ? (senderPhone.trim() || customerPhone) : undefined,
      recipient_phone: isGift ? (recipientPhone.trim() || undefined) : undefined,
      method,
      area: method === "delivery" ? area : undefined,
      address: method === "delivery" ? address : undefined,
      requested_date: requestedDate,
      requested_time: requestedTime,
      notes: notes.trim() || undefined,
      staff_notes: staffNotes.trim() || undefined,
      inscription: inscription.trim() || undefined,
      card_note: cardNote.trim() || undefined,
      design_image_url: designImageUrl,
      payment_method: paymentMethod,
      deposit_paid: depositVal,
      discount_percent: Number(discountPercent) || 0,
      discount_amount: discountAmount,
      items: cart.map((item) => ({
        productId: item.productId,
        name_ar: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        options_ar: item.options,
        notes: item.notes,
      })),
    };

    createOrder.mutate(payload);
  };

  // Catalog products filtering
  const catalogProducts = storefront.data?.products ?? [];
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of catalogProducts) if (p.category?.trim()) set.add(p.category.trim());
    return ["all", ...Array.from(set)];
  }, [catalogProducts]);

  const filteredProducts = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return catalogProducts.filter((p) => {
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      const matchQuery =
        !q || p.name_ar.toLowerCase().includes(q) || p.name_en.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [catalogProducts, catalogQuery, categoryFilter]);

  // Kitchen slip print preview
  const printKitchenSlipCurrent = () => {
    if (cart.length === 0) {
      toast.error("السلة فارغة");
      return;
    }
    const itemRows = cart
      .map(
        (it) =>
          `<tr><td><b>${it.quantity} × ${esc(it.name)}</b>${it.options.length ? `<br><small>${esc(it.options.join(" · "))}</small>` : ""}${it.notes ? `<br><small>ملاحظة: ${esc(it.notes)}</small>` : ""}</td></tr>`,
      )
      .join("");
    const body = `<h1>Delish Cake · بون المطبخ</h1>
<div style="text-align:center">التاريخ: ${requestedDate} | الوقت: ${requestedTime}</div>
<div class="line"></div>
<div>العميل: ${esc(customerName || "بدون اسم")} (${esc(customerPhone || "—")})</div>
<div>طريقة التسليم: ${method === "delivery" ? `توصيل (${esc(area || "عام")})` : "استلام من المحل"}</div>
${inscription ? `<div style="font-size:15px;font-weight:bold;margin:6px 0">الكتابة على الكيك: ${esc(inscription)}</div>` : ""}
<div class="line"></div>
<table>${itemRows}</table>
${notes ? `<div class="line"></div><div>ملاحظات: ${esc(notes)}</div>` : ""}`;
    printDocument("بون المطبخ", body);
  };

  return (
    <div dir="rtl" className="min-h-screen min-w-0 bg-background pb-12 font-sans">
      <div className="mx-auto max-w-7xl px-2 sm:px-4">
        {/* Top Workspace Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">
              نظام المبيعات وحجز الطلبات · Sales &amp; POS Desk
            </h2>
            <p className="text-xs text-muted-foreground">
              واجهة تفاعلية سريعة لإنشاء طلبات الكيك والتوصيل، حساب المالية وطباعة الفواتير
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              منصة المبيعات جاهزة
            </span>
          </div>
        </div>

        {/* 2-Column Split POS Layout */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main Form Column (Right Side in RTL - 7 columns) */}
          <div className="space-y-6 min-w-0 lg:col-span-7 xl:col-span-8">
            {/* 1. Customer & Fulfillment Card */}
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-all">
              <header className="mb-4 flex items-center gap-2 border-b border-border pb-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">
                    1. بيانات العميل والتسليم
                  </h3>
                  <p className="text-xs text-muted-foreground">اسم العميل، الهاتف، طريقة التسليم والموعد</p>
                </div>
              </header>

              <div className="space-y-4">
                {/* Customer Phone Search & Auto-complete */}
                <div className="relative">
                  <label className="block text-xs font-bold text-foreground mb-1">
                    رقم هاتف العميل (البحث التلقائي)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      dir="ltr"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="079XXXXXXX"
                      className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>

                  {/* Customer Auto-complete Dropdown */}
                  {customerSuggestions.length > 0 && (
                    <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-card p-1 shadow-lg">
                      <p className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground">
                        عملاء سابقون مطبقون:
                      </p>
                      {customerSuggestions.map((sug) => (
                        <button
                          key={sug.phone}
                          type="button"
                          onClick={() => selectCustomerSuggestion(sug)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-xs hover:bg-secondary"
                        >
                          <span className="font-bold text-foreground">{sug.name}</span>
                          <span dir="ltr" className="text-muted-foreground">{sug.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Customer Name & Order Title */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-foreground">
                    اسم العميل *
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="اسم العميل الكامل"
                      className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </label>

                  <label className="block text-xs font-bold text-foreground">
                    عنوان/اسم الطلب (اختياري)
                    <input
                      type="text"
                      value={orderName}
                      onChange={(e) => setOrderName(e.target.value)}
                      placeholder="مثال: كيكة عيد ميلاد سارة"
                      className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </label>
                </div>

                {/* Gift Checkbox Toggle */}
                <div className="rounded-xl border border-border bg-secondary/20 p-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={isGift}
                      onChange={(e) => setIsGift(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <Gift className="h-4 w-4 text-primary" />
                    <span>هذا الطلب عبارة عن هدية (إرسال لشخص آخر)</span>
                  </label>

                  {/* Gift Revealed Fields */}
                  {isGift && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3 border-t border-border pt-3 animate-in fade-in duration-200">
                      <label className="block text-xs font-bold text-foreground">
                        اسم المستلم
                        <input
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="اسم الشخص المستلم"
                          className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground"
                        />
                      </label>
                      <label className="block text-xs font-bold text-foreground">
                        رقم هاتف المستلم
                        <input
                          dir="ltr"
                          type="tel"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="079XXXXXXX"
                          className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground"
                        />
                      </label>
                      <label className="block text-xs font-bold text-foreground">
                        رقم المرسل
                        <input
                          dir="ltr"
                          type="tel"
                          value={senderPhone}
                          onChange={(e) => setSenderPhone(e.target.value)}
                          placeholder="رقم صاحب الإهداء"
                          className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Fulfillment Method Segmented Switch */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-foreground">طريقة التسليم</label>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/50 p-1">
                    <button
                      type="button"
                      onClick={() => setMethod("pickup")}
                      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all ${
                        method === "pickup"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-foreground hover:bg-background/60"
                      }`}
                    >
                      <Store className="h-4 w-4" />
                      استلام من المحل
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("delivery")}
                      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all ${
                        method === "delivery"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-foreground hover:bg-background/60"
                      }`}
                    >
                      <Bike className="h-4 w-4" />
                      توصيل للموقع
                    </button>
                  </div>
                </div>

                {/* Dynamic Delivery Fields */}
                {method === "delivery" && (
                  <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-primary/20 bg-primary/5 p-3 animate-in fade-in duration-200">
                    <label className="block text-xs font-bold text-foreground">
                      منطقة التوصيل *
                      <select
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                      >
                        <option value="">— اختر المنطقة —</option>
                        {DELIVERY_ZONES.map((zone) => (
                          <optgroup key={zone.labelAr} label={zone.labelAr}>
                            {zone.areas.map((a) => (
                              <option key={a} value={a}>
                                {a === OTHER_GOVERNORATES_AREA ? `${a} (٥–٨ د.أ)` : `${a} (${feeForArea(a)} د.أ)`}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-foreground sm:col-span-2">
                      العنوان التفصيلي
                      <textarea
                        rows={2}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="اسم الشارع، رقم البناية، الطابق، أي معالم قريبة..."
                        className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </label>
                  </div>
                )}

                {/* Pickup/Delivery Schedule */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-foreground">
                    تاريخ الاستلام / التوصيل *
                    <div className="relative mt-1">
                      <input
                        type="date"
                        value={requestedDate}
                        onChange={(e) => setRequestedDate(e.target.value)}
                        className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground"
                      />
                    </div>
                  </label>

                  <label className="block text-xs font-bold text-foreground">
                    الوقت المحدد *
                    <div className="relative mt-1">
                      <input
                        type="time"
                        value={requestedTime}
                        onChange={(e) => setRequestedTime(e.target.value)}
                        className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground"
                      />
                    </div>
                  </label>
                </div>
              </div>
            </section>

            {/* 2. Product Catalog & Fast Item Selection */}
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <header className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-foreground">
                      2. كتالوج المنتجات والأصناف
                    </h3>
                    <p className="text-xs text-muted-foreground">اختر المنتجات لإضافتها فوراً لسلة الطلب</p>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    placeholder="ابحث عن اسم المنتج..."
                    className="min-h-10 w-full rounded-full border border-input bg-background px-3 pl-8 text-xs font-bold text-foreground"
                  />
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </header>

              {/* Category Chips */}
              <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                      categoryFilter === cat
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border bg-secondary/40 text-foreground hover:bg-secondary"
                    }`}
                  >
                    {cat === "all" ? "الكل" : cat}
                  </button>
                ))}
              </div>

              {/* Product Button Cards Grid */}
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 max-h-72 overflow-y-auto p-1">
                {filteredProducts.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => addToCart(prod)}
                    className="flex flex-col justify-between rounded-xl border border-border bg-background p-2.5 text-start transition-all hover:border-primary hover:bg-secondary/40"
                  >
                    <div>
                      <p className="line-clamp-2 text-xs font-bold text-foreground">{prod.name_ar}</p>
                      {prod.filling_ar && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                          {prod.filling_ar}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5">
                      <span className="text-xs font-extrabold text-primary">{jd(prod.price)}</span>
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
                    لا توجد منتجات مطابقة للبحث.
                  </p>
                )}
              </div>
            </section>

            {/* 3. Custom Cake Specs & Reference Photo Upload */}
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <header className="mb-4 flex items-center gap-2 border-b border-border pb-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <ImagePlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">
                    3. تفاصيل تصميم الكيك والملاحظات
                  </h3>
                  <p className="text-xs text-muted-foreground">الكتابة على الكيك، الكرت، وصورة التصميم المرفقة</p>
                </div>
              </header>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-foreground">
                    الكتابة على الكيك (Inscription)
                    <input
                      type="text"
                      value={inscription}
                      onChange={(e) => setInscription(e.target.value)}
                      placeholder="مثال: Happy Birthday Sarah"
                      className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground"
                    />
                  </label>

                  <label className="block text-xs font-bold text-foreground">
                    الكتابة على كرت الإهداء (Card Note)
                    <input
                      type="text"
                      value={cardNote}
                      onChange={(e) => setCardNote(e.target.value)}
                      placeholder="نص بطاقة المعايدة..."
                      className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-foreground">
                    ملاحظات للعميل / الطلب العامة
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أي طلب خاص من العميل..."
                      className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground"
                    />
                  </label>

                  <label className="block text-xs font-bold text-foreground">
                    ملاحظات داخلية للموظفين والمطبخ
                    <textarea
                      rows={2}
                      value={staffNotes}
                      onChange={(e) => setStaffNotes(e.target.value)}
                      placeholder="ملاحظات المطبخ الداخلية..."
                      className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground"
                    />
                  </label>
                </div>

                {/* Reference Image Attachment Drag-and-Drop */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    صورة تصميم الكيك المرفقة (Design Reference Photo)
                  </label>

                  {designImageUrl ? (
                    <div className="relative inline-block overflow-hidden rounded-2xl border border-primary p-2 bg-secondary/30">
                      <img
                        src={designImageUrl}
                        alt="صورة التصميم المرفقة"
                        className="h-32 w-auto max-w-full rounded-xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setDesignImageUrl(null)}
                        className="absolute top-3 left-3 grid h-7 w-7 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-md"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/20 p-4 text-center transition-all hover:bg-secondary/40">
                      <ImagePlus className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-xs font-bold text-foreground">
                        انقر أو اسحب صورة تصميم الكيكة هنا
                      </span>
                      <span className="text-[11px] text-muted-foreground">PNG, JPG حتى 5 ميجابايت</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Sticky Sidebar Column (Left Side in RTL - 5 columns) */}
          <div className="min-w-0 lg:col-span-5 xl:col-span-4">
            <aside className="sticky top-20 space-y-4">
              {/* Order Cart & Summary Card */}
              <div className="rounded-2xl border-2 border-primary/30 bg-card p-4 sm:p-5 shadow-md">
                <header className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
                  <h3 className="font-display text-base font-bold text-foreground">
                    سلة الطلب والحساب · Order Cart
                  </h3>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                    {cart.length} أصناف
                  </span>
                </header>

                {/* Selected Cart Items List */}
                <div className="mb-4 max-h-64 overflow-y-auto space-y-2 pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border bg-background p-2.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground line-clamp-1">{item.name}</p>
                          {item.options.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">{item.options.join(" · ")}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          className="text-destructive hover:opacity-80"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Quantity & Item Unit Price Edit */}
                      <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateCartItemQuantity(item.id, -1)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-input bg-secondary text-foreground hover:bg-secondary/80"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-6 text-center text-xs font-bold text-foreground">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartItemQuantity(item.id, 1)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-input bg-secondary text-foreground hover:bg-secondary/80"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground">سعر الحبة:</span>
                          <input
                            type="number"
                            step="0.25"
                            value={item.unitPrice}
                            onChange={(e) => updateCartItemPrice(item.id, Number(e.target.value))}
                            className="w-16 rounded-md border border-input px-1 py-0.5 text-center text-xs font-bold"
                          />
                          <span className="text-xs font-bold text-primary">
                            = {jd(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border">
                      السلة فارغة — اختر أصنافاً من الكتالوج
                    </p>
                  )}
                </div>

                {/* Financial Breakdown */}
                <div className="space-y-1.5 border-t border-border pt-3 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>المجموع الفرعي:</span>
                    <span className="font-bold text-foreground">{jd(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>أجرة التوصيل:</span>
                    <span className="font-bold text-foreground">{jd(deliveryFee)}</span>
                  </div>

                  {/* Discount percentage input */}
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      الخصم (%):
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(e.target.value)}
                        className="w-12 rounded-md border border-input px-1 text-center text-xs font-bold"
                      />
                    </span>
                    <span className="font-bold text-destructive">− {jd(discountAmount)}</span>
                  </div>

                  <div className="flex justify-between text-base font-extrabold text-foreground border-t border-border pt-2">
                    <span>الإجمالي الكلي:</span>
                    <span className="text-primary">{jd(grandTotal)}</span>
                  </div>
                </div>

                {/* Payment & Deposit Options */}
                <div className="mt-4 space-y-3 rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-foreground">
                      المبلغ المدفوع (العربون)
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={depositPaid}
                        onChange={(e) => setDepositPaid(e.target.value)}
                        className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2 text-center text-xs font-bold text-foreground"
                      />
                    </label>

                    <label className="block text-xs font-bold text-foreground">
                      طريقة الدفع
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-2 text-xs font-bold text-foreground"
                      >
                        <option value="cash">نقدي (Cash)</option>
                        <option value="cliq">كليك (CliQ)</option>
                        <option value="visa">فيزا (Card)</option>
                      </select>
                    </label>
                  </div>

                  {/* Remaining Balance Highlight */}
                  <div
                    className={`flex items-center justify-between rounded-lg p-2 text-xs font-bold ${
                      remainingBalance > 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-emerald-500/10 text-emerald-600"
                    }`}
                  >
                    <span>المتبقي على العميل:</span>
                    <span className="text-sm font-extrabold">{jd(remainingBalance)}</span>
                  </div>
                </div>

                {/* Primary & Secondary Action Buttons */}
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    disabled={createOrder.isPending || cart.length === 0}
                    onClick={handleSubmitOrder}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-sm transition-all hover:bg-primary/95 disabled:opacity-50 cursor-pointer"
                  >
                    {createOrder.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    <span>تأكيد وحفظ الطلب · Confirm Order</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={printKitchenSlipCurrent}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-xs font-bold text-foreground hover:bg-secondary"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>بون المطبخ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (cart.length === 0) {
                          toast.error("السلة فارغة");
                          return;
                        }
                        toast.info("سيتم طباعة الفاتورة بعد اعتماد وتأكيد الطلب");
                      }}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-xs font-bold text-foreground hover:bg-secondary"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      <span>فاتورة العميل</span>
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
