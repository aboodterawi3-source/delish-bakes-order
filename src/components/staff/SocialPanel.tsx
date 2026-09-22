import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BookOpen, Check, ClipboardCopy, Loader2, LogOut, MessageCircle, PlusCircle, Search, Send, Sparkles, Store, Utensils } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createSocialOrder,
  getSocialAccess,
  type SocialOrderInput,
} from "@/lib/social.functions";
import { DELIVERY_ZONES, OTHER_GOVERNORATES_AREA, feeForArea } from "@/lib/delivery-zones";
import { buildConfirmationMessage, remainingBalance } from "@/lib/confirmation-message";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import type { StorefrontProduct, SizePrice } from "@/lib/storefront-content";
import {
  CakeCustomizationPanel,
  customizationSummary,
  emptyCustomization,
  type Customization,
} from "@/components/delish/CakeCustomizationPanel";
import { OrdersWorkspace } from "@/components/staff/OrdersWorkspace";
import { ModificationsPanel } from "@/components/staff/ModificationsPanel";

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

const getEmptyForm = () => ({
  /** Delivery order: label, sender and recipient. */
  order_name: "",
  sender_phone: "",
  recipient_phone: "",
  customer_name: "",
  customer_phone: "",
  order_details: "",
  quantity: 1,
  /** Original agreed price per unit (السعر الأصلي). */
  unit_price: "",
  card_note: "",
  
  method: "pickup" as "pickup" | "delivery",
  area: "",
  address: "",
  payment_option: "cash" as "cash" | "cliq_full" | "cliq_deposit",
  deposit_paid: "",
  requested_date: todayIso(),
  requested_time: defaultTimeSlot(),
  event_date: "",
  is_urgent: false,
  design_notes: "",
  staff_notes: "",
});

const emptyForm = getEmptyForm();

/** Official Delish store WhatsApp number (international format, no "+"). */
const WHATSAPP_NUMBER = "962779179995";
/** Universal share link — uses wa.me directly, no API endpoints or iframes. */
const whatsappUrl = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export function SocialPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessFn = useServerFn(getSocialAccess);
  const createFn = useServerFn(createSocialOrder);
  const storefront = useStorefrontContent();

  const [view, setView] = useState<"new" | "orders" | "modifications">("new");
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [form, setForm] = useState(getEmptyForm);
  const [customization, setCustomization] = useState<Customization>(emptyCustomization);
  const [copied, setCopied] = useState<"summary" | "confirmation" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** Confirmation message returned with the created order (real order number). */
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Storefront Menu picker state
  const [showMenuPicker, setShowMenuPicker] = useState(true);
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState("all");

  const catalogProducts = useMemo(() => storefront.data?.products ?? [], [storefront.data]);
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    for (const p of catalogProducts) if (p.category?.trim()) set.add(p.category.trim());
    return ["all", ...Array.from(set)];
  }, [catalogProducts]);

  const filteredMenuProducts = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return catalogProducts.filter((p) => {
      const matchCat = menuCategory === "all" || p.category === menuCategory;
      const matchQuery =
        !q ||
        p.name_ar.toLowerCase().includes(q) ||
        p.name_en.toLowerCase().includes(q) ||
        (p.filling_ar && p.filling_ar.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [catalogProducts, menuSearch, menuCategory]);

  const selectProductFromMenu = (product: StorefrontProduct, size?: SizePrice) => {
    const priceToSet = size ? size.price : product.price;
    const sizeLabel = size ? ` (${size.label})` : "";
    const fillingText = product.filling_ar ? ` — حشوة: ${product.filling_ar}` : "";
    const nameToSet = `${product.name_ar}${sizeLabel}${fillingText}`;

    setForm((current) => ({
      ...current,
      order_details: nameToSet,
      unit_price: String(priceToSet),
    }));

    if (product.filling_ar) {
      setCustomization((current) => ({ ...current, filling: product.filling_ar || "" }));
    }
  };

  const access = useQuery({ queryKey: ["social-access"], queryFn: () => accessFn({}) });

  const set = useCallback(<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setCopied(null);
  }, []);

  const extras = useMemo(() => customizationSummary(customization), [customization]);

  const areaFee = feeForArea(form.area);
  const deliveryFee = form.method === "delivery" ? areaFee ?? 0 : 0;
  const paymentLabel =
    form.payment_option === "cliq_full"
      ? `كليك دفع كامل: ${(Number(form.deposit_paid) || 0).toFixed(2)} د.أ`
      : form.payment_option === "cliq_deposit"
        ? `عربون عبر كليك: ${(Number(form.deposit_paid) || 0).toFixed(2)} د.أ`
        : "كاش عند الاستلام";

  /** Live financial calculator: original price → delivery → total → paid → remaining. */
  const unitPrice = Math.max(Number(form.unit_price) || 0, 0);
  const originalPrice = unitPrice * form.quantity;
  const paidAmount = form.payment_option === "cash" ? 0 : Math.max(Number(form.deposit_paid) || 0, 0);
  const grandTotal = originalPrice + deliveryFee;
  const remaining = remainingBalance(grandTotal, paidAmount);



  /** Official confirmation message. The order number is filled in on the server. */
  const confirmationTemplate = useMemo(
    () =>
      buildConfirmationMessage({
        orderNumber: "{{ORDER_NUMBER}}",
        customerName: form.customer_name,
        when: `${form.requested_date} ${form.requested_time}`.trim(),
        fulfilment:
          form.method === "delivery"
            ? `توصيل · ${form.area || "—"}${form.address.trim() ? ` — ${form.address.trim()}` : ""}`
            : "استلام من المحل",
        items: [`${form.quantity} × ${form.order_details.trim() || "—"}`, ...extras.ar],
        cakeWriting: form.design_notes || customization.topperText,
        cardWriting: form.card_note,
        extraNote: form.is_urgent ? "طلب مستعجل · Urgent" : "",
        notes: customization.notes,
        
        price: originalPrice,
        deliveryFee,
        total: grandTotal,
        paid: paidAmount,
        paymentMethod: paymentLabel,
        recipientPhone: form.recipient_phone || customization.recipientPhone || form.customer_phone,
        senderPhone: form.sender_phone || customization.senderPhone,
      }),
    [form, extras.ar, customization, originalPrice, deliveryFee, grandTotal, paidAmount, paymentLabel],
  );

  /** What staff see and copy: the placeholder is only meaningful after saving. */
  const confirmationPreview = savedMessage
    ? savedMessage
    : confirmationTemplate.replace("{{ORDER_NUMBER}}", "(يُضاف تلقائياً عند الإرسال)");


  const submit = useMutation({
    mutationFn: (input: SocialOrderInput) => createFn({ data: input }),
    onSuccess: (order) => {
      setDone(order.order_number);
      setError(null);
      setSavedMessage(order.confirmation_message ?? null);
      setForm(getEmptyForm());
      setCustomization(emptyCustomization);
      void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },

    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const copy = useCallback(async (text: string, which: "summary" | "confirmation") => {
    // Primary: async Clipboard API. Fallback: hidden textarea + execCommand
    // for browsers/contexts where clipboard.writeText is blocked.
    const legacyCopy = () => {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.insetInlineStart = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      if (!ok) throw new Error("copy failed");
    };
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        legacyCopy();
      }
      setCopied(which);
      setError(null);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      try {
        legacyCopy();
        setCopied(which);
        setError(null);
        window.setTimeout(() => setCopied(null), 2500);
      } catch {
        setError("تعذّر النسخ · Copy failed — حدّد النص من المعاينة وانسخه يدوياً");
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/social-login", replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 6000);
    return () => window.clearTimeout(timer);
  }, [done]);

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
          <h1 className="font-display text-2xl font-bold text-foreground">لا تملك صلاحية السوشال</h1>
          <p className="text-sm text-muted-foreground">This account has no social portal access. Ask an admin to grant the social role.</p>
          <button type="button" onClick={signOut} className="min-h-12 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submit.mutate({
      order_name: form.order_name,
      sender_phone: form.sender_phone || customization.senderPhone,
      recipient_phone: form.recipient_phone || customization.recipientPhone,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      order_details: form.order_details,
      quantity: form.quantity,
      unit_price: Number(form.unit_price) || 0,
      card_note: form.card_note,
      
      confirmation_message: confirmationTemplate,
      method: form.method,
      area: form.method === "delivery" ? form.area : null,
      address: form.method === "delivery" ? form.address : null,
      payment_option: form.payment_option,
      deposit_paid: form.payment_option === "cash" ? 0 : Number(form.deposit_paid) || 0,
      requested_date: form.requested_date,
      requested_time: form.requested_time,
      event_date: form.event_date || null,
      is_urgent: form.is_urgent,
      design_notes: [form.design_notes.trim(), customization.notes.trim()].filter(Boolean).join(" — "),
      staff_notes: form.staff_notes,
      extras_ar: extras.ar,
      extras_en: extras.en,
      design_image_url: customization.designImageUrl,
    });

  };

  return (
    <main dir="rtl" className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#F9FBFC] text-[#3E2723] bg-delish-pattern pb-16">
      <header className="border-b border-[#F1F5F9] bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto grid max-w-3xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FDE2CF] text-[#7B3F00] shadow-sm">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-lg font-bold text-[#3E2723] sm:text-xl">بوابة السوشال ميديا</h1>
              <span className="-mt-1 hidden font-script text-2xl italic text-[#8B4513] sm:inline">Delish</span>
            </div>
            <p className="truncate text-xs font-bold text-[#7A6458]">
              إدخال الطلبات فوراً للمبيعات والمطبخ · Social Order Entry
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="تسجيل الخروج"
            className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50 shadow-xs"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* Two work modes: take a new order, or manage every existing order. */}
        <nav className="no-scrollbar mb-5 flex max-w-full gap-2 overflow-x-auto" aria-label="أقسام بوابة السوشال">
          {([
            { value: "new" as const, label: "طلب جديد · New order" },
            { value: "orders" as const, label: "إدارة الطلبات · Orders" },
            { value: "modifications" as const, label: "تعديلات · Modifications" },
          ]).map((item) => (
            <button
              key={item.value}
              type="button"
              aria-current={view === item.value}
              onClick={() => setView(item.value)}
              className={`min-h-12 shrink-0 whitespace-nowrap rounded-full px-6 text-sm font-bold transition ${
                view === item.value
                  ? "bg-[#8B4513] text-white shadow-sm"
                  : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {view === "new" ? (
        <>
        {done ? (
          <p role="status" className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm font-bold text-amber-900 shadow-xs">
            تم إرسال الطلب {done} ويظهر الآن على شاشة المبيعات والمطبخ ✅
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm font-bold text-red-900 shadow-xs">
            {error}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="font-serif text-xl font-extrabold text-[#3E2723]">طلب جديد · New Social Order</h2>
            <span className="rounded-full bg-[#8B4513]/10 px-3 py-1 text-xs font-black text-[#8B4513]">
              بوابة إدخال السوشال ميديا
            </span>
          </div>

          {/* STEP 1: CUSTOMER & DELIVERY INFO */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#8B4513] text-xs font-black text-white">
                1
              </span>
              <h3 className="font-bold text-base text-[#3E2723]">بيانات العميل والتوصيل · Customer & Delivery</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-[#3E2723] sm:col-span-2">
                اسم الطلب (يظهر في القوائم والمطبخ)
                <input
                  value={form.order_name}
                  onChange={(event) => set("order_name", event.target.value)}
                  placeholder="مثال: كيكة عيد ميلاد سارة"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                />
              </label>

              <label className="block text-xs font-bold text-[#3E2723]">
                اسم العميل *
                <input
                  required
                  value={form.customer_name}
                  onChange={(event) => set("customer_name", event.target.value)}
                  placeholder="الاسم الكامل"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                />
              </label>

              <label className="block text-xs font-bold text-[#3E2723]">
                رقم الهاتف الرئيسي *
                <input
                  required
                  dir="ltr"
                  inputMode="tel"
                  value={form.customer_phone}
                  onChange={(event) => set("customer_phone", event.target.value)}
                  placeholder="079XXXXXXX"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                />
              </label>

              <label className="block text-xs font-bold text-[#3E2723]">
                رقم المرسل (اختياري)
                <input
                  dir="ltr"
                  inputMode="tel"
                  value={form.sender_phone}
                  onChange={(event) => set("sender_phone", event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                />
              </label>

              <label className="block text-xs font-bold text-[#3E2723]">
                رقم المستلم (اختياري)
                <input
                  dir="ltr"
                  inputMode="tel"
                  value={form.recipient_phone}
                  onChange={(event) => set("recipient_phone", event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                />
              </label>

              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2 pt-1 border-t border-slate-100">
                <fieldset className="text-xs font-bold text-[#3E2723]">
                  <legend className="mb-1">طريقة التسليم</legend>
                  <div className="flex gap-2">
                    {(["pickup", "delivery"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => set("method", method)}
                        className={`min-h-11 flex-1 rounded-xl px-4 text-xs font-bold transition-all ${
                          form.method === method
                            ? "bg-[#8B4513] text-white shadow-xs"
                            : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                        }`}
                      >
                        {method === "pickup" ? "🏬 استلام من المحل" : "🚀 توصيل"}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => set("is_urgent", !form.is_urgent)}
                    className={`w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl px-4 text-xs font-extrabold transition-all ${
                      form.is_urgent
                        ? "bg-red-600 text-white shadow-sm"
                        : "border border-red-300 text-red-700 bg-red-50/60 hover:bg-red-100/60"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4" /> 🚨 طلب مستعجل (Urgent)
                  </button>
                </div>
              </div>

              {form.method === "delivery" && (
                <>
                  <label className="block text-xs font-bold text-[#3E2723]">
                    منطقة التوصيل *
                    <select
                      required
                      value={form.area}
                      onChange={(event) => set("area", event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                    >
                      <option value="">اختر المنطقة</option>
                      {DELIVERY_ZONES.map((zone) => (
                        <optgroup key={zone.labelEn} label={`${zone.labelAr} · ${zone.labelEn}`}>
                          {zone.areas.map((area) => (
                            <option key={`${zone.labelEn}-${area}`} value={area}>
                              {area === OTHER_GOVERNORATES_AREA
                                ? `${area} (٥–٨ د.أ)`
                                : `${area} — ${zone.fee.toFixed(2)} د.أ`}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-bold text-[#3E2723]">
                    العنوان التفصيلي
                    <input
                      value={form.address}
                      onChange={(event) => set("address", event.target.value)}
                      placeholder="شارع، رقم العمارة، الطابق…"
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                    />
                  </label>
                </>
              )}

              <label className="block text-xs font-bold text-[#3E2723]">
                تاريخ التسليم *
                <input
                  type="date"
                  required
                  value={form.requested_date}
                  onChange={(event) => set("requested_date", event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                />
              </label>

              <label className="block text-xs font-bold text-[#3E2723]">
                وقت التسليم *
                <input
                  type="time"
                  required
                  value={form.requested_time}
                  onChange={(event) => set("requested_time", event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                />
              </label>
            </div>
          </div>

          {/* STEP 2: PRODUCTS, FILLINGS & CUSTOMIZATION */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#8B4513] text-xs font-black text-white">
                2
              </span>
              <h3 className="font-bold text-base text-[#3E2723]">المنتجات، الحشوات والتجهيز الخاص · Products & Fillings</h3>
            </div>

            {/* STOREFRONT MENU / CATALOG SELECTOR */}
            <div className="rounded-2xl border border-[#B8860B]/30 bg-[#FFFDF9] p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between gap-2 border-b border-[#B8860B]/20 pb-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#8B4513] text-white">
                    <Store className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[#3E2723]">منيو المنتجات على الموقع</h4>
                    <p className="text-[10px] text-[#7A6458]">اضغط على أي صنف لإضافته وتحديد السعر فوراً</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMenuPicker((v) => !v)}
                  className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#8B4513] border border-[#B8860B]/40 hover:bg-[#FDE2CF]/30 transition shadow-2xs"
                >
                  {showMenuPicker ? "إخفاء المنيو ▲" : "عرض منيو المنتجات ▼"}
                </button>
              </div>

              {showMenuPicker && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        placeholder="بحث بالاسم أو الحشوة…"
                        className="w-full rounded-xl border border-slate-200 bg-white pr-8 pl-3 py-1.5 text-xs font-semibold text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </div>

                    <div className="no-scrollbar flex gap-1 overflow-x-auto max-w-full py-0.5">
                      {categoriesList.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setMenuCategory(cat)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition-all ${
                            menuCategory === cat
                              ? "bg-[#8B4513] text-white shadow-2xs"
                              : "bg-white text-[#5D2E17] border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {cat === "all" ? "الكل" : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {storefront.isLoading ? (
                    <div className="flex items-center justify-center py-4 text-xs text-[#7A6458]">
                      <Loader2 className="h-4 w-4 animate-spin ml-2 text-[#8B4513]" />
                      جاري تحميل المنيو…
                    </div>
                  ) : filteredMenuProducts.length === 0 ? (
                    <div className="text-center py-3 text-xs font-bold text-[#7A6458]">
                      لا توجد نتائج مطابقة في المنيو
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                      {filteredMenuProducts.map((prod) => (
                        <div
                          key={prod.id}
                          className="group flex flex-col justify-between rounded-xl bg-white p-2 border border-slate-200 shadow-2xs hover:border-[#B8860B] transition-all"
                        >
                          <div className="flex items-start gap-2">
                            {prod.image_url ? (
                              <img
                                src={prod.image_url}
                                alt={prod.name_ar}
                                className="h-10 w-10 rounded-lg object-cover shrink-0 border border-slate-100"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-[#FDE2CF]/40 flex items-center justify-center shrink-0 text-[#8B4513]">
                                <Utensils className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-[#3E2723] leading-snug truncate">{prod.name_ar}</h4>
                              <p className="text-[11px] font-extrabold text-[#8B4513] mt-0.5">
                                {prod.price_on_request ? "حسب الطلب" : `${prod.price.toFixed(2)} د.أ`}
                              </p>
                            </div>
                          </div>

                          <div className="mt-1.5 pt-1 border-t border-slate-100 flex flex-wrap gap-1">
                            {prod.sizes && prod.sizes.length > 0 ? (
                              prod.sizes.map((sz) => (
                                <button
                                  key={sz.label}
                                  type="button"
                                  onClick={() => selectProductFromMenu(prod, sz)}
                                  className="flex-1 min-w-[55px] rounded-lg bg-[#F9FBFC] hover:bg-[#8B4513] hover:text-white px-1 py-0.5 text-[10px] font-bold border border-slate-200 transition-all text-center"
                                >
                                  {sz.label} ({sz.price} د.أ)
                                </button>
                              ))
                            ) : (
                              <button
                                type="button"
                                onClick={() => selectProductFromMenu(prod)}
                                className="w-full rounded-lg bg-[#8B4513] hover:bg-[#5D2E17] text-white px-2 py-0.5 text-[11px] font-bold shadow-2xs transition-all flex items-center justify-center gap-1"
                              >
                                <PlusCircle className="h-3 w-3" />
                                اختيار المنتج
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <label className="block text-xs font-bold text-[#3E2723]">
              تفاصيل طلب الزبون *
              <textarea
                required
                rows={3}
                maxLength={2000}
                value={form.order_details}
                onChange={(event) => set("order_details", event.target.value)}
                placeholder="اكتب تفاصيل الطلب كاملة أو اختر صنفاً من منيو الموقع أعلاه…"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>

            {/* CAKE FILLING SELECTION */}
            <div className="rounded-xl bg-[#FDE2CF]/20 border border-[#FDE2CF] p-3 space-y-2">
              <span className="block text-xs font-bold text-[#5D2E17]">
                نوع الحشوة (اختر أو اكتب) · Cake Filling Selection
              </span>
              <div className="flex flex-wrap gap-1">
                {[
                  "نوتيلا وبندق",
                  "لوتس كراميل",
                  "فستق حلبي",
                  "شوكولاتة بلجيكية",
                  "فراولة طازجة وكريمة",
                  "فانيلا كلاسيك",
                  "كراميل مملح",
                  "أوريو وكريمة",
                ].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() =>
                      setCustomization((curr) => ({
                        ...curr,
                        filling: curr.filling === f ? "" : f,
                      }))
                    }
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold border transition-all ${
                      customization.filling === f
                        ? "bg-[#8B4513] text-white border-[#8B4513] shadow-xs"
                        : "bg-white text-[#5D2E17] border-slate-200 hover:bg-amber-50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customization.filling}
                onChange={(event) =>
                  setCustomization((curr) => ({ ...curr, filling: event.target.value }))
                }
                placeholder="اكتب نوع الحشوة هنا (مثال: نوتيلا ولوتس أو حسب الطلب)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-[#3E2723]">
                الكمية *
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={form.quantity}
                  onChange={(event) => set("quantity", Math.max(1, Number(event.target.value) || 1))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                />
              </label>

              <label className="block text-xs font-bold text-[#3E2723]">
                السعر الأصلي للحبة (د.أ)
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.unit_price}
                  onChange={(event) => set("unit_price", event.target.value)}
                  placeholder="0.00"
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-[#FDE2CF] bg-[#FDE2CF]/20 p-3 sm:p-4">
              <CakeCustomizationPanel value={customization} onChange={setCustomization} />
              {extras.ar.length ? (
                <ul className="mt-2 space-y-0.5 rounded-xl bg-white/80 p-2.5 text-xs font-bold text-[#5D2E17]">
                  {extras.ar.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <label className="block text-xs font-bold text-[#3E2723]">
              الكتابة على الكرت (رسالة الكرت)
              <input
                type="text"
                maxLength={1000}
                value={form.card_note}
                onChange={(event) => set("card_note", event.target.value)}
                placeholder="اكتب عبارة الإهداء المعروضة على الكرت هنا…"
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>
          </div>

          {/* STEP 3: PAYMENT, SUMMARY & WHATSAPP CONFIRMATION */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#8B4513] text-xs font-black text-white">
                3
              </span>
              <h3 className="font-bold text-base text-[#3E2723]">طريقة الدفع والحساب وتأكيد الطلب · Payment & Confirmation</h3>
            </div>

            <fieldset className="text-xs font-bold text-[#3E2723]">
              <legend className="mb-1">طريقة الدفع</legend>
              <div className="flex flex-wrap gap-2">
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
                    onClick={() => set("payment_option", option.value)}
                    className={`min-h-11 flex-1 rounded-xl px-3 text-xs font-bold transition-all ${
                      form.payment_option === option.value
                        ? "bg-[#8B4513] text-white shadow-xs"
                        : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {form.payment_option !== "cash" ? (
                <label className="mt-2 block text-xs font-bold text-[#3E2723]">
                  {form.payment_option === "cliq_full"
                    ? "المبلغ الكامل المدفوع عبر كليك (د.أ)"
                    : "قيمة العربون المدفوع عبر كليك (د.أ)"}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    dir="ltr"
                    value={form.deposit_paid}
                    onChange={(event) => set("deposit_paid", event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>
              ) : null}
            </fieldset>

            {/* Live Financial Calculator */}
            <div className="rounded-2xl border border-[#B8860B]/30 bg-[#FFF8EE] p-4">
              <h4 className="text-xs font-bold text-[#5D2E17] border-b border-[#B8860B]/20 pb-1.5">
                الحساب المالي للطلب
              </h4>
              <dl className="mt-2 space-y-1.5 text-xs text-[#3E2723]">
                <div className="flex justify-between gap-2">
                  <dt>ثمن الأصناف ({form.quantity} × {(Number(form.unit_price) || 0).toFixed(2)})</dt>
                  <dd className="font-bold">{originalPrice.toFixed(2)} د.أ</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>أجرة التوصيل</dt>
                  <dd className="font-bold">{deliveryFee.toFixed(2)} د.أ</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>إجمالي الطلب</dt>
                  <dd className="font-bold">{grandTotal.toFixed(2)} د.أ</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>المدفوع (عربون/كليك)</dt>
                  <dd className="font-bold">{paidAmount.toFixed(2)} د.أ</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-[#B8860B]/30 pt-1.5 text-[#8B4513] font-bold text-sm">
                  <dt>المبلغ المتبقي</dt>
                  <dd>{remaining.toFixed(2)} د.أ</dd>
                </div>
              </dl>
            </div>

            <label className="block text-xs font-bold text-[#3E2723]">
              ملاحظات داخلية للموظفين (خاص بالمبيعات والإدارة)
              <textarea
                rows={2}
                value={form.staff_notes}
                onChange={(event) => set("staff_notes", event.target.value)}
                placeholder="ملاحظات سرية لا تظهر على شاشة المطبخ ولا للزبون…"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>

            <button
              type="submit"
              disabled={submit.isPending}
              className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-full bg-[#8B4513] text-white font-extrabold text-sm shadow-md hover:bg-[#5D2E17] active:scale-95 disabled:opacity-60 transition"
            >
              {submit.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              حفظ وإرسال الطلب فوراً (إلى المطبخ والمبيعات) ✅
            </button>
          </div>

          {/* Live WhatsApp Confirmation Message Box */}
          <section className="rounded-3xl border border-[#B8860B]/40 bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-display text-sm font-bold text-[#3E2723]">👑 رسالة تأكيد الطلب للواتساب (Delish Cake)</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copy(confirmationPreview, "confirmation")}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#B8860B] bg-white px-4 text-xs font-bold text-[#8B4513] hover:bg-[#FDE2CF]/30 transition"
              >
                {copied === "confirmation" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                {copied === "confirmation" ? "تم النسخ" : "نسخ رسالة التأكيد"}
              </button>
              <a
                href={whatsappUrl(confirmationPreview)}
                target="_blank"
                rel="noopener noreferrer"
                title="إرسال على واتساب"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xs hover:brightness-95 transition"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-[#F9FBFC] p-3 text-xs text-[#3E2723] border border-slate-200">
              {confirmationPreview}
            </pre>
          </section>
        </form>
        </>
        ) : view === "modifications" ? (
          <ModificationsPanel
            initialSelectedId={editOrderId}
            onCloseEdit={() => setEditOrderId(null)}
          />
        ) : (
          <OrdersWorkspace
            onEditOrder={(orderId) => {
              setEditOrderId(orderId);
              setView("modifications");
            }}
          />
        )}
      </div>
    </main>
  );
}
