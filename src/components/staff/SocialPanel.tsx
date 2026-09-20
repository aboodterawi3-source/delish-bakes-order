import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  Store,
  Truck,
  Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createSocialOrder,
  getSocialAccess,
  type SocialOrderInput,
} from "@/lib/social.functions";
import { DELIVERY_ZONES, feeForArea } from "@/lib/delivery-zones";
import { buildConfirmationMessage, remainingBalance } from "@/lib/confirmation-message";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import type { StorefrontProduct, SizePrice } from "@/lib/storefront-content";
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
  customer_name: "",
  customer_phone: "",
  is_recipient_different: false,
  recipient_name: "",
  recipient_phone: "",
  
  order_mode: "menu" as "menu" | "custom",
  
  custom_size: "",
  custom_flavor: "",
  custom_filling: "",
  
  order_details: "",
  quantity: 1,
  unit_price: "",
  
  method: "pickup" as "pickup" | "delivery",
  area: "",
  address: "",
  payment_option: "cash" as "cash" | "cliq_full" | "cliq_deposit",
  deposit_paid: "",
  requested_date: todayIso(),
  requested_time: defaultTimeSlot(),
  event_date: "",
  is_urgent: false,
  
  customer_notes: "",
  staff_notes: "",
  
  design_image_url: "",
});

const emptyForm = getEmptyForm();

const WHATSAPP_NUMBER = "962779179995";
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
  const [copied, setCopied] = useState<"summary" | "confirmation" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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
  };

  const access = useQuery({ queryKey: ["social-access"], queryFn: () => accessFn({}) });

  const set = useCallback(<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setCopied(null);
  }, []);

  const areaFee = feeForArea(form.area);
  const deliveryFee = form.method === "delivery" ? areaFee ?? 0 : 0;
  const paymentLabel =
    form.payment_option === "cliq_full"
      ? `كليك دفع كامل: ${(Number(form.deposit_paid) || 0).toFixed(2)} د.أ`
      : form.payment_option === "cliq_deposit"
        ? `عربون عبر كليك: ${(Number(form.deposit_paid) || 0).toFixed(2)} د.أ`
        : "كاش عند الاستلام";

  const unitPrice = Math.max(Number(form.unit_price) || 0, 0);
  const originalPrice = unitPrice * form.quantity;
  const paidAmount = form.payment_option === "cash" ? 0 : Math.max(Number(form.deposit_paid) || 0, 0);
  const grandTotal = originalPrice + deliveryFee;
  const remaining = remainingBalance(grandTotal, paidAmount);

  const finalOrderDetails = useMemo(() => {
    if (form.order_mode === "custom") {
      const parts = [];
      if (form.custom_size) parts.push(`الحجم: ${form.custom_size}`);
      if (form.custom_flavor) parts.push(`النكهة: ${form.custom_flavor}`);
      if (form.custom_filling) parts.push(`الحشوة: ${form.custom_filling}`);
      if (form.order_details.trim()) parts.push(form.order_details.trim());
      return parts.join(" | ") || "كيك تفصيل مخصص";
    }
    return form.order_details.trim() || "صنف من المنيو";
  }, [form.order_mode, form.custom_size, form.custom_flavor, form.custom_filling, form.order_details]);

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
        items: [`${form.quantity} × ${finalOrderDetails}`],
        cakeWriting: form.customer_notes.trim(),
        cardWriting: "",
        extraNote: form.is_urgent ? "طلب مستعجل · Urgent" : "",
        notes: "",
        price: originalPrice,
        deliveryFee,
        total: grandTotal,
        paid: paidAmount,
        paymentMethod: paymentLabel,
        recipientPhone: form.is_recipient_different ? form.recipient_phone : form.customer_phone,
        senderPhone: form.is_recipient_different ? form.customer_phone : "",
      }),
    [form, finalOrderDetails, originalPrice, deliveryFee, grandTotal, paidAmount, paymentLabel],
  );

  const confirmationPreview = savedMessage
    ? savedMessage
    : confirmationTemplate.replace("{{ORDER_NUMBER}}", "(يُضاف تلقائياً عند الإرسال)");

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);
      setError(null);
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `designs/${Date.now()}_CustomerDesign.${ext}`;
      const { data, error: uploadErr } = await supabase.storage
        .from("order-designs")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: signedData } = await supabase.storage
        .from("order-designs")
        .createSignedUrl(data.path, 60 * 60 * 24 * 365);

      if (signedData?.signedUrl) {
        set("design_image_url", signedData.signedUrl);
      }
    } catch (err: any) {
      setError(err.message || "فشل رفع الصورة");
    } finally {
      setUploadingImage(false);
    }
  };

  const submit = useMutation({
    mutationFn: (input: SocialOrderInput) => createFn({ data: input }),
    onSuccess: (order) => {
      setDone(order.order_number);
      setError(null);
      setSavedMessage(order.confirmation_message ?? null);
      setForm(getEmptyForm());
      void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.customer_name.trim()) {
      setError("اسم العميل مطلوب");
      return;
    }
    if (!form.customer_phone.trim()) {
      setError("رقم هاتف العميل مطلوب");
      return;
    }

    const payload: SocialOrderInput = {
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      order_name: form.is_recipient_different && form.recipient_name ? `مستلم: ${form.recipient_name}` : null,
      sender_phone: form.is_recipient_different ? form.customer_phone.trim() : null,
      recipient_phone: form.is_recipient_different ? form.recipient_phone.trim() : null,
      order_details: finalOrderDetails,
      quantity: form.quantity,
      unit_price: Number(form.unit_price) || 0,
      design_notes: form.customer_notes.trim() || null,
      staff_notes: form.staff_notes.trim() || null,
      card_note: null,
      final_photo_requested: false,
      confirmation_message: confirmationTemplate,
      method: form.method,
      area: form.method === "delivery" ? form.area : null,
      address: form.method === "delivery" ? form.address : null,
      payment_option: form.payment_option,
      deposit_paid: form.payment_option === "cash" ? 0 : Number(form.deposit_paid) || 0,
      requested_date: form.requested_date,
      requested_time: form.requested_time,
      is_urgent: form.is_urgent,
      design_image_url: form.design_image_url || null,
    };

    submit.mutate(payload);
  };

  const copy = useCallback(async (text: string, which: "summary" | "confirmation") => {
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
        setError("تعذّر النسخ · حدّد النص وانسخه يدوياً");
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/social-login", replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 8000);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (access.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6F0] p-4 text-[#5D2E17]">
        <Loader2 className="h-8 w-8 animate-spin text-[#8B4513]" />
      </div>
    );
  }

  if (access.isError || !access.data?.allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF6F0] p-4 text-center text-[#5D2E17]">
        <AlertTriangle className="h-12 w-12 text-rose-500 mb-2" />
        <h2 className="font-bold text-lg mb-1">غير مصرح بالوصول</h2>
        <p className="text-xs text-slate-600 mb-4">الحساب غير مخول لاستخدام شاشة السوشيال ميديا.</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="px-4 py-2 rounded-xl bg-[#8B4513] text-white text-xs font-bold shadow-sm hover:bg-[#5D2E17]"
        >
          تسجيل الخروج
        </button>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#FAF6F0] text-[#3E2723] pb-12 font-sans">
      <header className="sticky top-0 z-30 border-b border-[#B8860B]/20 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#8B4513] text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base text-[#3E2723] leading-tight">شاشة السوشيال ميديا</h1>
              <p className="text-[11px] font-semibold text-[#8B4513]">إدخال وإدارة طلبات الزبائن وتنسيق المطبخ</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-[#FAF6F0] p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setView("new")}
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                  view === "new"
                    ? "bg-[#8B4513] text-white shadow-xs"
                    : "text-[#5D2E17] hover:bg-white/60"
                }`}
              >
                + طلب جديد
              </button>
              <button
                type="button"
                onClick={() => setView("orders")}
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                  view === "orders"
                    ? "bg-[#8B4513] text-white shadow-xs"
                    : "text-[#5D2E17] hover:bg-white/60"
                }`}
              >
                إدارة الطلبات
              </button>
              <button
                type="button"
                onClick={() => setView("modifications")}
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                  view === "modifications"
                    ? "bg-[#8B4513] text-white shadow-xs"
                    : "text-[#5D2E17] hover:bg-white/60"
                }`}
              >
                تعديلات
              </button>
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              title="تسجيل الخروج"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 active:scale-95 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-4 space-y-4">
        {done ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Check className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>تم حفظ الطلب بنجاح برقم: <strong className="text-emerald-950 font-black text-sm">{`DL-${done}`}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setDone(null)}
              className="text-xs font-black text-emerald-700 underline hover:text-emerald-900"
            >
              إغلاق
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900 text-xs font-bold shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs font-black text-rose-700 underline hover:text-rose-900"
            >
              إلغاء
            </button>
          </div>
        ) : null}

        {view === "new" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#8B4513] text-xs font-black text-white">
                  1
                </span>
                <h3 className="font-bold text-base text-[#3E2723]">بيانات الزبون والتوصيل</h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#3E2723]">
                  اسم العميل *
                  <input
                    type="text"
                    required
                    value={form.customer_name}
                    onChange={(e) => set("customer_name", e.target.value)}
                    placeholder="مثال: أم أحمد"
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>

                <label className="block text-xs font-bold text-[#3E2723]">
                  رقم الواتساب / الهاتف الرئيسي *
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={form.customer_phone}
                    onChange={(e) => set("customer_phone", e.target.value)}
                    placeholder="079XXXXXXX"
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>
              </div>

              <div className="rounded-xl bg-[#FFF8EE] p-3 border border-[#B8860B]/20">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-[#5D2E17]">
                  <input
                    type="checkbox"
                    checked={form.is_recipient_different}
                    onChange={(e) => set("is_recipient_different", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#8B4513] focus:ring-[#B8860B]"
                  />
                  <span>المستلم شخص آخر (هدية / توصيل لشخص ثاني)</span>
                </label>

                {form.is_recipient_different ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 pt-2 border-t border-[#B8860B]/20 animate-in fade-in duration-200">
                    <label className="block text-xs font-bold text-[#3E2723]">
                      اسم المستلم
                      <input
                        type="text"
                        value={form.recipient_name}
                        onChange={(e) => set("recipient_name", e.target.value)}
                        placeholder="اسم الشخص المستلم"
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#3E2723]">
                      رقم هاتف المستلم
                      <input
                        type="tel"
                        dir="ltr"
                        value={form.recipient_phone}
                        onChange={(e) => set("recipient_phone", e.target.value)}
                        placeholder="رقم المستلم"
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => set("method", "pickup")}
                    className={`min-h-11 flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all ${
                      form.method === "pickup"
                        ? "bg-[#8B4513] text-white shadow-xs"
                        : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                    }`}
                  >
                    <Store className="h-4 w-4" /> استلام من المحل
                  </button>

                  <button
                    type="button"
                    onClick={() => set("method", "delivery")}
                    className={`min-h-11 flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all ${
                      form.method === "delivery"
                        ? "bg-[#8B4513] text-white shadow-xs"
                        : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                    }`}
                  >
                    <Truck className="h-4 w-4" /> توصيل مع دليفري
                  </button>
                </div>

                {form.method === "delivery" ? (
                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <label className="block text-xs font-bold text-[#3E2723]">
                      منطقة التوصيل *
                      <select
                        value={form.area}
                        onChange={(e) => set("area", e.target.value)}
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      >
                        <option value="">— اختر المنطقة —</option>
                        {DELIVERY_ZONES.map((zone) => (
                          <option key={zone.name} value={zone.name}>
                            {zone.name} ({zone.fee.toFixed(2)} د.أ)
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-[#3E2723]">
                      العنوان التفصيلي
                      <input
                        type="text"
                        value={form.address}
                        onChange={(e) => set("address", e.target.value)}
                        placeholder="شارع، عمارة، شقة..."
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <label className="block text-xs font-bold text-[#3E2723]">
                  تاريخ التسليم *
                  <input
                    type="date"
                    required
                    value={form.requested_date}
                    onChange={(e) => set("requested_date", e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>

                <label className="block text-xs font-bold text-[#3E2723]">
                  وقت التسليم *
                  <input
                    type="time"
                    required
                    value={form.requested_time}
                    onChange={(e) => set("requested_time", e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#8B4513] text-xs font-black text-white">
                    2
                  </span>
                  <h3 className="font-bold text-base text-[#3E2723]">محتوى وتفاصيل الطلب</h3>
                </div>

                <div className="flex rounded-full bg-[#FAF6F0] p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => set("order_mode", "menu")}
                    className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                      form.order_mode === "menu"
                        ? "bg-[#8B4513] text-white shadow-xs"
                        : "text-[#5D2E17] hover:bg-white/60"
                    }`}
                  >
                    🍰 منيو الموقع
                  </button>
                  <button
                    type="button"
                    onClick={() => set("order_mode", "custom")}
                    className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                      form.order_mode === "custom"
                        ? "bg-[#8B4513] text-white shadow-xs"
                        : "text-[#5D2E17] hover:bg-white/60"
                    }`}
                  >
                    🎨 كيك تفصيل مخصص
                  </button>
                </div>
              </div>

              {form.order_mode === "menu" ? (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        placeholder="ابحث عن كيكة أو صنف من المنيو..."
                        className="w-full min-h-11 rounded-xl border border-slate-200 bg-[#F9FBFC] pr-9 pl-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </div>

                    <select
                      value={menuCategory}
                      onChange={(e) => setMenuCategory(e.target.value)}
                      className="min-h-11 rounded-xl border border-slate-200 bg-[#F9FBFC] px-3 text-xs font-bold text-[#5D2E17] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                    >
                      <option value="all">كل الأقسام</option>
                      {categoriesList.filter((c) => c !== "all").map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-h-60 overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-[#F9FBFC]">
                    {filteredMenuProducts.length > 0 ? (
                      filteredMenuProducts.map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => selectProductFromMenu(prod)}
                          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-[#B8860B] hover:shadow-xs transition-all text-right flex flex-col justify-between space-y-1.5"
                        >
                          <div>
                            <span className="font-extrabold text-xs text-[#3E2723] block leading-snug">{prod.name_ar}</span>
                            {prod.filling_ar ? (
                              <span className="text-[10px] text-slate-500 block">حشوة: {prod.filling_ar}</span>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between text-xs font-black text-[#8B4513] pt-1 border-t border-slate-100">
                            <span>{prod.price_on_request ? "عند الطلب" : `${prod.price.toFixed(2)} د.أ` }</span>
                            <span className="text-[10px] bg-[#FFF8EE] text-[#8B4513] px-2 py-0.5 rounded-full border border-[#B8860B]/30">اختيار ✓</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-xs text-slate-500 py-6 col-span-full">لا يوجد منتجات تطابق البحث</p>
                    )}
                  </div>

                  <label className="block text-xs font-bold text-[#3E2723] pt-2">
                    اسم/وصف الصنف المختار
                    <input
                      type="text"
                      value={form.order_details}
                      onChange={(e) => set("order_details", e.target.value)}
                      placeholder="سيظهر اسم الكيك المختار من المنيو هنا تلقائياً أو اكتب يدوياً"
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm font-bold text-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                    />
                  </label>
                </div>
              ) : null}

              {form.order_mode === "custom" ? (
                <div className="space-y-3 animate-in fade-in duration-200 rounded-2xl bg-[#FFF8EE]/50 p-4 border border-[#B8860B]/30">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-xs font-bold text-[#3E2723]">
                      الحجم *
                      <select
                        value={form.custom_size}
                        onChange={(e) => set("custom_size", e.target.value)}
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      >
                        <option value="">— اختر الحجم —</option>
                        <option value="6 انش (يكفي 6-8 أشخاص)">6 انش (6-8 أشخاص)</option>
                        <option value="8 انش (يكفي 10-12 شخص)">8 انش (10-12 شخص)</option>
                        <option value="10 انش (يكفي 15-18 شخص)">10 انش (15-18 شخص)</option>
                        <option value="دورين صغير (20 شخص)">دورين صغير (20 شخص)</option>
                        <option value="دورين كبير (35+ شخص)">دورين كبير (35+ شخص)</option>
                        <option value="حجم مخصص">حجم مخصص آخر</option>
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-[#3E2723]">
                      النكهة *
                      <select
                        value={form.custom_flavor}
                        onChange={(e) => set("custom_flavor", e.target.value)}
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      >
                        <option value="">— اختر النكهة —</option>
                        <option value="فانيليا">فانيليا (Vanilla)</option>
                        <option value="شوكولاتة">شوكولاتة (Chocolate)</option>
                        <option value="ريد فيلفيت">ريد فيلفيت (Red Velvet)</option>
                        <option value="مكس فانيليا وشوكولاتة">مكس فانيليا وشوكولاتة</option>
                        <option value="ليمون / توت">ليمون / توت</option>
                      </select>
                    </label>

                    <label className="block text-xs font-bold text-[#3E2723]">
                      الحشوة المختارة *
                      <input
                        type="text"
                        value={form.custom_filling}
                        onChange={(e) => set("custom_filling", e.target.value)}
                        placeholder="مثال: نوتيلا، لوتس، كيندر..."
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>
                  </div>

                  <label className="block text-xs font-bold text-[#3E2723]">
                    تفاصيل التصميم والطلب المخصص
                    <input
                      type="text"
                      value={form.order_details}
                      onChange={(e) => set("order_details", e.target.value)}
                      placeholder="اكتب أي تفاصيل إضافية عن تصميم الكيكة المخصصة..."
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                    />
                  </label>

                  <div className="pt-1">
                    <span className="text-xs font-bold text-[#3E2723] block mb-1">رفع صورة مرجعية للتصميم (إن وجدت)</span>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#B8860B] bg-white px-4 text-xs font-bold text-[#8B4513] hover:bg-[#FFF8EE] transition">
                        {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploadingImage ? "جاري الرفع..." : "اختيار صورة الموديل/التصميم"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleImageUpload(file);
                          }}
                        />
                      </label>
                      {form.design_image_url ? (
                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-extrabold">
                          <ImageIcon className="h-4 w-4 text-emerald-600" />
                          <span>تم ارفاق الصورة ✓</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#8B4513] text-xs font-black text-white">
                  3
                </span>
                <h3 className="font-bold text-base text-[#3E2723]">الحساب والمالية والرسالة الجاهزة</h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#3E2723]">
                  الكمية
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => set("quantity", Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>

                <label className="block text-xs font-bold text-[#3E2723]">
                  السعر الإجمالي للكيك/الأصناف (د.أ) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    dir="ltr"
                    required
                    value={form.unit_price}
                    onChange={(e) => set("unit_price", e.target.value)}
                    placeholder="0.00"
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm font-bold text-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>
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
                      onChange={(e) => set("deposit_paid", e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm font-bold text-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                    />
                  </label>
                ) : null}
              </fieldset>

              <div className="rounded-2xl border border-[#B8860B]/30 bg-[#FFF8EE] p-4">
                <h4 className="text-xs font-extrabold text-[#5D2E17] border-b border-[#B8860B]/20 pb-1.5">
                  الحساب المالي النهائي للطلب
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
                  <div className="flex justify-between gap-2 border-t border-[#B8860B]/10 pt-1">
                    <dt className="font-bold">إجمالي الطلب</dt>
                    <dd className="font-bold">{grandTotal.toFixed(2)} د.أ</dd>
                  </div>
                  <div className="flex justify-between gap-2 text-emerald-800">
                    <dt>المدفوع (عربون/كليك)</dt>
                    <dd className="font-bold">{paidAmount.toFixed(2)} د.أ</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-[#B8860B]/30 pt-1.5 text-[#8B4513] font-black text-sm">
                    <dt>المبلغ المتبقي المطلوب عند الاستلام</dt>
                    <dd>{remaining.toFixed(2)} د.أ</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-3 pt-1">
                <label className="block text-xs font-bold text-[#3E2723]">
                  1. ملاحظات الزبون والكتابة على الكيك (تظهر للمطبخ وعلى الكرت والواتساب)
                  <textarea
                    rows={2}
                    value={form.customer_notes}
                    onChange={(e) => set("customer_notes", e.target.value)}
                    placeholder="اكتب عبارة المعايدة/الكتابة على الكيك، وأي ملاحظات خاصة من الزبون..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>

                <label className="block text-xs font-bold text-[#3E2723]">
                  2. ملاحظات داخلية للفريق (خاص بالمبيعات والإدارة فقط - سرية)
                  <textarea
                    rows={2}
                    value={form.staff_notes}
                    onChange={(e) => set("staff_notes", e.target.value)}
                    placeholder="ملاحظات سرية للموظفين والمبيعات لا تظهر للزبون ولا للمطبخ..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={submit.isPending}
                className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-full bg-[#8B4513] text-white font-extrabold text-sm shadow-md hover:bg-[#5D2E17] active:scale-95 disabled:opacity-60 transition"
              >
                {submit.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                إنشاء وحفظ الطلب فوراً (إلى المطبخ والمبيعات) ✅
              </button>
            </div>

            <section className="rounded-3xl border border-[#B8860B]/40 bg-white p-5 shadow-xs space-y-3">
              <h3 className="font-display text-sm font-extrabold text-[#3E2723]">👑 رسالة تأكيد الطلب للواتساب (Delish Cake)</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copy(confirmationPreview, "confirmation")}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#B8860B] bg-white px-4 text-xs font-bold text-[#8B4513] hover:bg-[#FDE2CF]/30 transition"
                >
                  {copied === "confirmation" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                  {copied === "confirmation" ? "تم النسخ ✓" : "نسخ رسالة التأكيد"}
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
