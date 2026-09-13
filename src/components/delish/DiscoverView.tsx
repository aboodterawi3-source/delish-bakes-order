import React, { memo, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ShoppingBag, Heart, Star, ArrowRight, Plus, Minus, Loader2 } from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { priceForSize, tintFill, type StorefrontProduct } from "@/lib/storefront-content";
import { LangToggle, useLang, type Lang } from "@/lib/i18n";
import { formatJod } from "@/lib/currency";

interface DiscoverViewProps {
  onSelectProduct?: (productId: string) => void;
  onOpenCart?: () => void;
  cartCount?: number;
  isEmbedded?: boolean;
}

export function DiscoverView({
  onSelectProduct,
  onOpenCart,
  cartCount = 0,
  isEmbedded = false,
}: DiscoverViewProps) {
  const content = useStorefrontContent();
  const { t, lang, dir } = useLang();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const banner = content.data?.banner ?? null;
  const categories = content.data?.categories ?? [];
  const products = content.data?.products ?? [];

  const visible = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return products
      .filter((product) => product.is_popular)
      .filter((product) => (selectedCategory ? product.category_id === selectedCategory : true))
      .filter((product) =>
        needle
          ? `${product.name_en} ${product.name_ar} ${product.category}`.toLowerCase().includes(needle)
          : true,
      );
  }, [products, selectedCategory, searchQuery]);

  const activeCategory = categories.find((category) => category.id === selectedCategory) ?? null;
  const activeCategoryName = activeCategory
    ? lang === "ar"
      ? activeCategory.name_ar
      : activeCategory.name_en
    : null;

  return (
    <div
      dir={dir}
      className={`relative flex min-h-dvh w-full flex-col overflow-y-auto bg-background text-foreground ${
        isEmbedded ? "min-h-[740px] max-h-[820px] rounded-[38px] shadow-2xl border-4 border-cocoa" : ""
      }`}
    >
      <BackgroundCurves />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/80 bg-background/80 px-5 py-3.5 backdrop-blur-md">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-extrabold text-secondary-foreground shadow-sm ring-2 ring-peach-coral/30">
          A
        </div>

        <div className="flex flex-col items-center">
          <DelishLogo size="sm" />
        </div>

        <div className="flex items-center gap-2">
          <LangToggle />
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label={lang === "ar" ? "بحث" : "Search"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/90 text-primary shadow-sm transition hover:bg-secondary/40 active:scale-95"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={t("cart")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/90 text-primary shadow-sm transition hover:bg-secondary/40 active:scale-95"
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

      {searchOpen && (
        <div className="relative z-20 px-5 pt-2 pb-1">
          <input
            type="search"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-2xl border border-input bg-card px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
        </div>
      )}

      <main className="relative z-10 flex-1 space-y-6 px-5 py-4">
        {/* Promotional hero banner — edited by the sales desk */}
        {banner && (
          <section
            aria-label="Promotional offer"
            className="relative overflow-hidden rounded-3xl bg-peach-coral p-5 text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            <div className="absolute -right-8 -bottom-10 h-44 w-44 rounded-full bg-secondary/40 blur-2xl" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-30" viewBox="0 0 400 200" fill="none">
              <path d="M180 -20 C240 60, 260 140, 420 180" stroke="currentColor" strokeWidth="24" strokeOpacity="0.2" />
            </svg>

            <div className="relative z-10 flex items-center justify-between">
              <div className="max-w-[170px] space-y-1.5">
                <p className="text-xs font-semibold tracking-wide">{banner.subtitle}</p>
                <h2 className="text-3xl font-black uppercase leading-none tracking-tight">
                  {banner.discount_text}
                </h2>
                <div className="pt-2">
                  <Link
                    to="/product-details"
                    className="inline-flex items-center justify-center rounded-full bg-card px-4 py-1.5 text-xs font-bold text-primary shadow-sm transition hover:bg-secondary active:scale-95"
                  >
                    {banner.button_text}
                  </Link>
                </div>
              </div>

              {banner.image_url && (
                <div className="relative -mr-2 -my-2 flex h-28 w-32 items-center justify-center sm:w-36">
                  <img
                    src={banner.image_url}
                    alt={`${banner.subtitle} ${banner.discount_text}`}
                    className="h-full w-full object-contain transition-transform duration-500 hover:scale-105"
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Discover by category — sales-managed ribbon */}
        {categories.length > 0 && (
          <section aria-label="Discover by category" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground sm:text-base">{t("discoverByCategory")}</h3>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-semibold text-primary transition-transform hover:underline active:scale-95"
                >
                  {t("showAll")}
                </button>
              )}
            </div>

            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
              {categories.map((category) => {
                const active = selectedCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCategory(active ? null : category.id)}
                    className={`flex w-[76px] shrink-0 flex-col items-center gap-2 rounded-3xl border border-border/70 p-2.5 transition-all duration-200 ${tintFill(
                      category.tint,
                    )} ${active ? "scale-[1.02] shadow-md ring-2 ring-primary" : "hover:scale-[1.01]"}`}
                  >
                    <div className="h-10 w-10 overflow-hidden rounded-2xl bg-card/80 p-0.5 shadow-sm">
                      {category.image_url ? (
                        <img
                          src={category.image_url}
                          alt={lang === "ar" ? category.name_ar : category.name_en}
                          className="h-full w-full rounded-xl object-cover"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center rounded-xl text-[11px] font-bold text-muted-foreground">
                          {(lang === "ar" ? category.name_ar : category.name_en).slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold tracking-tight text-foreground">
                      {lang === "ar" ? category.name_ar : category.name_en}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Popular cakes — grid stacks whatever sales marked popular */}
        <section aria-label="Popular cakes" className="space-y-3 pb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground sm:text-base">
              {activeCategoryName ? `${t("popular")} · ${activeCategoryName}` : t("popular")}
            </h3>
            <Link
              to="/product-details"
              aria-label={t("showAll")}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {content.isPending ? (
            <p className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("loadingMenu")}
            </p>
          ) : visible.length === 0 ? (
            <p className="rounded-3xl border border-border bg-card/70 py-10 text-center text-xs text-muted-foreground">
              {t("emptyMenu")}
            </p>
          ) : (
            visible.map((product) => (
              <ProductCard key={product.id} product={product} lang={lang} onSelect={onSelectProduct} />
            ))
          )}
        </section>
      </main>
    </div>
  );
}

const ProductCard = memo(function ProductCard({
  product,
  lang,
  onSelect,
}: {
  product: StorefrontProduct;
  lang: Lang;
  onSelect?: ((productId: string) => void) | undefined;
}) {
  const name = lang === "ar" ? product.name_ar : product.name_en;
  const [size, setSize] = useState<string | null>(product.sizes[0]?.label ?? null);
  const [qty, setQty] = useState(1);
  const [favourite, setFavourite] = useState(false);
  const unit = priceForSize(product, size);

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border border-border/70 p-4 shadow-[var(--shadow-soft)] transition-all hover:shadow-[var(--shadow-card)] sm:p-5 ${tintFill(
        product.tint,
      )}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <Link
            to="/product-details"
            className="font-sans text-base font-extrabold text-foreground transition-transform hover:text-primary sm:text-lg"
          >
            {name}
          </Link>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" />
            <span>{product.rating.toFixed(1)}</span>
            {product.rating_count > 0 && (
              <span className="text-muted-foreground">({product.rating_count})</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFavourite(!favourite)}
          aria-label={lang === "ar" ? "إضافة إلى المفضلة" : "Add to favorites"}
          aria-pressed={favourite}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 shadow-sm transition hover:bg-card active:scale-95"
        >
          <Heart
            className={`h-4 w-4 ${favourite ? "fill-destructive text-destructive" : "text-muted-foreground"}`}
          />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
        <div className="space-y-3">
          {product.sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.sizes.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setSize(option.label)}
                  aria-pressed={size === option.label}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                    size === option.label
                      ? "bg-cocoa text-primary-foreground shadow-sm"
                      : "border border-border bg-card/80 text-foreground hover:bg-card"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-full bg-cocoa px-2 py-0.5 text-primary-foreground shadow-sm">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label={lang === "ar" ? "تقليل الكمية" : "Decrease quantity"}
                className="p-1 transition hover:text-gold-light active:scale-90"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="px-2 text-xs font-bold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                aria-label={lang === "ar" ? "زيادة الكمية" : "Increase quantity"}
                className="p-1 transition hover:text-gold-light active:scale-90"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="pt-1">
            <span className="inline-block rounded-full bg-gold-deep px-4 py-1.5 text-xs font-extrabold text-primary-foreground shadow-sm sm:text-sm">
              {formatJod(unit * qty, lang)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelect?.(product.id)}
          aria-label={name}
          className="h-28 w-28 overflow-hidden rounded-2xl transition-transform duration-300 hover:scale-[1.02] group-hover:scale-105 active:scale-95 sm:h-32 sm:w-32"
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center bg-card text-[11px] font-bold text-muted-foreground">
              {name}
            </span>
          )}
        </button>
      </div>
    </div>
  );
});
