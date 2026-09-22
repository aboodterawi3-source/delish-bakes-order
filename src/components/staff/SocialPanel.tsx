import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MessageCircle,
  Save,
  Search,
  Send,
  Sparkles,
  Store,
  Truck,
  Upload
} from "lucide-react";
import { toast } from "sonner";
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
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // 3 Foldable Steps State
  const [step1Open, setStep1Open] = useState(true);
  const [step2Open, setStep2Open] = useState(true);
  const [step3Open, setStep3Open] = useState(true);

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
        p.name_ar?.toLowerCase().includes(q) ||
        p.name_en?.toLowerCase().includes(q) ||
        (p.filling_ar && p.filling_ar.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [catalogProducts, menuSearch, menuCategory]);

  const selectProductFromMenu = (product: StorefrontProduct, size?: SizePrice) => {
    const priceToSet = size ? size.price : product.price;
    const sizeLabel = size ? ` (${size.label})` : "";
    const fillingText = product.filling_ar ? ` • حشوة: ${product.filling_ar}` : "";
    const nameToSet = `${product.name_ar}${sizeLabel}${fillingText}`;

    setForm((current) => ({
      ...current,
      order_details: nameToSet,
      unit_price: String(priceToSet),
    }));
    toast.success(`تم اختيار: ${product.name_ar}`);
  };

  const access = useQuery({ queryKey: ["social-access"], queryFn: () => accessFn({}) });

  const set = useCallback(<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setCopied(null);
  }, []);

  const areaFee = feeForArea(form.area);
  const deliveryFee = form.method === "delivery" ? areaFee ?? 0 : 0;

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
            ? `توصيل · ${form.area || "عمان"}${form.address.trim() ? ` — ${form.address.trim()}` : ""}`
            : "استلام من المحل",
        items: [`${form.quantity} × ${finalOrderDetails}`],
        cakeWriting: form.customer_notes.trim(),
        paymentLabel:
          form.payment_option === "cliq_full"
            ? `دفع كامل كليك (${paidAmount.toFixed(2)} د.أ)`
            : form.payment_option === "cliq_deposit"
              ? `عربون كليك (${paidAmount.toFixed(2)} د.أ)`
              : "كاش عند الاستلام",
        total: grandTotal,
        remaining,
        notes: form.customer_notes.trim(),
      }),
    [form, finalOrderDetails, paidAmount, grandTotal, remaining],
  );

  const confirmationPreview = useMemo(
    () => confirmationTemplate.replace("{{ORDER_NUMBER}}", done ? `DL-${done}` : "DL-XXXX"),
    [confirmationTemplate, done],
  );

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);
      if (file.size > 5 * 1024 * 1024) {
        toast.error("حجم الصورة كبير جداً (الأقصى 5 ميغابايت)");
        return;
      }
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `social-design-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("cake-designs")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (error) {
        const reader = new FileReader();
        reader.onload = (e) => {
          set("design_image_url", e.target?.result as string);
          toast.success("تم إرفاق الصورة كمعاينة مباشرة 📸");
        };
        reader.readAsDataURL(file);
      } else {
        const { data: pubUrl } = supabase.storage.from("cake-designs").getPublicUrl(data.path);
        set("design_image_url", pubUrl.publicUrl);
        toast.success("تم رفع صورة التصميم بنجاح 📸");
      }
    } catch {
      toast.error("تعذر رفع الصورة");
    } finally {
      setUploadingImage(false);
    }
  };

  const submit = useMutation({
    mutationFn: async (payload: SocialOrderInput) => {
      return createFn({ data: payload });
    },
    onSuccess: (data) => {
      setDone(data.order_number);
      toast.success(`تم حفظ الطلب بنجاح ✅ (DL-${data.order_number})`);
      setForm(getEmptyForm());
      void queryClient.invalidateQueries({ queryKey: ["social-orders"] });
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error(err.message || "حدث خطأ أثناء حفظ الطلب");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      toast.error("يرجى كتابة اسم العميل");
      setStep1Open(true);
      return;
    }
    if (!form.customer_phone.trim()) {
      toast.error("يرجى كتابة رقم هاتف العميل");
      setStep1Open(true);
      return;
    }
    if (form.method === "delivery" && !form.area) {
      toast.error("يرجى اختيار منطقة التوصيل");
      setStep1Open(true);
      return;
    }
    if (!finalOrderDetails.trim()) {
      toast.error("يرجى اختيار أو كتابة تفاصيل الكيكة المطلوبة");
      setStep2Open(true);
      return;
    }

    const payload: SocialOrderInput = {
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      sender_phone: form.is_recipient_different ? form.customer_phone.trim() : undefined,
      recipient_name: form.is_recipient_different ? form.recipient_name.trim() : undefined,
      recipient_phone: form.is_recipient_different ? form.recipient_phone.trim() : undefined,
      requested_date: form.requested_date,
      requested_time: form.requested_time,
      event_date: form.event_date || undefined,
      method: form.method,
      area: form.method === "delivery" ? form.area : undefined,
      address: form.method === "delivery" ? form.address.trim() : undefined,
      order_details: finalOrderDetails,
      quantity: form.quantity,
      unit_price: unitPrice,
      payment_option: form.payment_option,
      deposit_paid: form.payment_option === "cash" ? 0 : Number(form.deposit_paid) || 0,
      customer_notes: form.customer_notes.trim() || undefined,
      staff_notes: form.staff_notes.trim() || undefined,
      design_image_url: form.design_image_url || undefined,
      is_urgent: form.is_urgent,
    };

    submit.mutate(payload);
  };

  const copy = useCallback((text: string, which: "summary" | "confirmation") => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(which);
        toast.success("تم نسخ رسالة الواتساب بنجاح 📋");
        window.setTimeout(() => setCopied(null), 2500);
      });
    } else {
      toast.info("تم تحديد النص للنسخ");
    }
  }, []);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/social-login", replace: true });
  }, [navigate]);

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
          className="min-h-[48px] px-6 rounded-full bg-[#8B4513] text-white text-xs font-bold shadow-sm hover:bg-[#5D2E17] cursor-pointer"
        >
          تسجيل الخروج
        </button>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#FAF6F0] text-[#3E2723] pb-16 font-sans">
      <header className="sticky top-0 z-30 border-b border-[#B8860B]/20 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#8B4513] text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base text-[#3E2723] leading-tight">شاشة السوشيال ميديا</h1>
              <p className="text-[11px] font-semibold text-[#8B4513]">إدخال طلبات إنستغرام وواتساب بسهولة وسرعة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-[#FAF6F0] p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setView("new")}
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
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
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                  view === "orders"
                    ? "bg-[#8B4513] text-white shadow-xs"
                    : "text-[#5D2E17] hover:bg-white/60"
                }`}
              >
                الطلبات
              </button>
              <button
                type="button"
                onClick={() => setView("modifications")}
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
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
              className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-3 sm:px-4 pt-4 space-y-4">
        {done && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Check className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>تم حفظ الطلب بنجاح برقم: <strong className="text-emerald-950 font-black text-sm">{`DL-${done}`}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setDone(null)}
              className="min-h-[48px] px-3 text-xs font-black text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {view === "new" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* STEP 1: FOLDABLE CARD - Customer & Delivery */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <button
                type="button"
                onClick={() => setStep1Open((v) => !v)}
                className="w-full min-h-[52px] flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#8B4513] text-xs font-black text-white">
                    1
                  </span>
                  <div className="text-start">
                    <h3 className="font-bold text-base text-[#3E2723]">العميل وموعد التسليم</h3>
                    <p className="text-[11px] text-[#7A6458]">الاسم، الهاتف، التوصيل أو الاستلام</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {form.customer_name && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      {form.customer_name} ✓
                    </span>
                  )}
                  {step1Open ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </div>
              </button>

              {step1Open && (
                <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-[#3E2723]">
                      اسم العميل *
                      <input
                        type="text"
                        required
                        value={form.customer_name}
                        onChange={(e) => set("customer_name", e.target.value)}
                        placeholder="مثال: أم أحمد"
                        className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#3E2723]">
                      رقم الواتساب / الهاتف الرئيسي *
                      <input
                        type="tel"
                        inputMode="tel"
                        required
                        dir="ltr"
                        value={form.customer_phone}
                        onChange={(e) => set("customer_phone", e.target.value)}
                        placeholder="079XXXXXXX"
                        className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl bg-[#FFF8EE] p-3 border border-[#B8860B]/20">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-[#5D2E17] min-h-[40px]">
                      <input
                        type="checkbox"
                        checked={form.is_recipient_different}
                        onChange={(e) => set("is_recipient_different", e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-[#8B4513] focus:ring-[#B8860B]"
                      />
                      <span>المستلم شخص آخر (هدية / توصيل لطرف ثاني)</span>
                    </label>

                    {form.is_recipient_different && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 pt-2 border-t border-[#B8860B]/20 animate-in fade-in duration-200">
                        <label className="block text-xs font-bold text-[#3E2723]">
                          اسم المستلم
                          <input
                            type="text"
                            value={form.recipient_name}
                            onChange={(e) => set("recipient_name", e.target.value)}
                            placeholder="اسم المستلم"
                            className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                          />
                        </label>

                        <label className="block text-xs font-bold text-[#3E2723]">
                          رقم هاتف المستلم
                          <input
                            type="tel"
                            inputMode="tel"
                            dir="ltr"
                            value={form.recipient_phone}
                            onChange={(e) => set("recipient_phone", e.target.value)}
                            placeholder="رقم المستلم"
                            className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => set("method", "pickup")}
                        className={`min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                        className={`min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          form.method === "delivery"
                            ? "bg-[#8B4513] text-white shadow-xs"
                            : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                        }`}
                      >
                        <Truck className="h-4 w-4" /> توصيل مع دليفري
                      </button>
                    </div>

                    {form.method === "delivery" && (
                      <div className="grid gap-3 sm:grid-cols-2 pt-1">
                        <label className="block text-xs font-bold text-[#3E2723]">
                          منطقة التوصيل *
                          <select
                            value={form.area}
                            onChange={(e) => set("area", e.target.value)}
                            className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                          >
                            <option value="">— اختر المنطقة —</option>
                            {DELIVERY_ZONES.map((zone) => (
                              <optgroup key={zone.labelAr} label={zone.labelAr}>
                                {zone.areas.map((area) => (
                                  <option key={`${zone.labelAr}-${area}`} value={area}>
                                    {area === OTHER_GOVERNORATES_AREA
                                      ? `${area} (٥–٨ د.أ)`
                                      : `${area} (${zone.fee.toFixed(2)} د.أ)`}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          {form.area && (
                            <span className="mt-1 block text-[11px] font-bold text-[#8B4513]">
                              {form.area === OTHER_GOVERNORATES_AREA
                                ? "أجرة التوصيل ٥–٨ د.أ (تحدد حسب العنوان)"
                                : `أجرة التوصيل: ${(areaFee ?? 0).toFixed(2)} د.أ`}
                            </span>
                          )}
                        </label>

                        <label className="block text-xs font-bold text-[#3E2723]">
                          العنوان التفصيلي
                          <input
                            type="text"
                            value={form.address}
                            onChange={(e) => set("address", e.target.value)}
                            placeholder="شارع، عمارة، شقة..."
                            className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <label className="block text-xs font-bold text-[#3E2723]">
                      تاريخ التسليم *
                      <input
                        type="date"
                        required
                        value={form.requested_date}
                        onChange={(e) => set("requested_date", e.target.value)}
                        className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#3E2723]">
                      وقت التسليم *
                      <input
                        type="time"
                        required
                        value={form.requested_time}
                        onChange={(e) => set("requested_time", e.target.value)}
                        className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            {/* STEP 2: FOLDABLE CARD - Cake Content (Clear Toggle: Menu vs Custom) */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <button
                type="button"
                onClick={() => setStep2Open((v) => !v)}
                className="w-full min-h-[52px] flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#8B4513] text-xs font-black text-white">
                    2
                  </span>
                  <div className="text-start">
                    <h3 className="font-bold text-base text-[#3E2723]">محتوى الكيكة</h3>
                    <p className="text-[11px] text-[#7A6458]">منيو الموقع الجاهز أو كيك تفصيل مخصص</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#8B4513] bg-[#FFF8EE] px-2.5 py-1 rounded-lg">
                    {form.order_mode === "menu" ? "منيو جاهز" : "تفصيل مخصص"}
                  </span>
                  {step2Open ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </div>
              </button>

              {step2Open && (
                <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#FAF6F0] border border-slate-200">
                    <button
                      type="button"
                      onClick={() => set("order_mode", "menu")}
                      className={`min-h-[48px] rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        form.order_mode === "menu"
                          ? "bg-[#8B4513] text-white shadow-xs"
                          : "text-[#5D2E17] hover:bg-white/60"
                      }`}
                    >
                      🍰 منيو الموقع الجاهز
                    </button>
                    <button
                      type="button"
                      onClick={() => set("order_mode", "custom")}
                      className={`min-h-[48px] rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        form.order_mode === "custom"
                          ? "bg-[#8B4513] text-white shadow-xs"
                          : "text-[#5D2E17] hover:bg-white/60"
                      }`}
                    >
                      🎨 كيك تفصيل مخصص
                    </button>
                  </div>

                  {form.order_mode === "menu" && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                          <input
                            type="search"
                            value={menuSearch}
                            onChange={(e) => setMenuSearch(e.target.value)}
                            placeholder="ابحث عن كيكة أو صنف من المنيو..."
                            className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#F9FBFC] pr-9 pl-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                          />
                        </div>

                        <select
                          value={menuCategory}
                          onChange={(e) => setMenuCategory(e.target.value)}
                          className="min-h-[48px] rounded-xl border border-slate-200 bg-[#F9FBFC] px-3 text-xs font-bold text-[#5D2E17] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
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
                              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-[#B8860B] hover:shadow-xs transition-all text-right flex flex-col justify-between space-y-1.5 active:scale-98"
                            >
                              <div>
                                <span className="font-extrabold text-xs text-[#3E2723] block leading-snug">{prod.name_ar}</span>
                                {prod.filling_ar && (
                                  <span className="text-[10px] text-slate-500 block">حشوة: {prod.filling_ar}</span>
                                )}
                              </div>
                              <div className="flex items-center justify-between text-xs font-black text-[#8B4513] pt-1 border-t border-slate-100">
                                <span>{prod.price_on_request ? "عند الطلب" : `${prod.price.toFixed(2)} د.أ`}</span>
                                <span className="text-[10px] bg-[#FFF8EE] text-[#8B4513] px-2 py-0.5 rounded-full border border-[#B8860B]/30">اختيار ✓</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-xs text-slate-500 py-6 col-span-full">لا يوجد منتجات تطابق البحث</p>
                        )}
                      </div>

                      <label className="block text-xs font-bold text-[#3E2723] pt-1">
                        الصنف المختار
                        <input
                          type="text"
                          value={form.order_details}
                          onChange={(e) => set("order_details", e.target.value)}
                          placeholder="سيظهر اسم الكيك المختار من المنيو هنا"
                          className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm font-bold text-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                        />
                      </label>
                    </div>
                  )}

                  {form.order_mode === "custom" && (
                    <div className="space-y-3 animate-in fade-in duration-150 rounded-2xl bg-[#FFF8EE]/50 p-4 border border-[#B8860B]/30">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="block text-xs font-bold text-[#3E2723]">
                          الحجم *
                          <select
                            value={form.custom_size}
                            onChange={(e) => set("custom_size", e.target.value)}
                            className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
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
                            className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
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
                            className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                          />
                        </label>
                      </div>

                      <label className="block text-xs font-bold text-[#3E2723]">
                        تفاصيل التصميم المخصص
                        <input
                          type="text"
                          value={form.order_details}
                          onChange={(e) => set("order_details", e.target.value)}
                          placeholder="اكتب أي تفاصيل إضافية لتصميم الكيكة..."
                          className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                        />
                      </label>

                      <div className="pt-1">
                        <span className="text-xs font-bold text-[#3E2723] block mb-1">رفع صورة مرجعية للتصميم</span>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#B8860B] bg-white px-4 text-xs font-bold text-[#8B4513] hover:bg-[#FFF8EE] transition">
                            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {uploadingImage ? "جاري الرفع..." : "اختيار صورة التصميم"}
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
                          {form.design_image_url && (
                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-2 rounded-xl border border-emerald-200 text-xs font-extrabold">
                              <ImageIcon className="h-4 w-4 text-emerald-600" />
                              <span>تم إرفاق الصورة ✓</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* STEP 3: FOLDABLE CARD - Financials, Notes & WhatsApp Generator */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <button
                type="button"
                onClick={() => setStep3Open((v) => !v)}
                className="w-full min-h-[52px] flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#8B4513] text-xs font-black text-white">
                    3
                  </span>
                  <div className="text-start">
                    <h3 className="font-bold text-base text-[#3E2723]">الحساب والرسالة الجاهزة</h3>
                    <p className="text-[11px] text-[#7A6458]">الأسعار، الملاحظات، وتوليد رسالة الواتساب</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#8B4513]">
                    {grandTotal.toFixed(2)} د.أ
                  </span>
                  {step3Open ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </div>
              </button>

              {step3Open && (
                <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-[#3E2723]">
                      الكمية
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={form.quantity}
                        onChange={(e) => set("quantity", Math.max(1, Number(e.target.value) || 1))}
                        className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#3E2723]">
                      السعر الإجمالي للكيك/الأصناف (د.أ) *
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        dir="ltr"
                        required
                        value={form.unit_price}
                        onChange={(e) => set("unit_price", e.target.value)}
                        placeholder="0.00"
                        className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm font-bold text-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>
                  </div>

                  <fieldset className="text-xs font-bold text-[#3E2723]">
                    <legend className="mb-1">طريقة الدفع</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { value: "cash", label: "كاش عند الاستلام" },
                          { value: "cliq_full", label: "كليك كامل" },
                          { value: "cliq_deposit", label: "عربون كليك" },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => set("payment_option", option.value)}
                          className={`min-h-[48px] rounded-xl px-2 text-xs font-bold transition-all cursor-pointer ${
                            form.payment_option === option.value
                              ? "bg-[#8B4513] text-white shadow-xs"
                              : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {form.payment_option !== "cash" && (
                      <label className="mt-2 block text-xs font-bold text-[#3E2723]">
                        {form.payment_option === "cliq_full"
                          ? "المبلغ الكامل المدفوع عبر كليك (د.أ)"
                          : "قيمة العربون المدفوع عبر كليك (د.أ)"}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          dir="ltr"
                          value={form.deposit_paid}
                          onChange={(e) => set("deposit_paid", e.target.value)}
                          className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm font-bold text-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                        />
                      </label>
                    )}
                  </fieldset>

                  <div className="rounded-2xl border border-[#B8860B]/30 bg-[#FFF8EE] p-4">
                    <h4 className="text-xs font-extrabold text-[#5D2E17] border-b border-[#B8860B]/20 pb-1.5">
                      الحساب المالي للطلب
                    </h4>
                    <dl className="mt-2 space-y-1 text-xs text-[#3E2723]">
                      <div className="flex justify-between">
                        <dt>ثمن الأصناف ({form.quantity} × {(Number(form.unit_price) || 0).toFixed(2)})</dt>
                        <dd className="font-bold">{originalPrice.toFixed(2)} د.أ</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>أجرة التوصيل</dt>
                        <dd className="font-bold">{deliveryFee.toFixed(2)} د.أ</dd>
                      </div>
                      <div className="flex justify-between border-t border-[#B8860B]/20 pt-1 text-base font-black">
                        <dt>إجمالي الطلب</dt>
                        <dd className="text-[#8B4513]">{grandTotal.toFixed(2)} د.أ</dd>
                      </div>
                      <div className="flex justify-between text-emerald-800">
                        <dt>المدفوع كليك</dt>
                        <dd className="font-bold">{paidAmount.toFixed(2)} د.أ</dd>
                      </div>
                      <div className="flex justify-between font-black text-sm text-[#8B4513] border-t border-[#B8860B]/20 pt-1">
                        <dt>المتبقي عند الاستلام</dt>
                        <dd>{remaining.toFixed(2)} د.أ</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Consolidate 4 notes into 2 clear fields */}
                  <div className="space-y-3 pt-1">
                    <label className="block text-xs font-bold text-[#3E2723]">
                      1. ملاحظات الزبون والكتابة على الكيك (تظهر للمطبخ وفي رسالة الواتساب)
                      <textarea
                        rows={2}
                        value={form.customer_notes}
                        onChange={(e) => set("customer_notes", e.target.value)}
                        placeholder="اكتب عبارة المعايدة أو الكتابة على الكيك وأي تفاصيل خاصة بالزبون..."
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>

                    <label className="block text-xs font-bold text-[#3E2723]">
                      2. ملاحظات داخلية للفريق (سرية - خاصة بالمبيعات والإدارة فقط)
                      <textarea
                        rows={2}
                        value={form.staff_notes}
                        onChange={(e) => set("staff_notes", e.target.value)}
                        placeholder="ملاحظات سرية للفريق لا تظهر للزبون ولا للمطبخ..."
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                      />
                    </label>
                  </div>

                  {/* WhatsApp Confirmation Generator & Big Copy Button */}
                  <div className="rounded-2xl border border-[#B8860B]/40 bg-[#FFFDF9] p-4 space-y-3">
                    <span className="font-extrabold text-xs text-[#3E2723] block">
                      👑 رسالة تأكيد الطلب للواتساب (جاهزة للإرسال)
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copy(confirmationPreview, "confirmation")}
                        className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#B8860B] bg-white px-4 text-xs font-black text-[#8B4513] hover:bg-[#FFF8EE] active:scale-95 transition cursor-pointer shadow-2xs"
                      >
                        {copied === "confirmation" ? <Check className="h-4 w-4 text-emerald-600" /> : <ClipboardCopy className="h-4 w-4" />}
                        {copied === "confirmation" ? "تم نسخ الرسالة بنجاح ✓" : "[ نسخ رسالة الواتساب الجاهزة ]"}
                      </button>

                      <a
                        href={whatsappUrl(confirmationPreview)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="إرسال عبر الواتساب"
                        className="grid h-12 w-12 place-items-center rounded-xl bg-[#25D366] text-white shadow-sm hover:brightness-95 active:scale-95 transition"
                      >
                        <MessageCircle className="h-6 w-6" />
                      </a>
                    </div>

                    <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-[#F9FBFC] p-3 text-xs text-[#3E2723] border border-slate-200 select-text">
                      {confirmationPreview}
                    </pre>
                  </div>

                  {/* Explicit Save & Confirm Action Button */}
                  <button
                    type="submit"
                    disabled={submit.isPending}
                    className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-[#8B4513] text-white font-black text-sm shadow-md hover:bg-[#5D2E17] active:scale-98 disabled:opacity-60 transition cursor-pointer"
                  >
                    {submit.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    [ حفظ وإنشاء الطلب وتأكيده 💾 ]
                  </button>
                </div>
              )}
            </div>
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