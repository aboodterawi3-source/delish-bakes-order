import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ShoppingBag, ChevronDown, Plus, Minus, Check, Loader2, ImageOff } from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import {
  CakeCustomizationPanel,
  emptyCustomization,
  type Customization,
} from "./CakeCustomizationPanel";
import { LangToggle, useLang } from "@/lib/i18n";
import { formatJod } from "@/lib/currency";
import { WHATSAPP } from "@/lib/menu";
import { priceForSize, type StorefrontProduct } from "@/lib/storefront-content";

export interface ProductDetailsAddPayload {
  productId: string;
  nameAr: string;
  nameEn: string;
  image: string | null;
  size: string | null;
  quantity: number;
  price: number;
  customization: Customization;
}

interface ProductDetailsViewProps {
  /** The product the customer tapped; null while loading or when it is gone. */
  product?: StorefrontProduct | null;
  isPending?: boolean;
  onBack?: () => void;
  onOpenCart?: () => void;
  onAddToCart?: (item: ProductDetailsAddPayload) => void;
  cartCount?: number;
  isEmbedded?: boolean;
}

export function ProductDetailsView({
  product = null,
  isPending = false,
  onBack,
  onOpenCart,
  onAddToCart,
  cartCount = 0,
  isEmbedded = false,
}: ProductDetailsViewProps) {
  const { t, lang, dir } = useLang();
  const ar = lang === "ar";
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState<string | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [customization, setCustomization] = useState<Customization>(emptyCustomization);

  const sizes = product?.sizes ?? [];
  const activeSize = useMemo(
    () => (sizes.some((option) => option.label === size) ? size : (sizes[0]?.label ?? null)),
    [sizes, size],
  );

  const unitPrice = product ? priceForSize(product, activeSize) : 0;
  const currentPrice = unitPrice * quantity;
  const name = product ? (ar ? product.name_ar : product.name_en) : "";
  const description = product ? (ar ? product.description_ar : product.description_en) : null;

  const handleAdd = () => {
    if (!product) return;
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
    onAddToCart?.({
      productId: product.id,
      nameAr: product.name_ar,
      nameEn: product.name_en,
      image: product.image_url,
      size: activeSize,
      quantity,
      price: unitPrice,
      customization,
    });
  };

  return (
    <div
      dir={dir}
      className={`relative flex min-h-dvh w-full max-w-full flex-col justify-between overflow-x-hidden overflow-y-auto bg-background text-foreground ${
        isEmbedded ? "min-h-[740px] max-h-[820px] rounded-[38px] border-4 border-cocoa shadow-2xl" : ""
      }`}
    >
      <BackgroundCurves />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/80 bg-background/80 px-3 py-3.5 backdrop-blur-md sm:px-5">
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

        <div className="flex min-w-0 flex-col items-center">
          <DelishLogo size="sm" />
          <span className="-mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.24em] text-gold">
            {t("celebrationCakes")}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
        {isPending && !product ? (
          <p className="flex items-center justify-center gap-2 py-24 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("loadingMenu")}
          </p>
        ) : !product ? (
          <p className="rounded-3xl border border-border bg-card/70 py-20 text-center text-xs text-muted-foreground">
            {ar ? "هذا المنتج غير متوفر حالياً" : "This product is not available right now"}
          </p>
        ) : (
          <>
            {/* Single product photo, exactly as the sales desk uploaded it */}
            <div className="flex h-64 min-w-0 items-center justify-center sm:h-80">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={name}
                  className="max-h-full max-w-full rounded-3xl object-contain transition-all duration-500"
                />
              ) : (
                <div className="grid h-full w-full place-items-center gap-2 rounded-3xl border border-border bg-card/70 text-muted-foreground">
                  <ImageOff className="h-6 w-6" aria-hidden />
                  <span className="text-[11px] font-semibold">
                    {ar ? "لا توجد صورة لهذا المنتج" : "No photo for this product yet"}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <h1 className="min-w-0 break-words font-sans text-xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
                  {name}
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
              {description && (
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
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
                  )}
                </div>
              )}

              {/* Size Selector */}
              {sizes.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="cake-size-select" className="text-xs font-bold text-foreground">
                    {t("size")}
                  </label>
                  <div className="relative">
                    <select
                      id="cake-size-select"
                      value={activeSize ?? ""}
                      onChange={(event) => setSize(event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-input bg-card px-4 py-3 text-xs font-semibold text-foreground shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                    >
                      {sizes.map((option) => (
                        <option key={option.label} value={option.label}>
                          {`${option.label} — ${formatJod(option.price, lang)}`}
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
              )}
            </div>

            <CakeCustomizationPanel value={customization} onChange={setCustomization} />
          </>
        )}
      </main>

      {/* Sticky Bottom Action Bar */}
      <footer className="sticky bottom-0 z-20 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-3 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-md sm:flex sm:flex-wrap sm:justify-between sm:px-6">
        {product?.price_on_request ? (
          <>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                {ar ? "السعر" : "Price"}
              </span>
              <span className="font-sans text-base font-extrabold text-foreground sm:text-xl">
                {ar ? "حسب الطلب" : "On request"}
              </span>
            </div>
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
                ar ? `مرحباً، أريد معرفة سعر: ${product.name_ar}` : `Hello, I would like the price for: ${product.name_en}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[50px] min-w-0 items-center justify-center gap-2 rounded-full bg-whatsapp px-4 py-3.5 text-center text-xs font-bold uppercase text-whatsapp-foreground shadow-sm sm:flex-none sm:px-7 sm:text-sm"
            >
              {ar ? "اطلب السعر" : "On request"}
            </a>
          </>
        ) : (
          <>
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {t("from")}
          </span>
          <span className="font-sans text-xl font-extrabold text-foreground sm:text-3xl">
            {formatJod(currentPrice, lang)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!product}
          className="inline-flex min-h-[50px] min-w-0 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-center text-xs font-bold uppercase text-primary-foreground shadow-sm transition-all hover:scale-[1.02] hover:bg-cocoa-deep active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:flex-none sm:px-7 sm:text-sm"
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
          </>
        )}
      </footer>
    </div>
  );
}
