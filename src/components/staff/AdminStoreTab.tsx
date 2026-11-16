import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Building2,
  Check,
  CreditCard,
  Loader2,
  MapPin,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useDeliveryZonesStore } from "@/hooks/use-delivery-zones";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_PALETTES, useBrandPalette } from "@/lib/brand-palette";
import { DEFAULT_CLIQ_ACCOUNTS, useCliqAccounts, type CliqAccountConfig } from "@/lib/cliq-config";
import { getCmsContent, saveBanner } from "@/lib/cms.functions";
import type { DeliveryZone } from "@/lib/delivery-zones";
import { clearAllSalesOrders } from "@/lib/sales.functions";
import { ADMIN_ANALYTICS_KEY, ORDERS_KEY } from "@/lib/staff-orders-shared";

export function StoreCmsPanel() {
  const queryClient = useQueryClient();
  const cmsFn = useServerFn(getCmsContent);
  const saveBannerFn = useServerFn(saveBanner);

  const cms = useQuery({
    queryKey: ["admin", "cms-content"],
    queryFn: () => cmsFn({}),
    staleTime: 30_000,
  });

  const [discountText, setDiscountText] = useState("40% OFF");
  const [subtitle, setSubtitle] = useState("Everyone's Favorite");
  const [imageUrl, setImageUrl] = useState("");
  const { paletteId: selectedPalette, setPalette: setSelectedPalette } = useBrandPalette();

  const banner = cms.data?.banner;

  useEffect(() => {
    if (!banner) return;
    setDiscountText(banner.discount_text ?? "40% OFF");
    setSubtitle(banner.subtitle ?? "Everyone's Favorite");
    setImageUrl(banner.image_url ?? "");
  }, [banner]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveBannerFn({
        data: {
          discount_text: discountText,
          subtitle,
          button_text: banner?.button_text ?? "Order now",
          image_url: imageUrl || null,
          is_active: banner?.is_active !== false,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "cms-content"] });
      void queryClient.invalidateQueries({ queryKey: ["storefront-content"] });
      toast.success("تم حفظ ونشر البانر الرئيسي على الموقع بنجاح 🌸");
    },
    onError: (err: Error) => toast.error(`تعذر الحفظ: ${err.message}`),
  });

  return (
    <section aria-labelledby="cms-heading" className="space-y-6">
      <div className="space-y-4 rounded-3xl border border-[#EFE8DC] bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8DC] pb-3">
          <div>
            <h2
              id="cms-heading"
              className="flex items-center gap-2 text-base font-black text-[#26160F]"
            >
              <Sparkles className="h-5 w-5 text-[#B8801C]" />
              إدارة البانر العلوي للمتجر (Hero Banner Management)
            </h2>
            <p className="mt-0.5 text-xs text-[#4A3B32]/70">
              تعديل ونشر البانر البارز في أعلى الصفحة الرئيسية للمتجر.
            </p>
          </div>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[#B8801C] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#9E6C14]"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>💾 حفظ ونشر البانر على الموقع / Save & Publish</span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs font-bold text-[#26160F]">
            العنوان الرئيسي للبانر (Headline)
            <input
              type="text"
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
              placeholder="مثال: كيكات مميزة تُصنع بحب لمناسباتكم الخاصة 🎂"
              className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs text-[#26160F]"
            />
          </label>

          <label className="block text-xs font-bold text-[#26160F]">
            الوصف الفرعي (Subtitle)
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="مثال: سواء كان حفل تخرج، عيد ميلاد، أو ذكرى مميزة.."
              className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs text-[#26160F]"
            />
          </label>

          <label className="block text-xs font-bold text-[#26160F]">
            رابط صورة البانر (Image URL)
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs text-[#26160F]"
            />
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-[#EFE8DC] bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center justify-between border-b border-[#EFE8DC] pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-[#26160F]">
              <Palette className="h-5 w-5 text-[#B8801C]" />
              مُحدّد الهوية البصرية لكروت المتجر (Brand Palette Selector)
            </h3>
            <p className="mt-0.5 text-xs text-[#4A3B32]/70">
              اختر ثيم الألوان المعتمد لكروت المنتجات في واجهة الزبائن (يتحدث فورياً).
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Object.values(BRAND_PALETTES).map((theme) => {
            const active = selectedPalette === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={async () => {
                  try {
                    await setSelectedPalette(theme.id);
                    toast.success(`تم حفظ وتطبيق ثيم ${theme.nameAr} بنجاح 🎨`);
                  } catch (err) {
                    const message = err instanceof Error ? err.message : "خطأ غير متوقع";
                    toast.error(`تعذر حفظ الثيم: ${message}`);
                  }
                }}
                className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border p-4 text-center transition-all ${
                  active
                    ? "scale-105 border-2 border-[#B8801C] bg-[#FEF7EB] shadow-md ring-2 ring-[#B8801C]/20"
                    : "border-[#EFE8DC] bg-white hover:border-[#B8801C]/50 hover:bg-[#FAF5EB]"
                }`}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 font-bold text-white shadow-md transition-transform group-hover:scale-110"
                  style={{ backgroundColor: theme.main }}
                >
                  {active && <Check className="h-5 w-5 stroke-[3]" />}
                </div>
                <div className="space-y-1">
                  <span className="block text-xs font-black text-[#26160F]">{theme.nameAr}</span>
                  <div className="flex justify-center gap-1">
                    <span
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: theme.cardBg }}
                      title="خلفية الصورة"
                    />
                    <span
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: theme.main }}
                      title="اللون الرئيسي"
                    />
                    <span
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: theme.secondary }}
                      title="النصوص واللمسات"
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function StoreOperationsPanel() {
  const queryClient = useQueryClient();
  const clearFn = useServerFn(clearAllSalesOrders);
  const [address, setAddress] = useState("عمّان - الشميساني الرئيسي، مقابل مجمع بنك الاتحاد");
  const [phone, setPhone] = useState("+962 7 9000 0000");
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    void supabase
      .from("store_settings")
      .select("store_name, contact_phone")
      .eq("singleton", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("[StoreOperationsPanel] store_settings load error:", error.message);
          return;
        }
        const row = data as { store_name?: string; contact_phone?: string } | null;
        if (row?.store_name?.trim()) setAddress(row.store_name.trim());
        if (row?.contact_phone?.trim()) setPhone(row.contact_phone.trim());
      });
  }, []);

  const {
    accounts: cliqAccounts,
    saveAll: saveCliqAccounts,
    resetAll: resetCliqAccounts,
  } = useCliqAccounts();
  const [localCliqAccounts, setLocalCliqAccounts] = useState<CliqAccountConfig[]>(cliqAccounts);

  useEffect(() => {
    setLocalCliqAccounts(cliqAccounts);
  }, [cliqAccounts]);

  const handleCliqLabelChange = (id: string, newLabel: string) => {
    setLocalCliqAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, label: newLabel } : acc)),
    );
  };

  const handleSaveCliq = async () => {
    try {
      await saveCliqAccounts(localCliqAccounts);
      toast.success("تم حفظ أسماء خيارات كليك بنجاح على جميع الأجهزة والموظفين ✅");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "تعذّر حفظ أسماء خيارات كليك في قاعدة البيانات",
      );
    }
  };

  const handleResetCliq = async () => {
    if (!window.confirm("هل تريد استعادة الأسماء الافتراضية لحسابات كليك؟")) return;
    try {
      await resetCliqAccounts();
      setLocalCliqAccounts(DEFAULT_CLIQ_ACCOUNTS);
      toast.success("تمت استعادة الأسماء الافتراضية لحسابات كليك 🔄");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "تعذّر استعادة الأسماء الافتراضية لحسابات كليك",
      );
    }
  };

  const { zones: deliveryZones, setZones: saveDeliveryZones, resetZones } = useDeliveryZonesStore();
  const [localZones, setLocalZones] = useState<DeliveryZone[]>(deliveryZones);

  useEffect(() => {
    setLocalZones(deliveryZones);
  }, [deliveryZones]);

  const handleZoneChange = <K extends keyof DeliveryZone>(
    index: number,
    field: K,
    value: DeliveryZone[K],
  ) => {
    setLocalZones((prev) => {
      const updated = [...prev];
      const existing = updated[index];
      if (!existing) return prev;
      updated[index] = { ...existing, [field]: value };
      return updated;
    });
  };

  const handleSaveZones = async () => {
    try {
      await saveDeliveryZones(localZones);
      toast.success("تم حفظ أسعار ومناطق التوصيل في قاعدة البيانات بنجاح 🚗");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر حفظ مناطق التوصيل في قاعدة البيانات");
    }
  };

  const handleResetZones = async () => {
    if (!window.confirm("هل تريد استعادة أسعار التوصيل الافتراضية؟")) return;
    try {
      await resetZones();
      toast.success("تمت استعادة أسعار التوصيل الافتراضية 🔄");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر استعادة أسعار التوصيل الافتراضية");
    }
  };

  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from("store_settings")
        .update({ store_name: address.trim(), contact_phone: phone.trim() } as never)
        .eq("singleton", true);
      if (error) throw error;
      toast.success("تم حفظ بيانات الفرع الرئيسي في قاعدة البيانات بنجاح 🌸");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "تعذّر حفظ بيانات الفرع الرئيسي في قاعدة البيانات",
      );
    }
  };

  const handleWipeAllOrders = async () => {
    if (
      !window.confirm(
        "تحذير أمني: هل أنت متأكد من مسح وتنظيف كافة الطلبات نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.",
      )
    ) {
      return;
    }
    setWiping(true);
    try {
      await clearFn();
      void queryClient.invalidateQueries({ queryKey: ADMIN_ANALYTICS_KEY });
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      toast.success("تم مسح وتنظيف كافة الطلبات من الموقع بنجاح ✅");
    } catch (err) {
      toast.error((err as Error).message || "فشل مسح الطلبات");
    } finally {
      setWiping(false);
    }
  };

  return (
    <section aria-labelledby="settings-heading" className="space-y-6">
      <div className="space-y-4 rounded-3xl border border-[#EFE8DC] bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center justify-between border-b border-[#EFE8DC] pb-3">
          <h2
            id="settings-heading"
            className="flex items-center gap-2 text-base font-black text-[#26160F]"
          >
            <Building2 className="h-5 w-5 text-[#B8801C]" />
            بيانات فرع عمّان الرئيسي (Single Physical Branch)
          </h2>
          <button
            type="button"
            onClick={handleSaveSettings}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[#B8801C] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#9E6C14]"
          >
            <Save className="h-4 w-4" />
            <span>حفظ البيانات</span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-bold text-[#26160F]">
            العنوان التفصيلي
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs font-semibold text-[#26160F]"
            />
          </label>

          <label className="block text-xs font-bold text-[#26160F]">
            هاتف الاستفسارات المباشر
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs font-semibold text-[#26160F]"
              dir="ltr"
            />
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-[#EFE8DC] bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[#EFE8DC] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-[#26160F]">
              <CreditCard className="h-5 w-5 text-[#B8801C]" />
              <span>إعدادات وتعديل أسماء حسابات كليك (شاشة إنشاء الطلب)</span>
            </h3>
            <p className="mt-1 text-xs text-[#4A3B32]/80">
              تعديل النصوص والأسماء التي تظهر داخل أيقونات كليك عند اختيار (دفع كامل أو عربون عبر
              كليك)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetCliq}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>استعادة الأسماء الافتراضية</span>
            </button>
            <button
              type="button"
              onClick={handleSaveCliq}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#8B4513] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#6D340E]"
            >
              <Save className="h-3.5 w-3.5" />
              <span>حفظ خيارات كليك</span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {localCliqAccounts.map((acc, idx) => (
            <div
              key={acc.id}
              className="space-y-3 rounded-2xl border border-[#EFE8DC] bg-[#FDFBF7] p-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="rounded-xl border border-[#EFE8DC] bg-white p-2 text-2xl shadow-xs">
                  {acc.icon}
                </span>
                <div>
                  <span className="block text-xs font-black text-[#26160F]">
                    الخيار {idx + 1}:{" "}
                    {acc.id === "staff"
                      ? "حساب موظفة"
                      : acc.id === "shop"
                        ? "حساب المحل"
                        : "الحساب الرئيسي"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">معرف الحساب: {acc.id}</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#26160F]">
                  الاسم داخل الأيقونة:
                </label>
                <input
                  type="text"
                  value={acc.label}
                  onChange={(e) => handleCliqLabelChange(acc.id, e.target.value)}
                  placeholder="اكتب الاسم هنا..."
                  className="min-h-11 w-full rounded-xl border border-[#EFE8DC] bg-white px-3 text-xs font-bold text-[#26160F] focus:ring-2 focus:ring-[#B8801C] focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-2xl border border-dashed border-[#B8860B]/40 bg-[#FFFDF7] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B4513]">
              معاينة مباشرة: شكل الأزرار في شاشة إنشاء الطلب (طلب جديد):
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
            {localCliqAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#8B4513] bg-[#8B4513] p-2.5 text-xs font-black text-white shadow-xs"
              >
                <span className="text-base">{acc.icon}</span>
                <span>{acc.label || "(بدون اسم)"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-[#EFE8DC] bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[#EFE8DC] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-[#26160F]">
              <MapPin className="h-5 w-5 text-[#B8801C]" />
              مناطق وأجور التوصيل المعتمدة في عمّان (Amman Delivery Zones)
            </h3>
            <p className="mt-1 text-xs text-[#4A3B32]/80">
              تعديل أسعار التوصيل حسب المناطق. اكتب المناطق مفصولة بفاصلة (،).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetZones}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>استعادة الأساسية</span>
            </button>
            <button
              type="button"
              onClick={handleSaveZones}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#8B4513] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#6D340E]"
            >
              <Save className="h-3.5 w-3.5" />
              <span>حفظ خيارات التوصيل</span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {localZones.map((zone, idx) => (
            <div
              key={idx}
              className="space-y-3 rounded-2xl border border-[#EFE8DC] bg-[#FDFBF7] p-4"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={zone.labelAr}
                  onChange={(e) => handleZoneChange(idx, "labelAr", e.target.value)}
                  className="h-9 w-full rounded-lg border border-[#EFE8DC] bg-white px-2 text-xs font-bold text-[#26160F] focus:ring-2 focus:ring-[#B8801C] focus:outline-none"
                  placeholder="اسم الفئة (عربي)"
                />
                <div className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-[#EFE8DC] bg-white px-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={zone.fee}
                    onChange={(e) => handleZoneChange(idx, "fee", parseFloat(e.target.value) || 0)}
                    className="w-14 text-center text-xs font-bold text-[#B8801C] outline-none"
                  />
                  <span className="text-xs font-bold text-[#B8801C]">د.أ</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold text-[#4A3B32]">
                  المناطق المشمولة:
                </label>
                <textarea
                  value={zone.areas.join("، ")}
                  onChange={(e) =>
                    handleZoneChange(
                      idx,
                      "areas",
                      e.target.value
                        .split("،")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#EFE8DC] bg-white p-2 text-[11px] leading-relaxed text-[#4A3B32] focus:ring-2 focus:ring-[#B8801C] focus:outline-none"
                  placeholder="ماركا، طبربور، عبدون..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-3xl border-2 border-dashed border-rose-300 bg-rose-50/40 p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200 pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-rose-950">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              منطقة العمليات الحساسة: تنظيف ومسح كافة الطلبات (Database Reset)
            </h3>
            <p className="mt-0.5 text-xs text-rose-900/80">
              مسح وتفريغ كافة الطلبات السابقة والتجريبية من قاعدة البيانات للبدء بسجل طلبات نظيف.
            </p>
          </div>
          <button
            type="button"
            onClick={handleWipeAllOrders}
            disabled={wiping}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-rose-600 px-5 text-xs font-black text-white shadow-md transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
          >
            {wiping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span>{wiping ? "جار المسح..." : "مسح كافة الطلبات من السيرفر"}</span>
          </button>
        </div>
        <p className="text-[11px] text-rose-800">
          ⚠️ تحذير: هذا الإجراء يحذف جميع سجلات جدول الطلبات، بنود الأصناف، وتعديلات الطلبات بشكل
          دائم ولا يمكن التراجع عنه.
        </p>
      </div>
    </section>
  );
}
