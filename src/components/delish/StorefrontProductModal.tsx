import { useEffect, useId, useMemo, useState } from "react";
import { Minus, Plus, X, ImageOff, ShoppingBag, Eye, ChevronDown } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useDismissable } from "@/lib/a11y";
import { formatJod } from "@/lib/currency";
import { WHATSAPP } from "@/lib/menu";
import { priceForSize, type StorefrontProduct } from "@/lib/storefront-content";
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
  { value: "VANILLA", ar: "فانيلا فاخرة · VANILLA", en: "VANILLA" },
  { value: "CHOCOLATE", ar: "شوكولاتة بلجيكية · CHOCOLATE", en: "CHOCOLATE" },
  { value: "RED_VELVET", ar: "ريد فيلفيت · RED VELVET", en: "RED VELVET" },
  { value: "CARAMEL", ar: "كراميل دافئ · CARAMEL", en: "CARAMEL" },
  { value: "LOTUS", ar: "لوتس كرنش · LOTUS", en: "LOTUS" },
  { value: "PISTACHIO", ar: "فستق حلبي · PISTACHIO", en: "PISTACHIO" },
];

/**
 * Quick Order Modal matching Rawan Cake benchmark structure, updated with DELISH Bakes identity.
 * Split 2-Column layout on desktop, top buttercream showcase + bottom form on mobile.
 */
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
  const [fillingError, setFillingError] = useState(false);
  const [inscription, setInscription] = useState("");
  const [notes, setNotes] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [customization, setCustomization] = useState<Customization>(emptyCustomization);

  useDismissable(Boolean(product), onClose);

  useEffect(() => {
    if (product) {
      setSize(product.sizes[0]?.label ?? SERVING_SIZE_OFFSETS[0]!.label);
      setQuantity(1);
      setFlavor("VANILLA");
      setFilling(product?.filling_ar?.trim() || "");
      setFillingError(false);
      setInscription("");
      setNotes("");
      setShowExtras(false);
      setCustomization(emptyCustomization);
    }
  }, [product]);

  const baseUnitPrice = useMemo(() => (product ? priceForSize(product, size) : 0), [product, size]);

  // Calculate price including size offsets if present
  const activeOffset = useMemo(() => getServingSizeOffset(size), [size]);

  const unitPrice = baseUnitPrice + (product?.sizes.length ? 0 : activeOffset);

  if (!product) return null;

  const name = ar ? product.name_ar : product.name_en;
  const description = ar
    ? product.description_ar
    : (product.description_en ??
      (ar ? "كيك فاخر مغطى بالكريمة والسكر" : "Cake covered with sugar"));
  const askUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
    ar
      ? `مرحباً، أريد معرفة سعر: ${product.name_ar}`
      : `Hello, I would like the price for: ${product.name_en}`,
  )}`;

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
        {/* LEFT COLUMN: Visual Showcase */}
        <div
          style={{ backgroundColor: palette.cardBg }}
          className="relative flex min-h-[260px] w-full shrink-0 flex-col items-center justify-center p-6 transition-colors duration-300 md:min-h-[460px] md:w-1/2"
        >
          {/* Large Cake Showcase Image */}
          <div className="relative my-auto flex h-full w-full items-center justify-center p-4">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={name}
                className="max-h-56 max-w-full object-contain drop-shadow-xl transition-transform duration-300 hover:scale-105 md:max-h-80"
              />
            ) : (
              <div
                style={{ color: palette.main }}
                className="grid h-48 w-48 place-items-center rounded-3xl bg-white/70 shadow-inner"
              >
                <ImageOff className="h-10 w-10" aria-hidden />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Streamlined Selection Form */}
        <div className="flex max-h-[65vh] w-full flex-col justify-between space-y-4 overflow-y-auto p-5 sm:p-7 md:max-h-[90vh] md:w-1/2">
          {/* Header row: Badge & Close Button */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span
              style={{ color: palette.main }}
              className="text-[11px] font-black tracking-wider uppercase"
            >
              TRENDING · الأكثر طلباً
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={ar ? "إغلاق" : "Close"}
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-border bg-white text-foreground shadow-xs transition hover:bg-secondary/40 active:scale-95"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Title & Description */}
          <div className="space-y-1">
            <h2
              id={titleId}
              className="font-sans text-2xl leading-tight font-black text-foreground"
            >
              {name}
            </h2>
            <p className="text-xs leading-relaxed font-medium text-muted-foreground">
              {description}
            </p>
          </div>

          {product.price_on_request ? (
            <div className="space-y-3 py-2">
              <p style={{ color: palette.main }} className="text-sm font-bold">
                {ar
                  ? "هذا التصميم يُسعّر حسب الطلب — تواصل معنا لمعرفة السعر."
                  : "This design is priced per request — contact us for a quote."}
              </p>
              <a
                href={askUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="grid min-h-12 w-full place-items-center rounded-2xl bg-whatsapp text-sm font-bold text-white shadow-md hover:bg-whatsapp/90"
              >
                {ar ? "اطلب السعر عبر واتساب" : "On request via WhatsApp"}
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Unit Price Display */}
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  {ar ? "سعر القطعة" : "Unit Price"}
                </span>
                <div className="text-2xl font-black text-foreground">
                  {formatJod(unitPrice, lang)}
                </div>
              </div>

              {/* Servings Selector ("Serves up to" / "يكفي لـ") */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-foreground">
                  {ar ? "يكفي لـ" : "Serves up to"}
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
                                : "border bg-white text-foreground hover:bg-secondary/40"
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
                                : "border bg-white text-foreground hover:bg-secondary/40"
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
                <label className="block text-xs font-bold text-foreground">
                  {ar ? "نكهة الكيكة" : "Cake Flavor"}
                </label>
                <div className="relative">
                  <select
                    value={flavor}
                    onChange={(e) => setFlavor(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {FLAVOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {ar ? opt.ar : opt.en}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {/* Filling Input (الحشوة) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-foreground">
                    {ar ? "نوع الحشوة" : "Cake Filling"} <span className="text-red-500">*</span>
                  </label>
                  {filling.trim() ? (
                    <span className="text-[11px] font-bold text-emerald-700">
                      ✓ {ar ? "تم التحديد" : "Selected"}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-red-600">
                      {ar ? "إجباري *" : "Required *"}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={filling}
                  onChange={(e) => {
                    setFilling(e.target.value);
                    if (fillingError) setFillingError(false);
                  }}
                  placeholder={
                    ar ? "اكتب نوع الحشوة المطلوبة بالتفصيل…" : "Enter required cake filling…"
                  }
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-xs font-semibold text-foreground transition-all outline-none placeholder:font-normal placeholder:text-muted-foreground ${
                    fillingError
                      ? "border-red-500 bg-red-50/40 focus:border-red-600 focus:ring-2 focus:ring-red-200"
                      : "border-border bg-white focus:border-primary focus:ring-2 focus:ring-primary/20"
                  }`}
                />
                {fillingError && (
                  <p className="text-[11px] font-bold text-red-600">
                    {ar
                      ? "⚠️ يرجى كتابة نوع الحشوة للكيكة (خانة إجبارية)"
                      : "⚠️ Please enter cake filling (required)"}
                  </p>
                )}
              </div>

              {/* Cake Writing Input (الكتابة على الكيك) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">
                  {ar ? "الكتابة على الكيك" : "Cake Writing"}
                </label>
                <input
                  type="text"
                  value={inscription}
                  onChange={(e) => setInscription(e.target.value)}
                  placeholder={ar ? "مثال: عيد ميلاد سعيد لانا 🎉" : "Happy Birthday Lana"}
                  className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                  <span>
                    {ar
                      ? "✨ إضافات خاصة (شموع، بالونات، توبر، هدية)"
                      : "✨ Extra Options (Candles, Balloons, Gift)"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showExtras ? "rotate-180" : ""}`}
                  />
                </button>
                {showExtras && (
                  <div className="mt-3 border-t border-border pt-2">
                    <CakeCustomizationPanel value={customization} onChange={setCustomization} />
                  </div>
                )}
              </div>

              {/* Sticky Modal Bottom Action Row */}
              <div className="flex items-center gap-3 border-t border-border pt-3">
                {/* Stepper [- 1 +] */}
                <div className="flex items-center gap-1 rounded-xl border border-border bg-white px-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label={ar ? "تقليل الكمية" : "Decrease quantity"}
                    className="grid h-10 w-9 cursor-pointer place-items-center rounded-lg text-primary hover:bg-secondary/40 active:scale-95"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <span className="min-w-6 text-center text-xs font-bold text-foreground">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label={ar ? "زيادة الكمية" : "Increase quantity"}
                    className="grid h-10 w-9 cursor-pointer place-items-center rounded-lg text-primary hover:bg-secondary/40 active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>

                {/* Add to Cart CTA Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (!filling.trim()) {
                      setFillingError(true);
                      return;
                    }
                    onAdd({
                      product,
                      size,
                      quantity,
                      price: unitPrice,
                      flavor,
                      filling: filling.trim(),
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
