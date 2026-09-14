import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ShoppingBag, ChevronDown, Plus, Minus, Check } from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import {
  CakeCustomizationPanel,
  emptyCustomization,
  type Customization,
} from "./CakeCustomizationPanel";
import { LangToggle, useLang } from "@/lib/i18n";
import { formatJod } from "@/lib/currency";

interface ProductDetailsViewProps {
  onBack?: () => void;
  onOpenCart?: () => void;
  onAddToCart?: (item: {
    name: string;
    size: string;
    quantity: number;
    price: number;
    customization: Customization;
  }) => void;
  cartCount?: number;
  isEmbedded?: boolean;
}

export function ProductDetailsView({
  onBack,
  onOpenCart,
  onAddToCart,
  cartCount = 0,
  isEmbedded = false,
}: ProductDetailsViewProps) {
  const { t, lang, dir } = useLang();
  const ar = lang === "ar";
  const [selectedThumb, setSelectedThumb] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState("8 inch Celebration");
  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [customization, setCustomization] = useState<Customization>(emptyCustomization);

  const thumbnails = [
    { id: 0, src: "/images/ombre-ruffle-cake.jpg", alt: "Ombre Fondant Ruffle Cake" },
    { id: 1, src: "/images/ube-drip-cake.jpg", alt: "Ube Drip Cake" },
    { id: 2, src: "/images/croissants.jpg", alt: "Fresh Croissants" },
    { id: 3, src: "/images/macaron-stack.jpg", alt: "Macaron Tower" },
  ];

  const sizePricing: Record<string, { price: number; ar: string; en: string }> = {
    "6 inch Petite (Serves 6-8)": { price: 95.0, ar: "٦ إنش صغيرة (٦–٨ أشخاص)", en: "6 inch Petite (Serves 6-8)" },
    "8 inch Celebration": { price: 130.51, ar: "٨ إنش للمناسبات", en: "8 inch Celebration" },
    "10 inch Grand (Serves 20-25)": { price: 185.0, ar: "١٠ إنش كبيرة (٢٠–٢٥ شخصاً)", en: "10 inch Grand (Serves 20-25)" },
    "4-Tier Wedding Masterpiece": { price: 290.0, ar: "أربع طوابق للأعراس", en: "4-Tier Wedding Masterpiece" },
  };

  const unitPrice = sizePricing[size]?.price ?? 130.51;
  const currentPrice = unitPrice * quantity;
  const selectedImage = thumbnails[selectedThumb] ?? thumbnails[0];

  const handleAdd = () => {
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
    onAddToCart?.({
      name: "Ombre Fondant Ruffle Cake",
      size,
      quantity,
      price: unitPrice,
      customization,
    });
  };

  return (
    <div
      dir={dir}
      className={`relative flex min-h-dvh w-full flex-col justify-between overflow-y-auto bg-background text-foreground ${
        isEmbedded ? "min-h-[740px] max-h-[820px] rounded-[38px] border-4 border-cocoa shadow-2xl" : ""
      }`}
    >
      <BackgroundCurves />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/80 bg-background/80 px-5 py-3.5 backdrop-blur-md">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("back")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm transition-transform hover:scale-[1.04] hover:bg-secondary/40 active:scale-95"
          >
            <ChevronLeft className={`h-5 w-5 ${ar ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <Link
            to="/discover"
            aria-label={t("back")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm transition-transform hover:scale-[1.04] hover:bg-secondary/40 active:scale-95"
          >
            <ChevronLeft className={`h-5 w-5 ${ar ? "rotate-180" : ""}`} />
          </Link>
        )}

        <div className="flex flex-col items-center">
          <DelishLogo size="sm" />
          <span className="-mt-0.5 text-[9px] font-bold uppercase tracking-[0.24em] text-gold">
            {t("celebrationCakes")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <LangToggle />
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={t("cart")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm transition-transform hover:scale-[1.04] hover:bg-secondary/40 active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Product Showcase Block */}
      <main className="relative z-10 w-full max-w-3xl flex-1 space-y-4 self-center overflow-x-hidden px-4 pt-3 pb-24 sm:px-5">
        <div className="flex min-h-[290px] items-center justify-center gap-3 sm:min-h-[340px] sm:gap-5">
          {/* Vertical thumbnail gallery; the flex row flips itself in Arabic */}
          <div className="z-10 flex shrink-0 flex-col gap-2.5">
            {thumbnails.map((thumb) => {
              const active = selectedThumb === thumb.id;
              return (
                <button
                  key={thumb.id}
                  type="button"
                  onClick={() => setSelectedThumb(thumb.id)}
                  aria-pressed={active}
                  aria-label={thumb.alt}
                  className={`h-10 w-10 overflow-hidden rounded-xl bg-card p-0.5 shadow-sm transition-all duration-200 sm:h-11 sm:w-11 ${
                    active
                      ? "shadow-md ring-2 ring-primary"
                      : "opacity-70 hover:scale-105 hover:opacity-100"
                  }`}
                >
                  <img src={thumb.src} alt={thumb.alt} className="h-full w-full rounded-lg object-cover" />
                </button>
              );
            })}
          </div>

          <div className="flex h-64 min-w-0 flex-1 items-center justify-center sm:h-80">
            <img
              src={selectedImage?.src ?? "/images/ombre-ruffle-cake.jpg"}
              alt={ar ? "كيكة أومبري بطبقات الفوندان" : "Ombre Fondant Ruffle Cake"}
              className="max-h-full max-w-full object-contain transition-all duration-500"
            />
          </div>
        </div>

        <div className="space-y-4 pt-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="font-sans text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              {ar ? (
                <>
                  كيكة أومبري <br />
                  بطبقات{" "}
                  <span className="font-script text-4xl font-normal italic text-primary sm:text-5xl">
                    الفوندان
                  </span>
                </>
              ) : (
                <>
                  Ombre Fondant <br />
                  Ruffle{" "}
                  <span className="font-script text-4xl font-normal italic text-primary sm:text-5xl">
                    Cake
                  </span>
                </>
              )}
            </h1>

            <div className="mt-1 inline-flex shrink-0 items-center rounded-full bg-primary px-2.5 py-1 text-primary-foreground shadow-sm">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label={ar ? "تقليل الكمية" : "Decrease quantity"}
                className="p-1 transition hover:text-gold-light active:scale-90"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-xs font-bold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                aria-label={ar ? "زيادة الكمية" : "Increase quantity"}
                className="p-1 transition hover:text-gold-light active:scale-90"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Expandable Description */}
          <div className="rounded-2xl border border-border bg-card/70 p-3.5 shadow-sm">
            <button
              type="button"
              onClick={() => setDescriptionOpen(!descriptionOpen)}
              aria-expanded={descriptionOpen}
              className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-primary"
            >
              <span>{t("description")}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  descriptionOpen ? "rotate-180 text-primary" : "text-muted-foreground"
                }`}
              />
            </button>
            {descriptionOpen && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {ar
                  ? "طبقات فوندان مشكّلة يدوياً بتدرّج لوني ناعم من الأزرق الملكي إلى الأزرق الفاتح، مثالية للأعراس والمناسبات الكبيرة."
                  : "Each delicate fondant tier is hand-ruffled in an exquisite ombre cascade from deep royal indigo to sky pastel blue."}
              </p>
            )}
          </div>

          {/* Size Selector */}
          <div className="space-y-1.5">
            <label htmlFor="cake-size-select" className="text-xs font-bold text-foreground">
              {t("size")}
            </label>
            <div className="relative">
              <select
                id="cake-size-select"
                value={size}
                onChange={(event) => setSize(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-input bg-card px-4 py-3 text-xs font-semibold text-foreground shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
              >
                {Object.entries(sizePricing).map(([key, option]) => (
                  <option key={key} value={key}>
                    {`${ar ? option.ar : option.en} — ${formatJod(option.price, lang)}`}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-primary ${
                  ar ? "left-4" : "right-4"
                }`}
              />
            </div>
          </div>
        </div>

        <CakeCustomizationPanel value={customization} onChange={setCustomization} />
      </main>

      {/* Sticky Bottom Action Bar */}
      <footer className="sticky bottom-0 z-20 flex items-center justify-between border-t border-border bg-background/95 px-6 py-4 backdrop-blur-md">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {t("from")}
          </span>
          <span className="font-sans text-2xl font-extrabold text-foreground sm:text-3xl">
            {formatJod(currentPrice, lang)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-xs font-bold uppercase text-primary-foreground shadow-sm transition-all hover:scale-[1.02] hover:bg-cocoa-deep active:scale-[0.98] sm:text-sm"
        >
          {addedAnimation ? (
            <>
              <Check className="h-4 w-4" />
              <span>{ar ? "تمت الإضافة!" : "ADDED!"}</span>
            </>
          ) : (
            <span>{t("addToCart")}</span>
          )}
        </button>
      </footer>
    </div>
  );
}
