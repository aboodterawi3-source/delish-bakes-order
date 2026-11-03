import React, { useEffect, useId, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Minus, Plus, X, ShoppingBag, ChevronDown, Sparkles } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { formatJod } from "@/lib/currency";
import { WHATSAPP } from "@/lib/menu";
import { priceForSize, type StorefrontProduct } from "@/lib/storefront-content";
import { SERVING_SIZE_OFFSETS, getServingSizeOffset } from "@/lib/order-pricing";
import { resolveProductPhoto } from "@/lib/product-media";
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

export function StorefrontProductModal({
  product,
  onClose,
  onAdd,
}: {
  product: StorefrontProduct | null;
  onClose: () => void;
  onAdd: (payload: ModalAddPayload) => void;
}) {
  const { t, lang, dir } = useLang();
  const ar = lang === "ar";
  const titleId = useId();
  const descriptionId = useId();
  const flavorSelectId = useId();
  const fillingInputId = useId();
  const inscriptionInputId = useId();

  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [flavor, setFlavor] = useState("VANILLA");
  const [filling, setFilling] = useState("");
  const [fillingError, setFillingError] = useState(false);
  const [inscription, setInscription] = useState("");
  const [notes, setNotes] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [customization, setCustomization] = useState<Customization>(emptyCustomization);

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
  const activeOffset = useMemo(() => getServingSizeOffset(size), [size]);
  const unitPrice = baseUnitPrice + (product?.sizes.length ? 0 : activeOffset);

  if (!product) return null;

  const name = ar ? product.name_ar : product.name_en;
  const description =
    (ar ? product.description_ar : product.description_en) ||
    (ar
      ? "كيك فاخر مخبوز طازجاً يومياً بأجود المكونات الطبيعية والشوكولاتة البلجيكية."
      : "Handcrafted artisan cake baked daily using fine natural ingredients.");

  const photoSrc = resolveProductPhoto(product);

  const askUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
    ar
      ? `مرحباً، أريد معرفة سعر وتفاصيل كيكة: ${product.name_ar}`
      : `Hello, I would like price details for: ${product.name_en}`,
  )}`;

  return (
    <DialogPrimitive.Root open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Backdrop Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Modal Window Container with Automatic Focus Trap and Escape Listener */}
        <DialogPrimitive.Content
          dir={dir}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[94vh] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[2rem] border border-border bg-card text-foreground shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 md:flex-row"
        >
          {/* DESKTOP LEFT COLUMN: High-Resolution Cake Photography Stage */}
          <div className="relative hidden w-5/12 shrink-0 flex-col items-center justify-center border-e border-border/80 bg-secondary/15 p-6 md:flex">
            <div className="relative flex aspect-square w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-card p-1 shadow-md">
              <img
                src={photoSrc}
                alt={name}
                className="h-full w-full rounded-xl object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute top-3 right-3 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-md">
                {product.category || (ar ? "كيك فاخر" : "Cake")}
              </div>
            </div>

            <div className="mt-4 text-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{ar ? "طازج يومياً من أتيلييه ديليش" : "Freshly Baked Daily"}</span>
              </span>
            </div>
          </div>

          {/* RIGHT / MAIN COLUMN: Fixed Header + Scrollable Options + Fixed Bottom CTA */}
          <div className="flex max-h-[94vh] w-full flex-1 flex-col overflow-hidden md:w-7/12">
            {/* 1. Fixed Modal Header (Always Visible) */}
            <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border/80 bg-card/95 px-5 py-3.5 backdrop-blur-md sm:px-7">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-extrabold text-primary">
                  {product.category || (ar ? "كيك احتفالي" : "Cake")}
                </span>
                {product.is_popular && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                    <Sparkles className="h-3 w-3" />
                    <span>{ar ? "الأكثر طلباً" : "Popular"}</span>
                  </span>
                )}
              </div>

              {/* 44×44 Accessible Close Button */}
              <DialogPrimitive.Close
                aria-label={ar ? "إغلاق النافذة" : "Close dialog"}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-border bg-card text-foreground shadow-2xs transition-all hover:bg-secondary/50 active:scale-95"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </header>

            {/* 2. Scrollable Modal Body */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
              {/* Mobile Cake Image (In-flow with scrollable content, never steals fixed screen space) */}
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border/70 bg-secondary/15 md:hidden">
                <img
                  src={photoSrc}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Title & Description */}
              <div className="space-y-1.5">
                <DialogPrimitive.Title
                  id={titleId}
                  className="font-sans text-xl font-extrabold leading-snug text-foreground sm:text-2xl"
                >
                  {name}
                </DialogPrimitive.Title>

                <DialogPrimitive.Description
                  id={descriptionId}
                  className="text-xs leading-relaxed text-muted-foreground sm:text-sm"
                >
                  {description}
                </DialogPrimitive.Description>
              </div>

              {product.price_on_request ? (
                <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <p className="text-sm font-bold text-primary">
                    {ar
                      ? "هذا التصميم يُصنع ويُسعّر حسب الطلب المباشر."
                      : "This custom design is quoted per order."}
                  </p>
                  <a
                    href={askUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-whatsapp px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-whatsapp/90"
                  >
                    {ar ? "استفسر عن السعر والتفاصيل عبر واتساب" : "Contact via WhatsApp"}
                  </a>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Servings / Size Selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-foreground">
                      {ar ? "حجم الكيكة (يكفي لـ)" : "Cake Size & Servings"}
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
                                className={`min-h-[44px] cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
                                  active
                                    ? "border-2 border-primary bg-primary text-primary-foreground shadow-xs"
                                    : "border border-border bg-card text-foreground hover:bg-secondary/40"
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
                                className={`min-h-[44px] cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
                                  active
                                    ? "border-2 border-primary bg-primary text-primary-foreground shadow-xs"
                                    : "border border-border bg-card text-foreground hover:bg-secondary/40"
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

                  {/* Cake Flavor Selection (with accessible label & select-name) */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor={flavorSelectId}
                      className="block text-xs font-bold text-foreground"
                    >
                      {ar ? "نكهة الكيكة الأساسية" : "Cake Flavor"}
                    </label>
                    <div className="relative">
                      <select
                        id={flavorSelectId}
                        aria-label={ar ? "نكهة الكيكة الأساسية" : "Cake Flavor"}
                        value={flavor}
                        onChange={(e) => setFlavor(e.target.value)}
                        className="min-h-[44px] w-full appearance-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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

                  {/* Single Canonical Cake Filling Field (Required & Validated, No Duplication) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={fillingInputId}
                        className="block text-xs font-bold text-foreground"
                      >
                        {ar ? "نوع الحشوة" : "Cake Filling"} <span className="text-destructive">*</span>
                      </label>
                      {filling.trim() ? (
                        <span className="text-[11px] font-bold text-emerald-700">
                          ✓ {ar ? "تم التحديد" : "Selected"}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-destructive">
                          {ar ? "إجباري *" : "Required *"}
                        </span>
                      )}
                    </div>
                    <input
                      id={fillingInputId}
                      type="text"
                      value={filling}
                      onChange={(e) => {
                        setFilling(e.target.value);
                        if (fillingError) setFillingError(false);
                      }}
                      placeholder={
                        ar ? "اكتب نوع الحشوة المطلوبة بالتفصيل (مثل: نوتيلا كرانش، لوتس، بستاشيو)..." : "Enter cake filling..."
                      }
                      className={`min-h-[44px] w-full rounded-xl border px-3.5 py-2.5 text-xs font-semibold text-foreground transition-all outline-none placeholder:font-normal placeholder:text-muted-foreground ${
                        fillingError
                          ? "border-destructive bg-destructive/10 focus:border-destructive focus:ring-2 focus:ring-destructive/20"
                          : "border-input bg-card focus:border-primary focus:ring-2 focus:ring-primary/20"
                      }`}
                    />
                    {fillingError && (
                      <p className="text-[11px] font-bold text-destructive">
                        {ar
                          ? "⚠️ يرجى كتابة نوع الحشوة للكيكة (خانة إجبارية للتأكيد)"
                          : "⚠️ Please enter cake filling (required)"}
                      </p>
                    )}
                  </div>

                  {/* Cake Inscription / Writing */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor={inscriptionInputId}
                      className="block text-xs font-bold text-foreground"
                    >
                      {ar ? "العبارة المكتوبة على الكيك (اختياري)" : "Cake Inscription (Optional)"}
                    </label>
                    <input
                      id={inscriptionInputId}
                      type="text"
                      value={inscription}
                      onChange={(e) => setInscription(e.target.value)}
                      placeholder={ar ? "مثال: مبروك التخرج سند 🎉" : "e.g. Happy Birthday!"}
                      className="min-h-[44px] w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-xs font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Expandable Optional Extras Accordion (Candles, Balloons, Topper, Gift) */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowExtras(!showExtras)}
                      className="flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary/50"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>
                          {ar
                            ? "إضافات وتجهيزات خاصة (شموع، بالونات، توبر، هدية)"
                            : "Extra Options (Candles, Balloons, Gift)"}
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          showExtras ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {showExtras && (
                      <div className="mt-3 rounded-2xl border border-border/80 bg-background/50 p-4">
                        <CakeCustomizationPanel
                          value={customization}
                          onChange={setCustomization}
                          hideFilling={true}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Sticky Bottom Action Bar (Fixed at bottom of modal, always visible & accessible!) */}
            {!product.price_on_request && (
              <footer className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between gap-3 border-t border-border/80 bg-card/95 px-5 py-3.5 backdrop-blur-md sm:px-7">
                {/* Stepper [- 1 +] with 44×44 touch targets */}
                <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label={ar ? "تقليل الكمية" : "Decrease quantity"}
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-foreground hover:bg-secondary/50 active:scale-95"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-extrabold text-foreground">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label={ar ? "زيادة الكمية" : "Increase quantity"}
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-foreground hover:bg-secondary/50 active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Total and Add to Cart Button */}
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
                      customization: {
                        ...customization,
                        filling: "", // filling is held canonically in filling field
                      },
                    });
                  }}
                  className="inline-flex min-h-[46px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>{t("addToCart")}</span>
                  <span className="font-extrabold text-primary-foreground/90">
                    ({formatJod(unitPrice * quantity, lang)})
                  </span>
                </button>
              </footer>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
