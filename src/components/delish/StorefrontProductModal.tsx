import { useEffect, useId, useMemo, useState } from "react";
import { Minus, Plus, X, ShoppingBag, ChevronDown, Sparkles } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useDismissable } from "@/lib/a11y";
import { formatJod } from "@/lib/currency";
import { WHATSAPP } from "@/lib/menu";
import {
  priceForSize,
  getProductFallbackImage,
  type StorefrontProduct,
} from "@/lib/storefront-content";
import { useBrandPalette } from "@/lib/brand-palette";
import { SERVING_SIZE_OFFSETS, getServingSizeOffset } from "@/lib/order-pricing";
import {
  CakeCustomizationPanel,
  emptyCustomization,
  type Customization,
} from "./CakeCustomizationPanel";

export type ModalAddPayload = {
  product: StorefrontProduct;
  size: string | null;
  quantity: number;
  price: number;
  flavor: string;
  filling: string;
  inscription: string;
  notes: string;
  customization: Customization;
};

const FLAVOR_OPTIONS = [
  { value: "VANILLA", ar: "فانيلا مدغشقر الطبيعية", en: "Madagascar Vanilla" },
  { value: "CHOCOLATE", ar: "شوكولاتة بلجيكية فاخرة", en: "Belgian Chocolate" },
  { value: "RED_VELVET", ar: "ريد فيلفيت كلاسيكي", en: "Classic Red Velvet" },
  { value: "CARAMEL", ar: "كراميل مملح غني", en: "Salted Caramel" },
  { value: "LOTUS", ar: "لوتس مقرمش", en: "Lotus Crunch" },
  { value: "PISTACHIO", ar: "فستق حلبي ملكي", en: "Royal Pistachio" },
];

const QUICK_FILLINGS = [
  { ar: "وصفة الشيف الأصلية", en: "Chef's Original Recipe" },
  { ar: "فستق حلبي طبيعي", en: "Natural Pistachio" },
  { ar: "نوتيلا بلجيكية", en: "Belgian Nutella" },
  { ar: "لوتس مقرمش", en: "Crunchy Lotus" },
  { ar: "كراميل مملح", en: "Salted Caramel" },
];

export function StorefrontProductModal({
  product,
  onClose,
  onAdd,
}: {
  product: StorefrontProduct | null;
  onClose: () => void;
  onAdd: (payload: ModalAddPayload) => void;
}) {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const titleId = useId();
  const { palette } = useBrandPalette();

  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [flavor, setFlavor] = useState("VANILLA");
  const [filling, setFilling] = useState("");
  const [inscription, setInscription] = useState("");
  const [notes, setNotes] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [customization, setCustomization] = useState<Customization>(emptyCustomization);
  const [imgFailed, setImgFailed] = useState(false);
  const fallbackImg = useMemo(
    () =>
      product
        ? getProductFallbackImage(
            product.slug,
            product.category,
            ar ? product.name_ar : product.name_en,
          )
        : "",
    [product, ar],
  );
  const [modalImgSrc, setModalImgSrc] = useState<string>("");

  useDismissable(Boolean(product), onClose);

  useEffect(() => {
    if (product) {
      setSize(product.sizes[0]?.label ?? SERVING_SIZE_OFFSETS[0]!.label);
      setQuantity(1);
      setFlavor("VANILLA");
      setFilling(
        product?.filling_ar?.trim() || (ar ? "وصفة الشيف الأصلية" : "Chef's Original Recipe"),
      );
      setInscription("");
      setNotes("");
      setShowExtras(false);
      setCustomization(emptyCustomization);
      setModalImgSrc(product.image_url || fallbackImg);
      setImgFailed(false);
    }
  }, [product, ar, fallbackImg]);

  const baseUnitPrice = useMemo(() => (product ? priceForSize(product, size) : 0), [product, size]);
  const activeOffset = useMemo(() => getServingSizeOffset(size), [size]);
  const unitPrice = baseUnitPrice + (product?.sizes.length ? 0 : activeOffset);

  if (!product) return null;

  const name = ar ? product.name_ar : product.name_en;
  const description = ar
    ? product.description_ar || "كيك احتفالي فاخر مُحضر يدوياً طازجاً بأجود المكونات الطبيعية"
    : product.description_en ||
      "Handcrafted celebration cake baked fresh daily with finest ingredients";

  const askUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
    ar
      ? `مرحباً، أريد الاستفسار عن كيكة: ${product.name_ar}`
      : `Hello, I'd like to inquire about: ${product.name_en}`,
  )}`;

  const resolvedImage =
    product.image_url || getProductFallbackImage(product.slug, product.category, name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs transition-opacity duration-300 sm:p-4">
      {/* Background overlay click */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={ar ? "إغلاق النافذة" : "Close dialog"}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      {/* Main 2-Column Dialog Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir={ar ? "rtl" : "ltr"}
        style={{ borderColor: palette.border }}
        className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border bg-white shadow-2xl md:flex-row"
      >
        {/* VISUAL SHOWCASE COLUMN */}
        <div
          style={{ backgroundColor: palette.cardBg }}
          className="relative flex min-h-[260px] w-full shrink-0 flex-col items-center justify-center p-6 transition-colors duration-300 md:min-h-[460px] md:w-1/2"
        >
          <div className="relative my-auto flex h-full w-full items-center justify-center p-4">
            {!imgFailed ? (
              <img
                src={modalImgSrc || fallbackImg}
                alt={name}
                onError={() => {
                  if (modalImgSrc !== fallbackImg && fallbackImg) {
                    setModalImgSrc(fallbackImg);
                  } else {
                    setImgFailed(true);
                  }
                }}
                className="max-h-56 max-w-full object-contain drop-shadow-xl transition-transform duration-300 hover:scale-105 md:max-h-80"
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-amber-200 bg-white/90 p-8 text-center shadow-inner">
                <span className="text-4xl">🎂</span>
                <span className="mt-2 text-xs font-bold text-amber-900">DELISH Bakes</span>
                <span className="mt-1 text-[11px] text-muted-foreground">{name}</span>
              </div>
            )}
          </div>
        </div>

        {/* SELECTION FORM COLUMN */}
        <div className="flex max-h-[65vh] w-full flex-col justify-between space-y-4 overflow-y-auto p-5 sm:p-7 md:max-h-[90vh] md:w-1/2">
          {/* Header row: Badge & Close Button */}
          <div className="flex items-center justify-between border-b border-[#EFE8DC] pb-3">
            <span
              style={{ color: palette.main }}
              className="text-[11px] font-bold tracking-wider uppercase"
            >
              {ar ? "كيك احتفالي فاخر" : "Artisan Celebration Cake"}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={ar ? "إغلاق" : "Close"}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-[#EFE8DC] bg-white text-[#4A3B32] shadow-xs transition hover:bg-[#FEF7EB] active:scale-95"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Title & Description */}
          <div className="space-y-1">
            <h2 id={titleId} className="font-display text-2xl leading-tight font-black text-[#26160F]">
              {name}
            </h2>
            <p className="text-sm leading-relaxed font-medium text-[#4A3B32]/80">{description}</p>
          </div>

          {product.price_on_request ? (
            <div className="space-y-3 py-2">
              <p style={{ color: palette.main }} className="text-sm font-bold">
                {ar
                  ? "هذا التصميم يُسعّر حسب الطلب والمواصفات — تواصل معنا لتأكيد السعر."
                  : "This design is priced per request — contact us for a quote."}
              </p>
              <a
                href={askUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="grid min-h-12 w-full place-items-center rounded-2xl bg-whatsapp text-sm font-bold text-white shadow-md hover:bg-whatsapp/90"
              >
                {ar ? "اطلب السعر عبر واتساب" : "Inquire via WhatsApp"}
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Unit Price Display */}
              <div className="space-y-0.5">
                <span className="text-xs font-bold tracking-wider text-[#4A3B32]/70 uppercase">
                  {ar ? "سعر القطعة" : "Unit Price"}
                </span>
                <div className="font-display text-2xl font-black text-[#26160F]">
                  {formatJod(unitPrice, lang)}
                </div>
              </div>

              {/* Servings Selector ("Serves up to" / "يكفي لـ") */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-[#26160F]">
                  {ar ? "الحجم وعدد الأشخاص:" : "Size & Servings:"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.length > 0
                    ? product.sizes.map((option) => {
                        const active = size === option.label;
                        return (
                          <button
                            key={option.label}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setSize(option.label)}
                            style={{
                              backgroundColor: active ? palette.btnBg : undefined,
                              color: active ? "#ffffff" : undefined,
                              borderColor: active ? palette.btnBg : palette.border,
                            }}
                            className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                              active
                                ? "scale-[1.02] shadow-xs"
                                : "border bg-white text-[#4A3B32] hover:bg-[#FEF7EB]"
                            }`}
                          >
                            {option.label} ({formatJod(option.price, lang)})
                          </button>
                        );
                      })
                    : SERVING_SIZE_OFFSETS.map((option) => {
                        const active = size === option.label;
                        const displayPrice = baseUnitPrice + option.offset;
                        return (
                          <button
                            key={option.label}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setSize(option.label)}
                            style={{
                              backgroundColor: active ? palette.btnBg : undefined,
                              color: active ? "#ffffff" : undefined,
                              borderColor: active ? palette.btnBg : palette.border,
                            }}
                            className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                              active
                                ? "scale-[1.02] shadow-xs"
                                : "border bg-white text-[#4A3B32] hover:bg-[#FEF7EB]"
                            }`}
                          >
                            {ar ? option.ar : option.label} (
                            {option.offset > 0
                              ? `+${option.offset}.00 JOD`
                              : formatJod(displayPrice, lang)}
                            )
                          </button>
                        );
                      })}
                </div>
              </div>

              {/* Cake Flavor Dropdown (نكهة الكيكة) */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-[#26160F]">
                  {ar ? "نكهة الكيكة الأساسية" : "Cake Flavor"}
                </label>
                <div className="relative">
                  <select
                    value={flavor}
                    onChange={(e) => setFlavor(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-[#EFE8DC] bg-white px-3.5 py-2.5 text-sm font-bold text-[#26160F] outline-none focus:border-[#B8801C] focus:ring-2 focus:ring-[#B8801C]/20"
                  >
                    {FLAVOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {ar ? opt.ar : opt.en}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A3B32]/60" />
                </div>
              </div>

              {/* Filling Input with Quick Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-bold text-[#26160F]">
                    {ar ? "نوع الحشوة المفضلة" : "Cake Filling"}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {ar ? "اختياري" : "Optional"}
                  </span>
                </div>

                {/* Quick filling chips */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {QUICK_FILLINGS.map((chip) => {
                    const label = ar ? chip.ar : chip.en;
                    const isSelected = filling === label;
                    return (
                      <button
                        key={chip.en}
                        type="button"
                        onClick={() => setFilling(label)}
                        className={`cursor-pointer rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                          isSelected
                            ? "bg-[#8B4513] text-white"
                            : "border border-slate-200 bg-[#F9FBFC] text-[#5A4A42] hover:bg-amber-50"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={filling}
                  onChange={(e) => setFilling(e.target.value)}
                  placeholder={
                    ar ? "أو اكتب نوع الحشوة المفضلة بالتفصيل..." : "Or type custom filling..."
                  }
                  className="w-full rounded-xl border border-[#EFE8DC] bg-white px-3.5 py-2 text-xs font-semibold text-[#26160F] outline-none placeholder:font-normal placeholder:text-[#4A3B32]/40 focus:border-[#B8801C] focus:ring-2 focus:ring-[#B8801C]/20"
                />
              </div>

              {/* Cake Writing Input (الكتابة على الكيك) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#26160F]">
                  {ar ? "الكتابة على الكيك (إن وُجدت)" : "Cake Writing (Optional)"}
                </label>
                <input
                  type="text"
                  value={inscription}
                  onChange={(e) => setInscription(e.target.value)}
                  placeholder={ar ? "مثال: مبروك التخرج يا سارة 🎉" : "Happy Birthday Sarah 🎉"}
                  className="w-full rounded-xl border border-[#EFE8DC] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#26160F] outline-none placeholder:font-normal placeholder:text-[#4A3B32]/40 focus:border-[#B8801C] focus:ring-2 focus:ring-[#B8801C]/20"
                />
              </div>

              {/* Expandable Optional Extras (Candles, Balloons, Gift) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowExtras(!showExtras)}
                  style={{
                    color: palette.main,
                    backgroundColor: palette.cardBg,
                    borderColor: palette.border,
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-colors hover:opacity-90"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>
                      {ar
                        ? "إضافات مميزة (شموع، بالونات، توبر، إرسال كهدية)"
                        : "Special Add-ons (Candles, Balloons, Topper, Gift)"}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showExtras ? "rotate-180" : ""}`}
                  />
                </button>
                {showExtras && (
                  <div className="mt-3 border-t border-[#EFE8DC] pt-2">
                    <CakeCustomizationPanel value={customization} onChange={setCustomization} />
                  </div>
                )}
              </div>

              {/* Sticky Modal Bottom Action Row */}
              <div className="flex items-center gap-3 border-t border-[#EFE8DC] pt-3">
                {/* Stepper [- 1 +] */}
                <div className="flex items-center gap-1 rounded-xl border border-[#EFE8DC] bg-white px-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label={ar ? "تقليل الكمية" : "Decrease quantity"}
                    className="grid h-11 w-11 cursor-pointer place-items-center rounded-lg text-[#6E3917] hover:bg-[#FEF7EB] active:scale-95"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <span className="min-w-6 text-center text-xs font-bold text-[#26160F]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label={ar ? "زيادة الكمية" : "Increase quantity"}
                    className="grid h-11 w-11 cursor-pointer place-items-center rounded-lg text-[#6E3917] hover:bg-[#FEF7EB] active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>

                {/* Add to Cart CTA Button */}
                <button
                  type="button"
                  onClick={() => {
                    const finalFilling =
                      filling.trim() || (ar ? "وصفة الشيف الأصلية" : "Chef's Original Recipe");
                    onAdd({
                      product,
                      size,
                      quantity,
                      price: unitPrice,
                      flavor,
                      filling: finalFilling,
                      inscription,
                      notes,
                      customization,
                    });
                  }}
                  style={{ backgroundColor: palette.btnBg }}
                  className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-xs font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>{t("addToCart")}</span>
                  <span className="ms-1 font-extrabold text-white/90">
                    ({formatJod(unitPrice * quantity, lang)})
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
