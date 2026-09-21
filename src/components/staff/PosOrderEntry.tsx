import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bike,
  Cake,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  FileText,
  Gift,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Loader2,
  MapPin,
  Minus,
  Percent,
  Phone,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Trash2,
  User,
  UserCheck,
  Utensils,
  X,
  Zap,
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

// Touch Category Tab Presets
const STANDARD_CATEGORIES = [
  { id: "all", label: "الكل", icon: "✨", keywords: [] },
  { id: "cakes", label: "كيك جاهز", icon: "🎂", keywords: ["كيك", "cake", "جاتو"] },
  { id: "cupcakes", label: "كب كيك", icon: "🧁", keywords: ["كب كيك", "cupcake"] },
  { id: "pastries", label: "معجنات", icon: "🥐", keywords: ["معجنات", "pastry", "كرواسون", "croissant"] },
  { id: "donuts", label: "دونات", icon: "🍩", keywords: ["دونات", "donut", "doughnut"] },
  { id: "drinks", label: "مشروبات", icon: "☕", keywords: ["مشروب", "عصير", "قهوة", "شاي", "drink", "coffee", "latte"] },
];

export function PosOrderEntry() {
  const queryClient = useQueryClient();
  const ordersFn = useServerFn(getSalesOrders);
  const createOrderFn = useServerFn(createSalesOrder);
  const storefront = useStorefrontContent();

  const existingOrders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => ordersFn({}),
  });

  // Top Level Operational Workstation Mode:
  // "quick" = Fast In-Store Cashier
  // "preorder" = Full Custom Cake & Scheduled Reservation Studio
  // "delivery" = Quick Delivery Intake
  const [stationMode, setStationMode] = useState<"quick" | "preorder" | "delivery">("quick");

  // Cart & Line Items
  const [cart, setCart] = useState<PosCartItem[]>([]);

  // Customer & Fulfilment State
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderName, setOrderName] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [senderPhone, setSenderPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  const [method, setMethod] = useState<"delivery" | "pickup">("pickup");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [requestedDate, setRequestedDate] = useState(todayIso());
  const [requestedTime, setRequestedTime] = useState(defaultTimeSlot());

  // Cake Customization Studio State
  const [inscription, setInscription] = useState("");
  const [cardNote, setCardNote] = useState("");
  const [designImageUrl, setDesignImageUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [staffNotes, setStaffNotes] = useState("");

  // Financials & Cashier State
  const [depositPaid, setDepositPaid] = useState<string>("0");
  const [discountPercent, setDiscountPercent] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [shouldPrintAfterCreate, setShouldPrintAfterCreate] = useState(false);

  // Quick Ad-hoc item entry
  const [showQuickCustomItem, setShowQuickCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");

  // Catalog search & filter
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedCategoryTab, setSelectedCategoryTab] = useState("all");

  // Mobile Bottom Sheet
  const [showMobileCheckout, setShowMobileCheckout] = useState(false);

  // Customer Auto-complete lookup
  const phoneSearch = useDebouncedValue(customerPhone, 200);
  const customerSuggestions = useMemo(() => {
    const q = phoneSearch.trim().toLowerCase();
    if (q.length < 3 || !existingOrders.data) return [];
    const map = new Map<string, { name: string; phone: string; address?: string | undefined; area?: string | undefined }>();
    for (const order of existingOrders.data) {
      if (order.customer_phone?.toLowerCase().includes(q)) {
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
      if (stationMode === "quick") setStationMode("delivery");
    }
    toast.info(`تم التعرف على العميل: ${sug.name}`);
  };

  // Calculations
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart],
  );

  const effectiveMethod = stationMode === "quick" ? "pickup" : stationMode === "delivery" ? "delivery" : method;

  const deliveryFee = useMemo(() => {
    if (effectiveMethod === "delivery" && area) {
      return feeForArea(area) ?? 0;
    }
    return 0;
  }, [effectiveMethod, area]);

  const discountAmount = useMemo(() => {
    const p = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);
    return (subtotal * p) / 100;
  }, [subtotal, discountPercent]);

  const grandTotal = useMemo(
    () => Math.max(subtotal + deliveryFee - discountAmount, 0),
    [subtotal, deliveryFee, discountAmount],
  );

  const depositVal = Number(depositPaid) || 0;
  const totalCartCount = useMemo(() => cart.reduce((sum, it) => sum + it.quantity, 0), [cart]);
  const remainingBalance = Math.max(grandTotal - depositVal, 0);

  // Quick cash bill shortcuts
  const handleQuickCash = (amount: number) => {
    setPaymentMethod("cash");
    setDepositPaid(String(amount));
  };

  // Instant Add to Cart
  const addToCart = (product: StorefrontProduct) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex >= 0) {
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      const newItem: PosCartItem = {
        id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId: product.id,
        name: product.name_ar,
        quantity: 1,
        unitPrice: product.price || 0,
        filling: product.filling_ar || undefined,
        options: product.filling_ar ? [`الحشوة: ${product.filling_ar}`] : [],
      };
      return [...prev, newItem];
    });

    if (typeof window !== "undefined" && window.navigator?.vibrate) {
      try { window.navigator.vibrate(25); } catch { /* ignore */ }
    }
  };

  const addCustomItemToCart = () => {
    const name = customItemName.trim();
    const price = Math.max(Number(customItemPrice) || 0, 0);
    if (!name) {
      toast.error("يرجى إدخال اسم البند");
      return;
    }
    const newItem: PosCartItem = {
      id: `pos-custom-${Date.now()}`,
      name,
      quantity: 1,
      unitPrice: price,
      options: ["بند يدوي مخصص"],
    };
    setCart((prev) => [...prev, newItem]);
    setCustomItemName("");
    setCustomItemPrice("");
    setShowQuickCustomItem(false);
    toast.success(`تمت إضافة: ${name}`);
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

  const clearCart = () => {
    setCart([]);
  };

  // Create Order Mutation
  const createOrder = useMutation({
    mutationFn: (input: CreateSalesOrderInput) => createOrderFn({ data: input }),
    onSuccess: (newOrder) => {
      queryClient.setQueryData<SalesOrder[]>(ORDERS_KEY, (curr) => [newOrder, ...(curr ?? [])]);
      toast.success(`تم إنشاء وتأكيد الطلب بنجاح ✅ (${orderLabel(newOrder.order_number, newOrder.staff_code)})`);

      if (shouldPrintAfterCreate) {
        try {
          printReceipt(newOrder);
        } catch (e) {
          console.error("Print error:", e);
        }
      }

      // Reset form
      setCart([]);
      setStationMode("quick");
      setCustomerPhone("");
      setCustomerName("");
      setIsGift(false);
      setSenderPhone("");
      setRecipientName("");
      setRecipientPhone("");
      setAddress("");
      setNotes("");
      setStaffNotes("");
      setCardNote("");
      setInscription("");
      setDesignImageUrl(null);
      setDepositPaid("0");
      setDiscountPercent("0");
      setOrderName("");
      setMethod("pickup");
      setShowMobileCheckout(false);
      setShouldPrintAfterCreate(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "حدث خطأ أثناء حفظ الطلب");
      setShouldPrintAfterCreate(false);
    },
  });

  const handleSubmitOrder = (andPrint = false) => {
    if (cart.length === 0) {
      toast.error("السلة فارغة! اختر أي صنف من القائمة لإضافته.");
      return;
    }

    const finalCustomerName =
      stationMode === "quick"
        ? (customerName.trim() || "زبون محلي Takeaway")
        : customerName.trim();

    const finalCustomerPhone =
      stationMode === "quick"
        ? (customerPhone.trim() || "0790000000")
        : customerPhone.trim();

    if (stationMode !== "quick") {
      if (!finalCustomerName) {
        toast.error("يرجى إدخال اسم العميل للطلب المسبق أو التوصيل");
        return;
      }
      if (!finalCustomerPhone) {
        toast.error("يرجى إدخال رقم هاتف العميل");
        return;
      }
      if (effectiveMethod === "delivery" && !area) {
        toast.error("يرجى اختيار منطقة التوصيل");
        return;
      }
    }

    setShouldPrintAfterCreate(andPrint);

    const payload: CreateSalesOrderInput = {
      customer_name: finalCustomerName,
      customer_phone: finalCustomerPhone,
      order_name: orderName.trim() || (stationMode === "quick" ? "كاشير محلي فوري" : undefined),
      sender_phone: isGift ? (senderPhone.trim() || finalCustomerPhone) : undefined,
      recipient_phone: isGift ? (recipientPhone.trim() || undefined) : undefined,
      method: effectiveMethod,
      area: effectiveMethod === "delivery" ? area : undefined,
      address: effectiveMethod === "delivery" ? address : undefined,
      requested_date: requestedDate,
      requested_time: requestedTime,
      notes: notes.trim() || undefined,
      staff_notes: staffNotes.trim() || undefined,
      inscription: inscription.trim() || undefined,
      card_note: cardNote.trim() || undefined,
      design_image_url: designImageUrl,
      payment_method: paymentMethod,
      deposit_paid: depositVal > 0 ? depositVal : grandTotal,
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

  const filteredProducts = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    const activeTabObj = STANDARD_CATEGORIES.find((c) => c.id === selectedCategoryTab);

    return catalogProducts.filter((p) => {
      const matchQuery =
        !q ||
        p.name_ar?.toLowerCase().includes(q) ||
        p.name_en?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q);

      if (!matchQuery) return false;

      if (selectedCategoryTab === "all") return true;

      const pCat = (p.category || "").toLowerCase();
      const pName = (p.name_ar || "").toLowerCase();

      if (activeTabObj && activeTabObj.keywords.length > 0) {
        return activeTabObj.keywords.some(
          (kw) => pCat.includes(kw) || pName.includes(kw),
        );
      }

      return p.category === selectedCategoryTab;
    });
  }, [catalogProducts, catalogQuery, selectedCategoryTab]);

  const getItemQtyInCart = (productId?: string | null) => {
    if (!productId) return 0;
    const item = cart.find((it) => it.productId === productId);
    return item ? item.quantity : 0;
  };

  const printKitchenSlipCurrent = () => {
    if (cart.length === 0) {
      toast.error("السلة فارغة");
      return;
    }
    const itemRows = cart
      .map(
        (it) =>
          `<tr><td style="padding:6px 0;border-bottom:1px dashed #ccc;"><b>${it.quantity} × ${esc(it.name)}</b>${it.options.length ? `<br><small style="color:#555;">${esc(it.options.join(" • "))}</small>` : ""}${it.notes ? `<br><small style="color:#8b4513;">ملاحظة: ${esc(it.notes)}</small>` : ""}</td></tr>`,
      )
      .join("");
    const body = `<h1 style="text-align:center;font-size:22px;margin-bottom:6px;font-weight:900;">Delish Bakery • بون المطبخ</h1>
<div style="text-align:center;font-size:13px;margin-bottom:8px;font-weight:bold;">التاريخ: ${requestedDate} | الوقت: ${requestedTime}</div>
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
<div style="font-size:14px;margin-bottom:4px;"><b>نوع الطلب:</b> ${stationMode === "quick" ? "كاشير محلي فوري (Takeaway)" : effectiveMethod === "delivery" ? `توصيل منازل (${esc(area || "عمان")})` : "حجز مسبق واستلام"}</div>
<div style="font-size:14px;margin-bottom:4px;"><b>العميل:</b> ${esc(customerName || (stationMode === "quick" ? "زبون محلي" : "بدون اسم"))}</div>
${orderName ? `<div style="font-size:13px;margin-bottom:4px;"><b>اسم الطلب:</b> ${esc(orderName)}</div>` : ""}
${inscription ? `<div style="font-size:16px;font-weight:bold;margin:8px 0;padding:6px;border:2px solid #000;background:#fff9e6;border-radius:4px;">الكتابة على الكيك: ${esc(inscription)}</div>` : ""}
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
<table style="width:100%;font-size:15px;border-collapse:collapse;">${itemRows}</table>
${notes ? `<div style="border-top:2px dashed #000;margin:6px 0;padding-top:4px;"><b>ملاحظات:</b> ${esc(notes)}</div>` : ""}
${staffNotes ? `<div style="border-top:1px dashed #777;margin:6px 0;padding-top:4px;color:#444;font-size:12px;"><b>ملاحظات الفريق:</b> ${esc(staffNotes)}</div>` : ""}`;
    printDocument("بون المطبخ", body);
  };

  return (
    <div dir="rtl" className="min-h-screen w-full select-none font-sans">
      {/* 1. MASTER WORKSTATION HEADER & MODE SWITCHER */}
      <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-3xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500 text-white shadow-sm shrink-0">
            <Cake className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-lg text-foreground leading-none">
                محطة المبيعات والكاشير المتكاملة
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                الكاشير جاهز
              </span>
            </div>
            <p className="text-xs font-bold text-muted-foreground mt-1">
              إدخال فوري للطلبات • تفصيل وحجز الكيك • حساب أجور التوصيل تلقائياً
            </p>
          </div>
        </div>

        {/* 3 Dedicated Operational Modes */}
        <div className="flex rounded-2xl bg-secondary/60 p-1.5 border border-border/70 self-center sm:self-auto w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => {
              setStationMode("quick");
              setMethod("pickup");
            }}
            className={`min-h-[44px] flex-1 sm:flex-initial px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              stationMode === "quick"
                ? "bg-card text-foreground shadow-sm border border-border/80 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="h-4 w-4 text-emerald-600" />
            <span>كاشير محلي فوري</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStationMode("preorder");
            }}
            className={`min-h-[44px] flex-1 sm:flex-initial px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              stationMode === "preorder"
                ? "bg-card text-primary shadow-sm border border-border/80 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Cake className="h-4 w-4 text-amber-600" />
            <span>حجز وتفصيل كيك</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStationMode("delivery");
              setMethod("delivery");
            }}
            className={`min-h-[44px] flex-1 sm:flex-initial px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              stationMode === "delivery"
                ? "bg-card text-blue-600 shadow-sm border border-border/80 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bike className="h-4 w-4 text-blue-600" />
            <span>طلب دليفري منازل</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN SPLIT WORKSPACE */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* RIGHT COLUMN (65%): Catalog & Interactive Cake Studio */}
        <div className="min-w-0 lg:col-span-7 xl:col-span-8 space-y-4">
          {/* If Station Mode is "preorder" or "delivery": Show Integrated Pre-order Studio Panel */}
          {stationMode !== "quick" && (
            <div className="rounded-3xl border-2 border-amber-500/30 bg-card p-4 sm:p-5 shadow-sm space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                    {stationMode === "delivery" ? <Bike className="h-5 w-5" /> : <Cake className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-foreground">
                      {stationMode === "delivery" ? "بيانات عنوان وموعد التوصيل" : "استوديو تفصيل الكيك والحجز المسبق"}
                    </h3>
                    <p className="text-[11px] font-bold text-muted-foreground">
                      أدخل تفاصيل العميل، موعد التسليم، والعبارة المكتوبة على الكيك
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                    {effectiveMethod === "delivery" ? "توصيل منازل 🛵" : "استلام من المحل 🏪"}
                  </span>
                </div>
              </div>

              {/* Grid 1: Customer Identity & Auto-Lookup */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <label className="block text-xs font-bold text-foreground mb-1">
                    رقم هاتف العميل *
                  </label>
                  <div className="relative">
                    <input
                      dir="ltr"
                      type="tel"
                      inputMode="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="079XXXXXXX"
                      className="min-h-[44px] w-full rounded-xl border border-input bg-background ps-3 pe-8 text-sm font-black text-foreground outline-none focus:border-primary"
                    />
                    <Phone className="absolute end-2.5 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>

                  {customerSuggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                      <p className="px-2.5 py-1 text-[10px] font-black text-muted-foreground">عملاء سابقون مسجلون:</p>
                      {customerSuggestions.map((sug) => (
                        <button
                          key={sug.phone}
                          type="button"
                          onClick={() => selectCustomerSuggestion(sug)}
                          className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs hover:bg-secondary cursor-pointer"
                        >
                          <span className="font-black text-foreground">{sug.name}</span>
                          <span dir="ltr" className="text-muted-foreground font-bold">{sug.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">اسم العميل *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: أم أحمد / فرح"
                    className="min-h-[44px] w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Gift Toggle Box */}
              <div className="rounded-2xl bg-secondary/40 p-3 border border-border/80">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-black text-foreground">
                  <input
                    type="checkbox"
                    checked={isGift}
                    onChange={(e) => setIsGift(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary accent-primary"
                  />
                  <span>🎁 هذا الطلب إهداء لشخص آخر (تحديد بيانات المستلم والمشتري)</span>
                </label>

                {isGift && (
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3 rounded-xl bg-card p-3 border border-border animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">اسم المستلم</label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="اسم المستلم"
                        className="min-h-[40px] w-full rounded-lg border border-input bg-background px-2.5 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">هاتف المستلم</label>
                      <input
                        dir="ltr"
                        type="tel"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="07XXXXXXXX"
                        className="min-h-[40px] w-full rounded-lg border border-input bg-background px-2.5 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">هاتف المشتري</label>
                      <input
                        dir="ltr"
                        type="tel"
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value)}
                        placeholder="هاتف المشتري"
                        className="min-h-[40px] w-full rounded-lg border border-input bg-background px-2.5 text-xs font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Zone & Address (If Delivery Mode) */}
              {(stationMode === "delivery" || method === "delivery") && (
                <div className="grid gap-3 sm:grid-cols-2 rounded-2xl bg-blue-500/5 p-3.5 border border-blue-500/20">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">منطقة التوصيل *</label>
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-xs font-black text-foreground outline-none focus:border-primary"
                    >
                      <option value="">— اختر المنطقة لحساب الأجرة —</option>
                      {DELIVERY_ZONES.map((zone) => (
                        <optgroup key={zone.labelEn} label={zone.labelAr}>
                          {zone.areas.map((a) => (
                            <option key={a} value={a}>
                              {a} — {zone.fee} د.أ
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <option value={OTHER_GOVERNORATES_AREA}>
                        {OTHER_GOVERNORATES_AREA} (٥–٨ د.أ)
                      </option>
                    </select>
                    {area && (
                      <span className="mt-1 block text-[11px] font-black text-blue-600">
                        {area === OTHER_GOVERNORATES_AREA
                          ? "أجرة التوصيل ٥–٨ د.أ (تحدد مع السائق)"
                          : `أجرة التوصيل المعتمدة: ${deliveryFee.toFixed(2)} د.أ`}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">العنوان التفصيلي</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="الشارع، البناية، الطابق، الشقة..."
                      className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* Schedule Dates & Time Slot */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">تاريخ التسليم</label>
                  <input
                    type="date"
                    value={requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">وقت التسليم</label>
                  <input
                    type="time"
                    value={requestedTime}
                    onChange={(e) => setRequestedTime(e.target.value)}
                    className="min-h-[42px] w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-foreground mb-1">اسم/مناسبة الطلب</label>
                  <input
                    type="text"
                    value={orderName}
                    onChange={(e) => setOrderName(e.target.value)}
                    placeholder="تخرج دانة / عيد ميلاد تميم..."
                    className="min-h-[42px] w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* HIGHLIGHTED CAKE INSCRIPTION STUDIO (شريط الكتابة على الكيك) */}
              <div className="rounded-2xl border-2 border-amber-400 bg-amber-500/10 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <span>✍️</span>
                    <span>الكتابة المطلوبة على الكيكة (Inscription Ribbon):</span>
                  </label>
                  <span className="text-[10px] font-black text-amber-700 bg-card px-2 py-0.5 rounded-full border border-amber-300">
                    تظهر بوضوح للمطبخ
                  </span>
                </div>
                <input
                  type="text"
                  value={inscription}
                  onChange={(e) => setInscription(e.target.value)}
                  placeholder="مثال: Happy Birthday Sarah / ألف مبروك التخرج..."
                  className="min-h-[46px] w-full rounded-xl border-2 border-amber-400 bg-card px-3 text-sm font-black text-foreground outline-none focus:border-amber-600"
                />
              </div>

              {/* Card Note, Design Image URL & Notes */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">💌 عبارة كرت الإهداء</label>
                  <input
                    type="text"
                    value={cardNote}
                    onChange={(e) => setCardNote(e.target.value)}
                    placeholder="نص كرت المعايدة المرفق..."
                    className="min-h-[40px] w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">🖼️ رابط صورة التصميم</label>
                  <input
                    type="url"
                    value={designImageUrl || ""}
                    onChange={(e) => setDesignImageUrl(e.target.value || null)}
                    placeholder="https://..."
                    className="min-h-[40px] w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground"
                  />
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">💬 ملاحظات العميل</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="طلبات العميل الخاصة..."
                    className="min-h-[40px] w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">🔒 ملاحظات الفريق السرية</label>
                  <input
                    type="text"
                    value={staffNotes}
                    onChange={(e) => setStaffNotes(e.target.value)}
                    placeholder="ملاحظات خاصة للمطبخ أو الكاشير..."
                    className="min-h-[40px] w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CATALOG TOUCH SEARCH & CATEGORY BAR */}
          <div className="rounded-3xl border border-border/80 bg-card p-3.5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="search"
                  inputMode="search"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="ابحث عن كيكة، صنف، نكهة، أو قسم..."
                  className="min-h-[46px] w-full rounded-2xl border border-input bg-background pe-10 ps-3.5 text-sm font-bold text-foreground outline-none focus:border-primary"
                />
                <Search className="absolute end-3.5 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                {catalogQuery && (
                  <button
                    type="button"
                    onClick={() => setCatalogQuery("")}
                    className="absolute end-10 top-3 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Quick Custom Item Toggle Button */}
              <button
                type="button"
                onClick={() => setShowQuickCustomItem((v) => !v)}
                className="min-h-[46px] px-4 rounded-2xl border border-primary/30 bg-primary/10 text-primary text-xs font-black hover:bg-primary/20 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>+ بند مخصص سريع</span>
              </button>
            </div>

            {/* Quick Custom Item Drawer */}
            {showQuickCustomItem && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 animate-in fade-in duration-150 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-primary">
                    إضافة بند مخصص مباشر للسلة (كيك تفصيل، دفعة خاصة، رسوم إضافية):
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuickCustomItem(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    placeholder="اسم الصنف أو الكيك المخصص..."
                    className="sm:col-span-7 min-h-[42px] rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={customItemPrice}
                    onChange={(e) => setCustomItemPrice(e.target.value)}
                    placeholder="السعر (د.أ)..."
                    className="sm:col-span-3 min-h-[42px] rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={addCustomItemToCart}
                    className="sm:col-span-2 min-h-[42px] rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-xs hover:opacity-90 cursor-pointer"
                  >
                    إضافة للسلة ✓
                  </button>
                </div>
              </div>
            )}

            {/* Category Scroll Strip */}
            <div
              className="no-scrollbar flex gap-2 overflow-x-auto overscroll-x-contain py-1"
              role="tablist"
            >
              {STANDARD_CATEGORIES.map((cat) => {
                const isActive = selectedCategoryTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedCategoryTab(cat.id)}
                    className={`min-h-[42px] px-4 rounded-xl text-xs font-black shrink-0 whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm scale-102"
                        : "border border-border/80 bg-background text-foreground hover:bg-secondary/70"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PRODUCT CARDS TOUCH GRID */}
          {storefront.isLoading ? (
            <div className="grid h-64 place-items-center rounded-3xl border border-border bg-card">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-bold text-muted-foreground">جاري تحميل قائمة المنتجات...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="grid h-52 place-items-center rounded-3xl border border-border bg-card p-6 text-center">
              <div>
                <Search className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="font-black text-sm text-muted-foreground">
                  لا توجد أصناف مطابقة للبحث أو القسم المختار
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogQuery("");
                    setSelectedCategoryTab("all");
                  }}
                  className="mt-2 text-xs text-primary font-bold hover:underline cursor-pointer"
                >
                  إعادة ضبط الفلتر
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((prod) => {
                const qty = getItemQtyInCart(prod.id);
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => addToCart(prod)}
                    className={`group relative min-h-[120px] rounded-3xl border p-3 text-start transition-all duration-150 flex flex-col justify-between cursor-pointer active:scale-96 ${
                      qty > 0
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border/80 bg-card hover:border-primary/40 hover:bg-secondary/20 shadow-2xs"
                    }`}
                  >
                    {qty > 0 && (
                      <span className="absolute -top-2 -left-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-md animate-in zoom-in-50">
                        {qty}
                      </span>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-black text-xs text-foreground line-clamp-2 leading-tight">
                          {prod.name_ar}
                        </h3>
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name_ar}
                            className="h-8 w-8 rounded-xl object-cover border border-border/60 shrink-0"
                          />
                        ) : (
                          <span className="text-base shrink-0">🍰</span>
                        )}
                      </div>
                      {prod.filling_ar && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          حشوة: {prod.filling_ar}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-border/40">
                      <span className="font-black text-sm text-primary">
                        {jd(prod.price || 0)}
                      </span>
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-secondary/80 text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-2xs">
                        <Plus className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* LEFT COLUMN (35%): Sticky Cashier Checkout & Billing Station */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
          <div className="sticky top-16 rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col justify-between min-h-[75vh]">
            {/* Cashier Cart Header */}
            <div className="border-b border-border/80 p-3.5 bg-card/60">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-black text-sm text-foreground flex items-center gap-1.5 leading-none">
                      سلة الطلب والمحاسبة
                    </span>
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {totalCartCount} قطعة مختارة
                    </span>
                  </div>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs text-rose-600 hover:text-rose-700 font-black inline-flex items-center gap-1 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    تفريغ
                  </button>
                )}
              </div>

              {/* Mode Banner Indicator */}
              <div className="mt-2.5 flex items-center justify-between rounded-xl bg-secondary/60 p-2 text-xs border border-border/60">
                <span className="font-bold text-foreground">
                  الوضع الحالي:{" "}
                  <strong>
                    {stationMode === "quick"
                      ? "كاشير محلي فوري ⚡"
                      : stationMode === "delivery"
                        ? "دليفري منازل 🛵"
                        : "حجز كيك مسبق 🎂"}
                  </strong>
                </span>
                <span className="text-[10px] text-muted-foreground font-bold">
                  {effectiveMethod === "delivery" ? area || "عمان" : "استلام بالمحل"}
                </span>
              </div>
            </div>

            {/* Cart Line Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[35vh]">
              {cart.length === 0 ? (
                <div className="grid h-40 place-items-center text-center p-4">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary/80 text-muted-foreground/50 mb-2">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-black text-foreground">السلة فارغة حالياً</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      المس أي صنف من القائمة لإضافته بنقرة واحدة
                    </p>
                  </div>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card p-2.5 shadow-2xs hover:border-primary/40 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-xs text-foreground truncate leading-tight">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-bold text-primary">{jd(item.unitPrice)}</span>
                        <span>• الإجمالي: <strong>{jd(item.unitPrice * item.quantity)}</strong></span>
                      </div>
                      {item.options.length > 0 && (
                        <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                          {item.options.join(" • ")}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartItemQuantity(item.id, -1)}
                        aria-label="إنقاص"
                        className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-secondary/60 text-foreground hover:bg-secondary active:scale-90 transition cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center font-black text-sm text-foreground">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartItemQuantity(item.id, 1)}
                        aria-label="زيادة"
                        className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary hover:bg-primary/20 active:scale-90 transition cursor-pointer font-black"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        aria-label="حذف"
                        className="grid h-9 w-8 place-items-center rounded-xl text-rose-500 hover:bg-rose-50 active:scale-90 transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Financials & Billing Terminal */}
            <div className="border-t border-border/80 bg-card p-3.5 space-y-3">
              {/* Discount & Deposit Controls */}
              <div className="rounded-2xl bg-secondary/40 p-2.5 border border-border/80 space-y-2">
                {/* Discount Pills */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-muted-foreground shrink-0 flex items-center gap-1">
                    <Percent className="h-3 w-3 text-primary" />
                    الخصم:
                  </span>
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {["0", "5", "10", "15"].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountPercent(pct)}
                        className={`min-h-[28px] px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          discountPercent === pct
                            ? "bg-primary text-primary-foreground shadow-2xs font-black"
                            : "bg-card border border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      placeholder="%"
                      className="h-7 w-12 rounded-lg border border-input bg-card px-1 text-center text-xs font-black text-foreground"
                    />
                  </div>
                </div>

                {/* Deposit / Paid Amount */}
                <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
                  <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                    <Coins className="h-3 w-3 text-amber-500" />
                    المدفوع / العربون:
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={depositPaid}
                      onChange={(e) => setDepositPaid(e.target.value)}
                      placeholder="0"
                      className="h-7 w-20 rounded-lg border border-input bg-card px-2 text-start text-xs font-black text-foreground"
                    />
                    <span className="text-[11px] text-muted-foreground font-bold">د.أ</span>
                  </div>
                </div>

                {/* Quick Bills Shortcuts */}
                <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => handleQuickCash(grandTotal)}
                    className="text-[10px] font-black px-2 py-0.5 rounded-md bg-card border border-border hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                  >
                    مطابق ({jd(grandTotal)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(10)}
                    className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-card border border-border hover:bg-secondary cursor-pointer"
                  >
                    10 د.أ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(20)}
                    className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-card border border-border hover:bg-secondary cursor-pointer"
                  >
                    20 د.أ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(50)}
                    className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-card border border-border hover:bg-secondary cursor-pointer"
                  >
                    50 د.أ
                  </button>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span className="font-bold text-foreground">{jd(subtotal)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-blue-600 font-bold">
                    <span>أجور التوصيل:</span>
                    <span>+{jd(deliveryFee)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>الخصم ({discountPercent}%):</span>
                    <span>- {jd(discountAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border/80 pt-1.5 text-base font-black text-foreground">
                  <span>الإجمالي النهائي:</span>
                  <span className="text-primary text-xl font-black">{jd(grandTotal)}</span>
                </div>
                {depositVal > 0 && depositVal < grandTotal && (
                  <div className="flex justify-between text-xs text-rose-600 font-black pt-0.5">
                    <span>المتبقي عند الاستلام:</span>
                    <span>{jd(remainingBalance)}</span>
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`min-h-[46px] rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    paymentMethod === "cash"
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                      : "bg-background border-border text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Store className="h-4 w-4" />
                  <span>كاش نقدي</span>
                  {paymentMethod === "cash" && <Check className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cliq")}
                  className={`min-h-[46px] rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    paymentMethod === "cliq" || paymentMethod === "visa"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-background border-border text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>كليك / فيزا</span>
                  {(paymentMethod === "cliq" || paymentMethod === "visa") && <Check className="h-4 w-4" />}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={cart.length === 0 || createOrder.isPending}
                  onClick={() => handleSubmitOrder(true)}
                  className="w-full min-h-[50px] rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-md hover:opacity-95 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  {createOrder.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Printer className="h-5 w-5" />
                  )}
                  <span>تأكيد وطباعة الفاتورة 🖨️</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={cart.length === 0 || createOrder.isPending}
                    onClick={() => handleSubmitOrder(false)}
                    className="flex-1 min-h-[46px] rounded-xl border border-border bg-card text-foreground font-bold text-xs hover:bg-secondary/60 active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    تأكيد فقط
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={printKitchenSlipCurrent}
                    title="طباعة بون المطبخ"
                    className="min-h-[46px] px-3.5 rounded-xl border border-border bg-card text-foreground font-bold text-xs hover:bg-secondary/60 active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <FileText className="h-4 w-4 text-amber-600" />
                    بون مطبخ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MOBILE BOTTOM STICKY BAR */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-md p-3 shadow-2xl pb-safe">
        <button
          type="button"
          onClick={() => setShowMobileCheckout(true)}
          className="w-full min-h-[52px] rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-lg flex items-center justify-between px-4 active:scale-98 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span>{totalCartCount} أصناف</span>
            <span className="opacity-60">|</span>
            <span>{jd(grandTotal)}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-black">
            الدفع والمحاسبة ⬅️
          </span>
        </button>
      </div>

      {/* 4. MOBILE SLIDE-UP CHECKOUT SHEET */}
      {showMobileCheckout && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowMobileCheckout(false)}
          />
          <div className="relative z-10 max-h-[88vh] w-full rounded-t-3xl border-t border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250">
            <div className="flex items-center justify-between p-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="font-black text-sm text-foreground">سلة الطلب والدفع</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileCheckout(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground hover:bg-secondary cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Mobile cart list */}
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-border/80 bg-secondary/30 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-xs text-foreground truncate">{item.name}</h4>
                      <p className="text-[11px] font-bold text-primary">{jd(item.unitPrice * item.quantity)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateCartItemQuantity(item.id, -1)}
                        className="h-8 w-8 grid place-items-center rounded-lg bg-card border border-border"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center font-black text-xs">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartItemQuantity(item.id, 1)}
                        className="h-8 w-8 grid place-items-center rounded-lg bg-primary/20 text-primary"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Financials in mobile sheet */}
              <div className="rounded-2xl bg-secondary/40 p-3 space-y-2 border border-border/80 text-xs">
                <div className="flex justify-between">
                  <span>المجموع:</span>
                  <span className="font-bold">{jd(subtotal)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-blue-600 font-bold">
                    <span>أجور التوصيل:</span>
                    <span>+{jd(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-base border-t border-border pt-2 text-foreground">
                  <span>الإجمالي:</span>
                  <span className="text-primary">{jd(grandTotal)}</span>
                </div>
              </div>

              {/* Checkout button */}
              <button
                type="button"
                disabled={cart.length === 0 || createOrder.isPending}
                onClick={() => handleSubmitOrder(true)}
                className="w-full min-h-[50px] rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-md flex items-center justify-center gap-2"
              >
                <Printer className="h-5 w-5" />
                <span>تأكيد وطباعة الفاتورة 🖨️</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}