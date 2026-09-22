import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bike,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  FileText,
  Gift,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Layers,
  Loader2,
  Minus,
  Percent,
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
  UserCheck,
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

  // Mode: "takeaway" (Instant cashier) vs "preorder" (Reservation / Delivery)
  const [orderMode, setOrderMode] = useState<"takeaway" | "preorder">("takeaway");
  const [showPreorderModal, setShowPreorderModal] = useState(false);
  const [showMobileCartSheet, setShowMobileCartSheet] = useState(false);
  const [shouldPrintAfterCreate, setShouldPrintAfterCreate] = useState(false);

  // Quick custom item on-the-fly
  const [showCustomItemBox, setShowCustomItemBox] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");

  // Customer & Fulfillment Form State
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [senderPhone, setSenderPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  const [method, setMethod] = useState<"delivery" | "pickup">("pickup");
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
  const [selectedCategoryTab, setSelectedCategoryTab] = useState("all");

  // Customer Auto-complete lookup
  const phoneSearch = useDebouncedValue(customerPhone, 200);
  const customerSuggestions = useMemo(() => {
    const q = phoneSearch.trim().toLowerCase();
    if (q.length < 3 || !existingOrders.data) return [];
    const map = new Map<string, { name: string; phone: string; address?: string; area?: string }>();
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

  const selectCustomerSuggestion = (sug: { name: string; phone: string; address?: string; area?: string }) => {
    setCustomerName(sug.name);
    setCustomerPhone(sug.phone);
    if (sug.address) setAddress(sug.address);
    if (sug.area) {
      setArea(sug.area);
      setMethod("delivery");
    }
    toast.info(`تم اختيار العميل: ${sug.name}`);
  };

  // Calculated Totals
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart],
  );

  const deliveryFee = useMemo(
    () => (orderMode === "preorder" && method === "delivery" && area ? (feeForArea(area) ?? 0) : 0),
    [orderMode, method, area],
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
  const totalCartCount = useMemo(() => cart.reduce((sum, it) => sum + it.quantity, 0), [cart]);
  const remainingBalance = Math.max(grandTotal - depositVal, 0);

  // Quick cash payment denomination buttons helper
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
    setShowCustomItemBox(false);
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
      toast.success(`تم حفظ وإنشاء الطلب بنجاح ✅ (${orderLabel(newOrder.order_number, newOrder.staff_code)})`);

      if (shouldPrintAfterCreate) {
        try {
          printReceipt(newOrder);
        } catch (e) {
          console.error("Print error:", e);
        }
      }

      // Reset form
      setCart([]);
      setOrderMode("takeaway");
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
      setShowPreorderModal(false);
      setShowMobileCartSheet(false);
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
      orderMode === "takeaway"
        ? (customerName.trim() || "زبون محلي Takeaway")
        : customerName.trim();

    const finalCustomerPhone =
      orderMode === "takeaway"
        ? (customerPhone.trim() || "0790000000")
        : customerPhone.trim();

    if (orderMode === "preorder") {
      if (!finalCustomerName) {
        setShowPreorderModal(true);
        toast.error("يرجى إدخال اسم العميل للحجز المسبق / التوصيل");
        return;
      }
      if (!finalCustomerPhone) {
        setShowPreorderModal(true);
        toast.error("يرجى إدخال رقم هاتف العميل");
        return;
      }
      if (method === "delivery" && !area) {
        setShowPreorderModal(true);
        toast.error("يرجى اختيار منطقة التوصيل لحساب الأجرة");
        return;
      }
    }

    setShouldPrintAfterCreate(andPrint);

    const payload: CreateSalesOrderInput = {
      customer_name: finalCustomerName,
      customer_phone: finalCustomerPhone,
      order_name: orderName.trim() || (orderMode === "takeaway" ? "طلب كاشير محلي" : undefined),
      sender_phone: isGift ? (senderPhone.trim() || finalCustomerPhone) : undefined,
      recipient_phone: isGift ? (recipientPhone.trim() || undefined) : undefined,
      method: orderMode === "takeaway" ? "pickup" : method,
      area: orderMode === "preorder" && method === "delivery" ? area : undefined,
      address: orderMode === "preorder" && method === "delivery" ? address : undefined,
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
    const body = `<h1 style="text-align:center;font-size:20px;margin-bottom:6px;font-weight:900;">Delish Bakery • بون المطبخ</h1>
<div style="text-align:center;font-size:13px;margin-bottom:8px;font-weight:bold;">التاريخ: ${requestedDate} | الوقت: ${requestedTime}</div>
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
<div style="font-size:14px;margin-bottom:4px;"><b>النوع:</b> ${orderMode === "takeaway" ? "طلب محلي فوري (Takeaway)" : (method === "delivery" ? `توصيل منازل (${esc(area || "عمان")})` : "حجز مسبق واستلام")}</div>
<div style="font-size:14px;margin-bottom:4px;"><b>العميل:</b> ${esc(customerName || (orderMode === "takeaway" ? "زبون محلي" : "بدون اسم"))}</div>
${orderName ? `<div style="font-size:13px;margin-bottom:4px;"><b>اسم الطلب:</b> ${esc(orderName)}</div>` : ""}
${inscription ? `<div style="font-size:16px;font-weight:bold;margin:8px 0;padding:6px;border:2px solid #000;background:#fff9e6;border-radius:4px;">الكتابة على الكيك: ${esc(inscription)}</div>` : ""}
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
<table style="width:100%;font-size:15px;border-collapse:collapse;">${itemRows}</table>
${notes ? `<div style="border-top:2px dashed #000;margin:6px 0;padding-top:4px;"><b>ملاحظات:</b> ${esc(notes)}</div>` : ""}
${staffNotes ? `<div style="border-top:1px dashed #777;margin:6px 0;padding-top:4px;color:#444;font-size:12px;"><b>ملاحظات الفريق:</b> ${esc(staffNotes)}</div>` : ""}`;
    printDocument("بون المطبخ", body);
  };

  // Sticky Cart Content Component
  const CartContent = ({ isMobileSheet = false }: { isMobileSheet?: boolean }) => (
    <div className="flex h-full flex-col justify-between select-none">
      {/* Top Header inside Cart */}
      <div className="border-b border-border/70 p-3.5 bg-card/60 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <span className="font-black text-sm text-foreground flex items-center gap-1.5 leading-none">
                سلة الطلب والدفع
              </span>
              <span className="text-[11px] font-bold text-muted-foreground">
                {totalCartCount} قطعة مُختارة
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

        {/* Order Mode Switch: Instant Takeaway vs Pre-order */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-secondary/70 rounded-2xl border border-border/60">
          <button
            type="button"
            onClick={() => {
              setOrderMode("takeaway");
              setMethod("pickup");
            }}
            className={`min-h-[44px] rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              orderMode === "takeaway"
                ? "bg-card text-foreground shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Store className="h-4 w-4 text-emerald-600 shrink-0" />
            طلب كاشير محلي
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderMode("preorder");
              setShowPreorderModal(true);
            }}
            className={`min-h-[44px] rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              orderMode === "preorder"
                ? "bg-card text-primary shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bike className="h-4 w-4 text-amber-600 shrink-0" />
            حجز مسبق / توصيل
            {customerName && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
          </button>
        </div>

        {/* Pre-order banner details summary if filled */}
        {orderMode === "preorder" && (
          <div className="mt-2.5 flex items-center justify-between rounded-xl bg-amber-500/10 p-2.5 text-xs border border-amber-500/20 animate-in fade-in duration-150">
            <div className="min-w-0 pr-1">
              <span className="font-black text-foreground block truncate">
                {customerName ? `${customerName} • ` : "عميل غير محدد • "}
                {method === "delivery" ? `توصيل (${area || "عمان"})` : "استلام من المحل"}
              </span>
              <span className="text-[10px] text-muted-foreground font-bold">
                ⏰ {requestedDate} | {requestedTime}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPreorderModal(true)}
              className="text-primary font-black hover:underline cursor-pointer shrink-0 text-[11px] px-2 py-1 rounded-lg bg-card border border-border/60"
            >
              تعديل ✏️
            </button>
          </div>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[36vh] lg:max-h-[38vh]">
        {cart.length === 0 ? (
          <div className="grid h-44 place-items-center text-center p-4">
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
              className="flex items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card p-2.5 shadow-2xs transition-all hover:border-primary/40"
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

      {/* Financials, Discounts, Payment & Action Buttons */}
      <div className="border-t border-border/80 bg-card p-3 space-y-3 pb-safe">
        {/* Quick Discount & Deposit controls */}
        <div className="rounded-2xl bg-secondary/40 p-2.5 border border-border/80 space-y-2">
          {/* Discount Selector */}
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
                aria-label="نسبة الخصم المخصصة"
                className="h-7 w-12 rounded-lg border border-input bg-card px-1 text-center text-xs font-black text-foreground"
              />
            </div>
          </div>

          {/* Deposit & Cash Quick Buttons */}
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
                aria-label="الدفعة الأولى"
                className="h-7 w-20 rounded-lg border border-input bg-card px-2 text-start text-xs font-black text-foreground"
              />
              <span className="text-[11px] text-muted-foreground font-bold">د.أ</span>
            </div>
          </div>

          {/* Fast Cash Note Shortcut Pills */}
          <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
            <button
              type="button"
              onClick={() => handleQuickCash(grandTotal)}
              className="text-[10px] font-black px-2 py-0.5 rounded-md bg-card border border-border hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
            >
              كامل المبلغ ({jd(grandTotal)})
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

        {/* Invoice Summary Figures */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>المجموع الفرعي:</span>
            <span className="font-bold text-foreground">{jd(subtotal)}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="flex justify-between text-amber-600 font-bold">
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
            <span>كاش نقد</span>
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

        {/* Checkout Execution Buttons */}
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
  );

  return (
    <div dir="rtl" className="min-h-screen min-w-0 bg-background pb-24 lg:pb-12 font-sans">
      <div className="mx-auto max-w-7xl px-2 sm:px-4">
        {/* Top POS Header Strip */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-border/80 bg-card p-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black text-base text-foreground sm:text-lg flex items-center gap-2">
                نقطة البيع والكاشير • Delish POS
              </h2>
              <p className="text-[11px] font-bold text-muted-foreground">
                شاشة لمس سريعة ومريحة • إضافة بنقرة واحدة وحساب فوري
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCustomItemBox((v) => !v)}
              className="min-h-[44px] px-3.5 rounded-xl border border-border bg-secondary/50 text-foreground text-xs font-bold hover:bg-secondary transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4 text-primary" />
              <span>+ بند مخصص سريع</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOrderMode("preorder");
                setShowPreorderModal(true);
              }}
              className="min-h-[44px] px-3.5 rounded-xl border border-primary/40 bg-primary/10 text-primary text-xs font-black hover:bg-primary/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Bike className="h-4 w-4" />
              {orderMode === "preorder" ? "تعديل الحجز والتوصيل ✏️" : "+ حجز مسبق / توصيل"}
            </button>
          </div>
        </div>

        {/* Quick Custom Item Drawer/Box if toggled */}
        {showCustomItemBox && (
          <div className="mb-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-primary flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                إضافة بند يدوي مخصص للسلة (كيك تفصيل خاص، رسوم إضافية، صندوق هدية)
              </span>
              <button
                type="button"
                onClick={() => setShowCustomItemBox(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                placeholder="اسم البند أو التفصيل..."
                className="sm:col-span-7 min-h-[44px] rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={customItemPrice}
                onChange={(e) => setCustomItemPrice(e.target.value)}
                placeholder="السعر (د.أ)..."
                className="sm:col-span-3 min-h-[44px] rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={addCustomItemToCart}
                className="sm:col-span-2 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-xs hover:opacity-90 cursor-pointer transition"
              >
                إضافة للسلة ✓
              </button>
            </div>
          </div>
        )}

        {/* 2-Column Split: Landscape Tablet & Desktop (Right: 65% Catalog | Left: 35% Sticky Cart) */}
        <div className="grid gap-4 lg:grid-cols-12">
          {/* RIGHT COLUMN: Fast Touch Register Catalog */}
          <div className="min-w-0 lg:col-span-7 xl:col-span-8 space-y-3">
            {/* Search & Horizontal Touch-Scroll Category Tabs */}
            <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-xs space-y-2.5">
              <div className="relative flex items-center">
                <input
                  type="search"
                  inputMode="search"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="ابحث عن كيكة، صنف، نكهة، أو قسم..."
                  className="min-h-[46px] w-full rounded-xl border border-input bg-background pe-10 ps-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                />
                <Search className="absolute end-3 h-5 w-5 text-muted-foreground pointer-events-none" />
                {catalogQuery && (
                  <button
                    type="button"
                    onClick={() => setCatalogQuery("")}
                    className="absolute end-10 p-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Horizontal Scrollable Category Tabs */}
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
                      className={`min-h-[44px] px-4 rounded-xl text-xs font-black shrink-0 whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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

            {/* Product Cards Grid */}
            {storefront.isLoading ? (
              <div className="grid h-64 place-items-center rounded-2xl border border-border bg-card">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs font-bold text-muted-foreground">جاري تحميل قائمة المنتجات...</p>
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="grid h-52 place-items-center rounded-2xl border border-border bg-card p-6 text-center">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredProducts.map((prod) => {
                  const qty = getItemQtyInCart(prod.id);
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => addToCart(prod)}
                      className={`group relative min-h-[118px] rounded-2xl border p-3 text-start transition-all duration-150 flex flex-col justify-between cursor-pointer active:scale-96 ${
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
                              className="h-8 w-8 rounded-lg object-cover border border-border/60 shrink-0"
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

          {/* LEFT COLUMN: Sticky Cart Container (Desktop & Tablet Landscape) */}
          <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
            <div className="sticky top-16 rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <CartContent />
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE & PORTRAIT TABLET STICKY BOTTOM BAR */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-md p-3 shadow-2xl pb-safe">
        <button
          type="button"
          onClick={() => setShowMobileCartSheet(true)}
          className="w-full min-h-[52px] rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-lg flex items-center justify-between px-4 active:scale-98 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span>{totalCartCount} أصناف</span>
            <span className="opacity-60">|</span>
            <span>{jd(grandTotal)}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-black">
            الدفع والسلة ⬅️
          </span>
        </button>
      </div>

      {/* MOBILE BOTTOM SHEET FOR CART */}
      {showMobileCartSheet && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowMobileCartSheet(false)}
          />
          <div className="relative z-10 max-h-[85vh] w-full rounded-t-3xl border-t border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="font-black text-sm text-foreground">سلة الطلب والدفع</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileCartSheet(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground hover:bg-secondary cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <CartContent isMobileSheet />
            </div>
          </div>
        </div>
      )}

      {/* PRE-ORDER & DELIVERY MODAL (3 Structured Ergonomic Cards) */}
      {showPreorderModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 sm:p-4 animate-in fade-in duration-150 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Bike className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-foreground">
                    تفاصيل الحجز المسبق والتوصيل
                  </h3>
                  <p className="text-[11px] font-bold text-muted-foreground">
                    بيانات العميل، المنطقة، موعد التسليم، وتفاصيل الكيكة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreorderModal(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground hover:bg-secondary cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* CARD 1: Customer & Gift Details */}
              <div className="rounded-2xl border border-border/80 bg-secondary/20 p-3.5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-primary border-b border-border/60 pb-2">
                  <span>👤</span>
                  <span>1. بيانات العميل والإهداء</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="relative">
                    <label className="block text-xs font-bold text-foreground mb-1">
                      رقم هاتف العميل *
                    </label>
                    <input
                      dir="ltr"
                      type="tel"
                      inputMode="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="079XXXXXXX"
                      className="min-h-[46px] w-full rounded-xl border border-input bg-card px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                    {customerSuggestions.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card p-1 shadow-lg">
                        <p className="px-2 py-1 text-[11px] font-bold text-muted-foreground">عملاء سابقون:</p>
                        {customerSuggestions.map((sug) => (
                          <button
                            key={sug.phone}
                            type="button"
                            onClick={() => selectCustomerSuggestion(sug)}
                            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs hover:bg-secondary cursor-pointer"
                          >
                            <span className="font-bold">{sug.name}</span>
                            <span dir="ltr">{sug.phone}</span>
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
                      placeholder="مثال: أم أحمد / رانيا"
                      className="min-h-[46px] w-full rounded-xl border border-input bg-card px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">اسم أو تصنيف الطلب (اختياري)</label>
                  <input
                    type="text"
                    value={orderName}
                    onChange={(e) => setOrderName(e.target.value)}
                    placeholder="مثال: كيكة تخرج دانة / عيد ميلاد تميم"
                    className="min-h-[46px] w-full rounded-xl border border-input bg-card px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                  />
                </div>

                {/* Gift Option Toggle */}
                <div className="pt-1.5 border-t border-border/40">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-foreground py-1">
                    <input
                      type="checkbox"
                      checked={isGift}
                      onChange={(e) => setIsGift(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary accent-primary"
                    />
                    <span>🎁 هذا الطلب إهداء لطرف آخر (بيانات مستلم ومشتري مختلفة)</span>
                  </label>

                  {isGift && (
                    <div className="mt-2 grid gap-2.5 sm:grid-cols-3 rounded-xl bg-card p-3 border border-border animate-in fade-in duration-150">
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
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">هاتف المشتري (المرسل)</label>
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
              </div>

              {/* CARD 2: Fulfillment, Area & Schedule */}
              <div className="rounded-2xl border border-border/80 bg-secondary/20 p-3.5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-primary border-b border-border/60 pb-2">
                  <span>🛵</span>
                  <span>2. طريقة الاستلام وموعد التسليم</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod("pickup")}
                    className={`min-h-[46px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border cursor-pointer transition-all ${
                      method === "pickup"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs font-black"
                        : "bg-card border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Store className="h-4 w-4" />
                    <span>استلام من المحل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("delivery")}
                    className={`min-h-[46px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border cursor-pointer transition-all ${
                      method === "delivery"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs font-black"
                        : "bg-card border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Bike className="h-4 w-4" />
                    <span>توصيل لمنزل العميل</span>
                  </button>
                </div>

                {method === "delivery" && (
                  <div className="space-y-2 rounded-xl bg-card p-3 border border-border">
                    <label className="block text-xs font-bold text-foreground">منطقة التوصيل *</label>
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="min-h-[46px] w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    >
                      <option value="">اختر المنطقة لحساب الأجرة تلقائياً...</option>
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

                    <label className="block text-xs font-bold text-foreground pt-1">العنوان التفصيلي</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="الشارع، البناية، الطابق، رقم الشقة أو علامة مميزة..."
                      className="min-h-[46px] w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">تاريخ التسليم</label>
                    <input
                      type="date"
                      value={requestedDate}
                      onChange={(e) => setRequestedDate(e.target.value)}
                      className="min-h-[46px] w-full rounded-xl border border-input bg-card px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">وقت التسليم</label>
                    <input
                      type="time"
                      value={requestedTime}
                      onChange={(e) => setRequestedTime(e.target.value)}
                      className="min-h-[46px] w-full rounded-xl border border-input bg-card px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* CARD 3: Customization, Notes & Inscription */}
              <div className="rounded-2xl border border-border/80 bg-secondary/20 p-3.5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-primary border-b border-border/60 pb-2">
                  <span>🎂</span>
                  <span>3. تفاصيل الكيك والكتابة والملاحظات</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    ✍️ الكتابة على الكيك (Inscription)
                  </label>
                  <input
                    type="text"
                    value={inscription}
                    onChange={(e) => setInscription(e.target.value)}
                    placeholder="مثال: Happy Birthday Sarah / مبروك التخرج"
                    className="min-h-[46px] w-full rounded-xl border-2 border-amber-300 bg-amber-50/80 px-3 text-sm font-black text-amber-950 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">💌 عبارة كرت الإهداء (Card Note)</label>
                    <input
                      type="text"
                      value={cardNote}
                      onChange={(e) => setCardNote(e.target.value)}
                      placeholder="نص بطاقة المعايدة المرفقة..."
                      className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">🖼️ رابط صورة التصميم (Design URL)</label>
                    <input
                      type="url"
                      value={designImageUrl || ""}
                      onChange={(e) => setDesignImageUrl(e.target.value || null)}
                      placeholder="https://..."
                      className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">💬 ملاحظات العميل للطلب</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أي طلبات خاصة بالعميل..."
                      className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">🔒 ملاحظات الكادر الداخلية</label>
                    <input
                      type="text"
                      value={staffNotes}
                      onChange={(e) => setStaffNotes(e.target.value)}
                      placeholder="ملاحظة خاصة للمطبخ أو الكاشير..."
                      className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border flex gap-2">
              <button
                type="button"
                onClick={() => setShowPreorderModal(false)}
                className="flex-1 min-h-[48px] rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-xs hover:opacity-90 cursor-pointer transition"
              >
                حفظ بيانات الحجز والتوصيل ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}