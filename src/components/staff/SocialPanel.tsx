import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  AlertTriangle,
  Cake,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Clock,
  DollarSign,
  Gift,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Layers,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Share2,
  Sparkles,
  Store,
  Truck,
  Upload,
  User,
  X,
  Zap,
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

  // Catalog search & filter for Menu Mode
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
  const deliveryFee = form.method === "delivery" ? (areaFee ?? 0) : 0;

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
        cardWriting: "",
        paymentMethod:
          form.payment_option === "cliq_full"
            ? `دفع كامل كليك (${paidAmount.toFixed(2)} د.أ)`
            : form.payment_option === "cliq_deposit"
              ? `عربون كليك (${paidAmount.toFixed(2)} د.أ)`
              : "كاش عند الاستلام",
        price: originalPrice,
        deliveryFee,
        total: grandTotal,
        paid: paidAmount,
        recipientPhone: form.is_recipient_different ? form.recipient_phone.trim() : form.customer_phone.trim(),
        senderPhone: form.customer_phone.trim(),
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
        toast.error("حجم الصورة كبير جداً (الحد الأقصى 5 ميغابايت)");
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
        toast.success("تم رفع صورة التصميم المرجعية بنجاح 📸");
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
      toast.success(`تم حفظ الطلب وتأكيده بنجاح ✅ (DL-${data.order_number})`);
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
      toast.error("يرجى إدخال اسم العميل");
      return;
    }
    if (!form.customer_phone.trim()) {
      toast.error("يرجى إدخال رقم هاتف العميل");
      return;
    }
    if (form.method === "delivery" && !form.area) {
      toast.error("يرجى اختيار منطقة التوصيل");
      return;
    }
    if (!finalOrderDetails.trim()) {
      toast.error("يرجى اختيار أو كتابة تفاصيل الكيكة المطلوبة");
      return;
    }

    const payload: SocialOrderInput = {
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      sender_phone: form.is_recipient_different ? form.customer_phone.trim() : undefined,
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
      design_notes: form.customer_notes.trim() || undefined,
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
        toast.success("تم نسخ رسالة الواتساب إلى الحافظة 📋");
        window.setTimeout(() => setCopied(null), 2500);
      });
    } else {
      toast.info("تم تحديد نص الرسالة");
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/social-login", replace: true });
  }, [navigate]);

  if (access.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (access.isError || !access.data?.allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center text-foreground">
        <AlertTriangle className="h-12 w-12 text-rose-500 mb-2" />
        <h2 className="font-bold text-lg mb-1">غير مصرح بالوصول</h2>
        <p className="text-xs text-muted-foreground mb-4">الحساب غير مخول لاستخدام شاشة السوشيال ميديا.</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-[44px] px-6 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:opacity-90 cursor-pointer"
        >
          تسجيل الخروج
        </button>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen w-full bg-background text-foreground pb-20 font-sans select-none">
      {/* 1. MASTER SOCIAL INTAKE HEADER */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm shrink-0">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg text-foreground leading-none">
                  كونسول طلبات السوشيال ميديا والواتساب
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  مباشر ومرتبط بـ WhatsApp
                </span>
              </div>
              <p className="text-xs font-bold text-muted-foreground mt-1">
                استقبال طلبات إنستغرام وواتساب • توليد رسالة التأكيد تلقائياً • احتساب العربون والتوصيل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nav Switcher */}
            <div className="flex rounded-2xl bg-secondary/60 p-1 border border-border/70">
              <button
                type="button"
                onClick={() => setView("new")}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  view === "new"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                + استقبال طلب جديد
              </button>
              <button
                type="button"
                onClick={() => setView("orders")}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  view === "orders"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                سجل الطلبات
              </button>
              <button
                type="button"
                onClick={() => setView("modifications")}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  view === "modifications"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                سجل التعديلات
              </button>
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              title="تسجيل الخروج"
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-4 space-y-4">
        {/* Success Confirmation Banner */}
        {done && (
          <div className="rounded-3xl border-2 border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-emerald-950 dark:text-emerald-50 shadow-md flex items-center justify-between gap-3 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-black text-sm">تم إنشاء وتأكيد الطلب بنجاح في النظام!</h4>
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                  رقم الطلب المعتمد: <strong className="font-black text-base">{`DL-${done}`}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copy(confirmationPreview, "confirmation")}
                className="min-h-[40px] px-3.5 rounded-xl bg-card border border-emerald-300 text-xs font-black text-emerald-900 hover:bg-emerald-100 transition cursor-pointer"
              >
                نسخ رسالة الواتساب 📋
              </button>
              <button
                type="button"
                onClick={() => setDone(null)}
                className="min-h-[40px] px-3 text-xs font-black text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>
          </div>
        )}

        {view === "new" ? (
          <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-12 items-start">
            {/* 2. RIGHT PANEL (60%): Interactive Order & Cake Builder Studio */}
            <div className="min-w-0 lg:col-span-7 xl:col-span-8 space-y-4">
              {/* SECTION A: Customer & Logistics Dossier */}
              <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-foreground">بيانات العميل وموعد التسليم</h3>
                      <p className="text-[11px] font-bold text-muted-foreground">
                        رقم هاتف الواتساب، طريقة الاستلام، وموعد المناسبة
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-black text-rose-600 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20">
                    <input
                      type="checkbox"
                      checked={form.is_urgent}
                      onChange={(e) => set("is_urgent", e.target.checked)}
                      className="h-4 w-4 rounded border-rose-300 text-rose-600 accent-rose-600"
                    />
                    <span>🚨 طلب مستعجل (Urgent)</span>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      اسم العميل *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.customer_name}
                      onChange={(e) => set("customer_name", e.target.value)}
                      placeholder="مثال: أم أحمد / د. رانيا"
                      className="min-h-[44px] w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      رقم هاتف الواتساب *
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        inputMode="tel"
                        required
                        dir="ltr"
                        value={form.customer_phone}
                        onChange={(e) => set("customer_phone", e.target.value)}
                        placeholder="079XXXXXXX"
                        className="min-h-[44px] w-full rounded-xl border border-input bg-background ps-3 pe-8 text-sm font-black text-foreground outline-none focus:border-primary"
                      />
                      <MessageCircle className="absolute end-2.5 top-3.5 h-4 w-4 text-emerald-600 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Gift Recipient Toggle */}
                <div className="rounded-2xl bg-secondary/40 p-3 border border-border/80">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-black text-foreground">
                    <input
                      type="checkbox"
                      checked={form.is_recipient_different}
                      onChange={(e) => set("is_recipient_different", e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary accent-primary"
                    />
                    <span>🎁 هذا الطلب هدية لطرف آخر (مستلم ومشتري منفصلين)</span>
                  </label>

                  {form.is_recipient_different && (
                    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 pt-2.5 border-t border-border/60 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">اسم المستلم</label>
                        <input
                          type="text"
                          value={form.recipient_name}
                          onChange={(e) => set("recipient_name", e.target.value)}
                          placeholder="اسم المستلم"
                          className="min-h-[40px] w-full rounded-lg border border-input bg-card px-2.5 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">هاتف المستلم</label>
                        <input
                          dir="ltr"
                          type="tel"
                          value={form.recipient_phone}
                          onChange={(e) => set("recipient_phone", e.target.value)}
                          placeholder="07XXXXXXXX"
                          className="min-h-[40px] w-full rounded-lg border border-input bg-card px-2.5 text-xs font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Fulfillment Selection */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => set("method", "pickup")}
                      className={`min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        form.method === "pickup"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "border-border bg-card text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <Store className="h-4 w-4" /> استلام من المحل
                    </button>

                    <button
                      type="button"
                      onClick={() => set("method", "delivery")}
                      className={`min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        form.method === "delivery"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "border-border bg-card text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <Truck className="h-4 w-4" /> توصيل مع دليفري
                    </button>
                  </div>

                  {form.method === "delivery" && (
                    <div className="grid gap-3 sm:grid-cols-2 rounded-2xl bg-secondary/30 p-3.5 border border-border/80 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                          منطقة التوصيل *
                        </label>
                        <select
                          value={form.area}
                          onChange={(e) => set("area", e.target.value)}
                          className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-xs font-black text-foreground outline-none focus:border-primary"
                        >
                          <option value="">— اختر المنطقة لحساب الأجرة —</option>
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
                          <span className="mt-1.5 block text-[11px] font-black text-amber-600">
                            {form.area === OTHER_GOVERNORATES_AREA
                              ? "أجرة التوصيل ٥–٨ د.أ (تحدد حسب العنوان)"
                              : `أجرة التوصيل: ${(areaFee ?? 0).toFixed(2)} د.أ`}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                          العنوان التفصيلي
                        </label>
                        <input
                          type="text"
                          value={form.address}
                          onChange={(e) => set("address", e.target.value)}
                          placeholder="الشارع، البناية، الطابق، الشقة..."
                          className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Date & Time Slot */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      تاريخ التسليم *
                    </label>
                    <input
                      type="date"
                      required
                      value={form.requested_date}
                      onChange={(e) => set("requested_date", e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      وقت التسليم *
                    </label>
                    <input
                      type="time"
                      required
                      value={form.requested_time}
                      onChange={(e) => set("requested_time", e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      تاريخ المناسبة (اختياري)
                    </label>
                    <input
                      type="date"
                      value={form.event_date}
                      onChange={(e) => set("event_date", e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION B: Cake Selection & Custom Studio */}
              <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                      <Cake className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-foreground">محتوى الكيك وتفاصيل التصميم</h3>
                      <p className="text-[11px] font-bold text-muted-foreground">
                        اختر من المنيو الجاهز أو حدد مواصفات الكيك التفصيل المخصص
                      </p>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex rounded-xl bg-secondary/70 p-1 border border-border/80">
                    <button
                      type="button"
                      onClick={() => set("order_mode", "menu")}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        form.order_mode === "menu"
                          ? "bg-card text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      🍰 منيو جاهز
                    </button>
                    <button
                      type="button"
                      onClick={() => set("order_mode", "custom")}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        form.order_mode === "custom"
                          ? "bg-card text-primary shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      🎨 تفصيل مخصص
                    </button>
                  </div>
                </div>

                {/* Option 1: Store Menu Catalog */}
                {form.order_mode === "menu" && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <input
                          type="search"
                          value={menuSearch}
                          onChange={(e) => setMenuSearch(e.target.value)}
                          placeholder="ابحث عن كيكة أو صنف من المنيو..."
                          className="w-full min-h-[44px] rounded-xl border border-input bg-background pr-9 pl-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                        />
                      </div>

                      <select
                        value={menuCategory}
                        onChange={(e) => setMenuCategory(e.target.value)}
                        className="min-h-[44px] rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                      >
                        <option value="all">كل الأقسام</option>
                        {categoriesList
                          .filter((c) => c !== "all")
                          .map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-h-64 overflow-y-auto p-2 border border-border/70 rounded-2xl bg-secondary/20">
                      {filteredMenuProducts.length > 0 ? (
                        filteredMenuProducts.map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => selectProductFromMenu(prod)}
                            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-3 shadow-2xs hover:border-primary/50 hover:shadow-xs transition-all text-right flex flex-col justify-between space-y-2 active:scale-98"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <span className="font-black text-xs text-foreground block leading-snug">
                                  {prod.name_ar}
                                </span>
                                {prod.filling_ar && (
                                  <span className="text-[10px] text-muted-foreground block">
                                    حشوة: {prod.filling_ar}
                                  </span>
                                )}
                              </div>
                              {prod.image_url && (
                                <img
                                  src={prod.image_url}
                                  alt={prod.name_ar}
                                  className="h-9 w-9 rounded-xl object-cover border border-border/60 shrink-0"
                                />
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs font-black text-primary pt-1.5 border-t border-border/40">
                              <span>{prod.price_on_request ? "عند الطلب" : jd(prod.price)}</span>
                              <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                                اختيار ✓
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-xs font-bold text-muted-foreground py-8 col-span-full">
                          لا توجد أصناف مطابقة للبحث
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">الصنف المختار</label>
                      <input
                        type="text"
                        value={form.order_details}
                        onChange={(e) => set("order_details", e.target.value)}
                        placeholder="اسم الصنف المختار من المنيو..."
                        className="min-h-[46px] w-full rounded-xl border border-input bg-card px-3.5 text-sm font-black text-primary outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                )}

                {/* Option 2: Custom Cake Builder Studio */}
                {form.order_mode === "custom" && (
                  <div className="space-y-4 animate-in fade-in duration-150 rounded-2xl bg-amber-500/5 p-4 border border-amber-500/20">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                          حجم الكيكة *
                        </label>
                        <select
                          value={form.custom_size}
                          onChange={(e) => set("custom_size", e.target.value)}
                          className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-xs font-black text-foreground outline-none focus:border-primary"
                        >
                          <option value="">— اختر الحجم —</option>
                          <option value="6 انش (يكفي 6-8 أشخاص)">6 انش (6-8 أشخاص)</option>
                          <option value="8 انش (يكفي 10-12 شخص)">8 انش (10-12 شخص)</option>
                          <option value="10 انش (يكفي 15-18 شخص)">10 انش (15-18 شخص)</option>
                          <option value="دورين صغير (20 شخص)">دورين صغير (20 شخص)</option>
                          <option value="دورين كبير (35+ شخص)">دورين كبير (35+ شخص)</option>
                          <option value="حجم مخصص">حجم مخصص آخر</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                          نكهة الكيكة *
                        </label>
                        <select
                          value={form.custom_flavor}
                          onChange={(e) => set("custom_flavor", e.target.value)}
                          className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-xs font-black text-foreground outline-none focus:border-primary"
                        >
                          <option value="">— اختر النكهة —</option>
                          <option value="فانيليا">فانيليا (Vanilla)</option>
                          <option value="شوكولاتة">شوكولاتة (Chocolate)</option>
                          <option value="ريد فيلفيت">ريد فيلفيت (Red Velvet)</option>
                          <option value="مكس فانيليا وشوكولاتة">مكس فانيليا وشوكولاتة</option>
                          <option value="ليمون / توت">ليمون / توت</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                          الحشوة المختارة *
                        </label>
                        <input
                          type="text"
                          value={form.custom_filling}
                          onChange={(e) => set("custom_filling", e.target.value)}
                          placeholder="نوتيلا، لوتس، كيندر، بستاشيو..."
                          className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        تفاصيل وتوجيهات التصميم
                      </label>
                      <input
                        type="text"
                        value={form.order_details}
                        onChange={(e) => set("order_details", e.target.value)}
                        placeholder="ألوان الكريمة، المجسمات، أو أي تفاصيل تخص الشكل..."
                        className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3.5 text-xs font-bold text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    {/* Image Upload */}
                    <div className="pt-1">
                      <span className="text-xs font-bold text-foreground block mb-1.5">
                        صورة مرجعية للتصميم (من إنستغرام أو بنترست):
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="cursor-pointer inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-primary/40 bg-card px-4 text-xs font-black text-primary hover:bg-primary/10 transition shadow-2xs">
                          {uploadingImage ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {uploadingImage ? "جاري الرفع..." : "رفع صورة التصميم 📸"}
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
                          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-black">
                            <img
                              src={form.design_image_url}
                              alt="معاينة التصميم"
                              className="h-7 w-7 rounded-lg object-cover"
                            />
                            <span>تم إرفاق صورة التصميم ✓</span>
                            <button
                              type="button"
                              onClick={() => set("design_image_url", "")}
                              className="text-rose-500 hover:text-rose-700 p-0.5"
                              title="حذف"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes & Special Inscriptions */}
                <div className="space-y-3 pt-2 border-t border-border/60">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      ✍️ عبارة المعايدة / الكتابة على الكيكة (تظهر في رسالة الواتساب وتذكرة المطبخ)
                    </label>
                    <textarea
                      rows={2}
                      value={form.customer_notes}
                      onChange={(e) => set("customer_notes", e.target.value)}
                      placeholder="اكتب العبارة المطلوبة على الكيكة أو كرت المعايدة..."
                      className="w-full rounded-2xl border border-input bg-background p-3 text-xs font-black text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      🔒 ملاحظات داخلية للفريق (سرية - لا تظهر للزبون)
                    </label>
                    <textarea
                      rows={2}
                      value={form.staff_notes}
                      onChange={(e) => set("staff_notes", e.target.value)}
                      placeholder="ملاحظات خاصة بالإدارة أو المطبخ..."
                      className="w-full rounded-2xl border border-input bg-background p-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. LEFT PANEL (40%): Live Ticket & WhatsApp Instant Terminal */}
            <div className="min-w-0 lg:col-span-5 xl:col-span-4 space-y-4">
              <div className="sticky top-20 space-y-4">
                {/* Billing Summary Box */}
                <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
                    <span className="font-black text-sm text-foreground flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      الحساب المالي والدفع
                    </span>
                    <span className="text-xs font-black text-primary">
                      {jd(grandTotal)}
                    </span>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">الكمية</label>
                      <input
                        type="number"
                        min="1"
                        value={form.quantity}
                        onChange={(e) => set("quantity", Math.max(1, Number(e.target.value) || 1))}
                        className="min-h-[42px] w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">سعر الكيك (د.أ) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        required
                        value={form.unit_price}
                        onChange={(e) => set("unit_price", e.target.value)}
                        placeholder="0.00"
                        className="min-h-[42px] w-full rounded-xl border border-input bg-background px-3 text-sm font-black text-primary outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">طريقة الدفع</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { value: "cash", label: "كاش استلام" },
                          { value: "cliq_full", label: "كليك كامل" },
                          { value: "cliq_deposit", label: "عربون كليك" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => set("payment_option", opt.value)}
                          className={`min-h-[42px] rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            form.payment_option === opt.value
                              ? "bg-primary text-primary-foreground border-primary font-black shadow-2xs"
                              : "border-border bg-card text-foreground hover:bg-secondary/60"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {form.payment_option !== "cash" && (
                      <div className="mt-2">
                        <label className="block text-xs font-bold text-foreground mb-1">
                          {form.payment_option === "cliq_full" ? "المبلغ المدفوع كليك (د.أ)" : "قيمة العربون المدفوع (د.أ)"}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.deposit_paid}
                          onChange={(e) => set("deposit_paid", e.target.value)}
                          className="min-h-[42px] w-full rounded-xl border border-input bg-card px-3 text-sm font-black text-primary outline-none focus:border-primary"
                        />
                      </div>
                    )}
                  </div>

                  {/* Line Item Breakdown */}
                  <div className="rounded-2xl bg-secondary/30 p-3 text-xs space-y-1.5 border border-border/70">
                    <div className="flex justify-between">
                      <span>سعر الكيك:</span>
                      <span className="font-bold">{jd(originalPrice)}</span>
                    </div>
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-amber-600 font-bold">
                        <span>أجور التوصيل:</span>
                        <span>+{jd(deliveryFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-sm border-t border-border/60 pt-1.5 text-foreground">
                      <span>إجمالي الطلب:</span>
                      <span className="text-primary text-base">{jd(grandTotal)}</span>
                    </div>
                    {paidAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>المدفوع كليك:</span>
                        <span>{jd(paidAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-xs text-rose-600 border-t border-border/40 pt-1">
                      <span>المتبقي عند الاستلام:</span>
                      <span>{jd(remaining)}</span>
                    </div>
                  </div>
                </div>

                {/* Live WhatsApp Chat Bubble Preview */}
                <div className="rounded-3xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4 text-emerald-600" />
                      معاينة رسالة التأكيد عبر WhatsApp:
                    </span>
                  </div>

                  {/* WhatsApp Message Preview Bubble */}
                  <div className="rounded-2xl border border-emerald-300/60 bg-card p-3 shadow-2xs space-y-2">
                    <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap break-words text-[11px] font-sans text-foreground select-text leading-relaxed font-semibold">
                      {confirmationPreview}
                    </pre>
                  </div>

                  {/* Actions Hub */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copy(confirmationPreview, "confirmation")}
                      className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600/30 bg-card px-3 text-xs font-black text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 active:scale-95 transition cursor-pointer shadow-2xs"
                    >
                      {copied === "confirmation" ? <Check className="h-4 w-4 text-emerald-600" /> : <ClipboardCopy className="h-4 w-4" />}
                      <span>{copied === "confirmation" ? "تم النسخ ✓" : "نسخ الرسالة 📋"}</span>
                    </button>

                    <a
                      href={whatsappUrl(confirmationPreview)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="فتح محادثة واتساب"
                      className="min-h-[44px] px-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-white text-xs font-black shadow-sm hover:brightness-95 active:scale-95 transition cursor-pointer"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>إرسال واتساب</span>
                    </a>
                  </div>
                </div>

                {/* Primary Save Order Button */}
                <button
                  type="submit"
                  disabled={submit.isPending}
                  className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-md hover:opacity-95 active:scale-98 disabled:opacity-50 transition cursor-pointer"
                >
                  {submit.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  <span>حفظ وإنشاء الطلب وتأكيده بالنظام 💾</span>
                </button>
              </div>
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