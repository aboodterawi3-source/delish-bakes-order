import { useEffect, useId, useMemo, useState } from "react";
import { Minus, Plus, X, ImageOff, ShoppingBag, Eye, ChevronDown } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useDismissable } from "@/lib/a11y";
import { formatJod } from "@/lib/currency";
import { WHATSAPP } from "@/lib/menu";
import { priceForSize, type StorefrontProduct } from "@/lib/storefront-content";
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

const FILLING_OPTIONS = [
  { value: "chocolate_chips", ar: "قطع شوكولاتة · chocolate chips", en: "chocolate chips" },
  { value: "nutella_hazelnut", ar: "نوتيلا وبندق · Nutella & Hazelnut", en: "Nutella & Hazelnut" },
  { value: "lotus_cream", ar: "كريمة اللوتس · Lotus Cream", en: "Lotus Cream" },
  { value: "pistachio_cream", ar: "فستق حلبي غني · Pistachio Cream", en: "Pistachio Cream" },
  { value: "fresh_strawberry", ar: "توت وفراولة طازجة · Fresh Berries", en: "Fresh Berries" },
];

const SERVING_SIZE_OFFSETS = [
  { label: "8 people", ar: "8 أشخاص", offset: 0 },
  { label: "12 people", ar: "12 شخص", offset: 7 },
  { label: "16 people", ar: "16 شخص", offset: 15 },
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
  
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [flavor, setFlavor] = useState("VANILLA");
  const [filling, setFilling] = useState("chocolate_chips");
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
      setFilling("chocolate_chips");
      setInscription("");
      setNotes("");
      setShowExtras(false);
      setCustomization(emptyCustomization);
    }
  }, [product]);

  const baseUnitPrice = useMemo(() => (product ? priceForSize(product, size) : 0), [product, size]);
  
  // Calculate price including size offsets if present
  const activeOffset = useMemo(() => {
    const match = SERVING_SIZE_OFFSETS.find((s) => s.label === size);
    return match ? match.offset : 0;
  }, [size]);

  const unitPrice = baseUnitPrice + (product?.sizes.length ? 0 : activeOffset);

  if (!product) return null;

  const name = ar ? product.name_ar : product.name_en;
  const description = ar ? product.description_ar : product.description_en ?? (ar ? "كيك فاخر مغطى بالكريمة والسكر" : "Cake covered with sugar");
  const askUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
    ar ? `مرحباً، أريد معرفة سعر: ${product.name_ar}` : `Hello, I would like the price for: ${product.name_en}`,
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300">
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
        className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col md:flex-row z-10 border border-[#EFE8DC]"
      >
        {/* LEFT COLUMN: Visual Showcase (Soft Warm Buttercream Background) */}
        <div className="relative w-full md:w-1/2 bg-[#FAF5EB] p-6 flex flex-col justify-center items-center min-h-[260px] md:min-h-[460px] shrink-0">
          {/* Large Cake Showcase Image */}
          <div className="relative my-auto flex h-full w-full items-center justify-center p-4">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={name}
                className="max-h-56 md:max-h-80 max-w-full object-contain drop-shadow-xl transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className="grid h-48 w-48 place-items-center rounded-3xl bg-white/70 text-[#B8801C] shadow-inner">
                <ImageOff className="h-10 w-10" aria-hidden />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Streamlined Selection Form */}
        <div className="w-full md:w-1/2 p-5 sm:p-7 flex flex-col justify-between overflow-y-auto space-y-4 max-h-[65vh] md:max-h-[90vh]">
          {/* Header row: Badge & Close Button */}
          <div className="flex items-center justify-between border-b border-[#EFE8DC] pb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#B8801C]">
              TRENDING · الأكثر طلباً
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={ar ? "إغلاق" : "Close"}
              className="grid h-8 w-8 place-items-center rounded-full border border-[#EFE8DC] bg-white text-[#4A3B32] shadow-xs transition hover:bg-[#FEF7EB] hover:text-[#B8801C] active:scale-95"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Title & Description */}
          <div className="space-y-1">
            <h2 id={titleId} className="font-sans text-2xl font-black text-[#26160F] leading-tight">
              {name}
            </h2>
            <p className="text-xs font-medium text-[#4A3B32]/70 leading-relaxed">
              {description}
            </p>
          </div>

          {product.price_on_request ? (
            <div className="space-y-3 py-2">
              <p className="text-sm font-bold text-[#B8801C]">
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A3B32]/60">
                  {ar ? "سعر القطعة" : "Unit Price"}
                </span>
                <div className="text-2xl font-black text-[#26160F]">
                  {formatJod(unitPrice, lang)}
                </div>
              </div>

              {/* Servings Selector ("Serves up to" / "يكفي لـ") */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#26160F] block">
                  {ar ? "يكفي لـ" : "Serves up to"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.length > 0 ? (
                    product.sizes.map((option) => {
                      const active = size === option.label;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSize(option.label)}
                          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                            active
                              ? "bg-[#B8801C] text-white shadow-xs scale-[1.02]"
                              : "border border-[#EFE8DC] bg-white text-[#4A3B32] hover:border-[#B8801C]/50 hover:bg-[#FEF7EB]"
                          }`}
                        >
                          {option.label} ({formatJod(option.price, lang)})
                        </button>
                      );
                    })
                  ) : (
                    SERVING_SIZE_OFFSETS.map((option) => {
                      const active = size === option.label;
                      const displayPrice = baseUnitPrice + option.offset;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSize(option.label)}
                          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                            active
                              ? "bg-[#B8801C] text-white shadow-xs scale-[1.02]"
                              : "border border-[#EFE8DC] bg-white text-[#4A3B32] hover:border-[#B8801C]/50 hover:bg-[#FEF7EB]"
                          }`}
                        >
                          {ar ? option.ar : option.label} ({option.offset > 0 ? `+${option.offset}.00 JOD` : formatJod(displayPrice, lang)})
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Cake Flavor Dropdown (نكهة الكيكة) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#26160F] block">
                  {ar ? "نكهة الكيكة" : "Cake Flavor"}
                </label>
                <div className="relative">
                  <select
                    value={flavor}
                    onChange={(e) => setFlavor(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-[#EFE8DC] bg-white px-3.5 py-2.5 text-xs font-bold text-[#26160F] outline-none focus:border-[#B8801C] focus:ring-2 focus:ring-[#B8801C]/20"
                  >
                    {FLAVOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {ar ? opt.ar : opt.en}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 end-3 h-4 w-4 -translate-y-1/2 text-[#4A3B32]/60" />
                </div>
              </div>

              {/* Filling Dropdown (الحشوة) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#26160F] block">
                  {ar ? "الحشوة" : "Filling"}
                </label>
                <div className="relative">
                  <select
                    value={filling}
                    onChange={(e) => setFilling(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-[#EFE8DC] bg-white px-3.5 py-2.5 text-xs font-bold text-[#26160F] outline-none focus:border-[#B8801C] focus:ring-2 focus:ring-[#B8801C]/20"
                  >
                    {FILLING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {ar ? opt.ar : opt.en}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 end-3 h-4 w-4 -translate-y-1/2 text-[#4A3B32]/60" />
                </div>
              </div>

              {/* Cake Writing Input (الكتابة على الكيك) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#26160F] block">
                  {ar ? "الكتابة على الكيك" : "Cake Writing"}
                </label>
                <input
                  type="text"
                  value={inscription}
                  onChange={(e) => setInscription(e.target.value)}
                  placeholder={ar ? "مثال: عيد ميلاد سعيد لانا 🎉" : "Happy Birthday Lana"}
                  className="w-full rounded-xl border border-[#EFE8DC] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#26160F] outline-none focus:border-[#B8801C] focus:ring-2 focus:ring-[#B8801C]/20 placeholder:font-normal placeholder:text-[#4A3B32]/40"
                />
              </div>

              {/* Expandable Optional Extras (Candles, Balloons, Gift) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowExtras(!showExtras)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#EFE8DC] bg-[#FEF7EB] px-3.5 py-2.5 text-xs font-bold text-[#B8801C] hover:bg-[#FDF1DA]"
                >
                  <span>{ar ? "✨ إضافات خاصة (شموع، بالونات، توبر، هدية)" : "✨ Extra Options (Candles, Balloons, Gift)"}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showExtras ? "rotate-180" : ""}`} />
                </button>
                {showExtras && (
                  <div className="mt-3 pt-2 border-t border-[#EFE8DC]">
                    <CakeCustomizationPanel value={customization} onChange={setCustomization} />
                  </div>
                )}
              </div>

              {/* Sticky Modal Bottom Action Row */}
              <div className="pt-3 border-t border-[#EFE8DC] flex items-center gap-3">
                {/* Stepper [- 1 +] */}
                <div className="flex items-center gap-1 rounded-xl border border-[#EFE8DC] bg-white px-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label={ar ? "تقليل الكمية" : "Decrease quantity"}
                    className="grid h-10 w-9 place-items-center rounded-lg text-[#6E3917] hover:bg-[#FEF7EB] active:scale-95"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <span className="min-w-6 text-center text-xs font-bold text-[#26160F]">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label={ar ? "زيادة الكمية" : "Increase quantity"}
                    className="grid h-10 w-9 place-items-center rounded-lg text-[#6E3917] hover:bg-[#FEF7EB] active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>

                {/* Add to Cart CTA Button */}
                <button
                  type="button"
                  onClick={() =>
                    onAdd({
                      product,
                      size,
                      quantity,
                      price: unitPrice,
                      flavor,
                      filling,
                      inscription,
                      notes,
                      customization,
                    })
                  }
                  className="flex-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B8801C] hover:bg-[#9E6C14] text-white text-xs font-bold shadow-md transition-all active:scale-[0.98]"
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

