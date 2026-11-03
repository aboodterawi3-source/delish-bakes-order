import React, { memo, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  ShoppingBag,
  Plus,
  Loader2,
  Menu,
  Sparkles,
  Cake,
  Layers,
} from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { type StorefrontProduct } from "@/lib/storefront-content";
import { LangToggle, useLang, type Lang } from "@/lib/i18n";
import { formatJod } from "@/lib/currency";
import { useBrandPalette } from "@/lib/brand-palette";

import { resolveProductPhoto } from "@/lib/product-media";

interface DiscoverViewProps {
  onSelectProduct?: (productId: string) => void;
  onOpenCart?: () => void;
  onOpenMenu?: () => void;
  cartCount?: number;
  isEmbedded?: boolean;
}

export function DiscoverView({
  onSelectProduct,
  onOpenCart,
  onOpenMenu,
  cartCount = 0,
  isEmbedded = false,
}: DiscoverViewProps) {
  const content = useStorefrontContent();
  const { t, lang, dir } = useLang();
  const { palette } = useBrandPalette();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = content.data?.categories ?? [];
  const products = content.data?.products ?? [];

  const visible = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return products
      .filter((product) => (selectedCategory ? product.category_id === selectedCategory : true))
      .filter((product) =>
        needle
          ? `${product.name_en} ${product.name_ar} ${product.category}`
              .toLowerCase()
              .includes(needle)
          : true,
      );
  }, [products, selectedCategory, searchQuery]);

  return (
    <div
      dir={dir}
      className={`relative flex min-h-dvh w-full max-w-full flex-col overflow-x-hidden overflow-y-auto bg-background text-foreground ${
        isEmbedded
          ? "max-h-[820px] min-h-[740px] rounded-[38px] border-4 border-foreground/80 shadow-2xl"
          : ""
      }`}
    >
      <BackgroundCurves />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-1.5 border-b border-border/80 bg-background/95 px-2.5 py-3 backdrop-blur-md min-[380px]:gap-3 min-[380px]:px-4 sm:px-8 lg:px-12">
        <div className="flex shrink-0 items-center gap-1.5 min-[380px]:gap-2.5">
          {onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label={lang === "ar" ? "القائمة الرئيسية" : "Main Menu"}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-border bg-card text-foreground shadow-2xs transition-all hover:bg-secondary/50 active:scale-95"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <LangToggle variant="peach" className="shrink-0 max-[359px]:hidden" />
        </div>

        <div className="flex min-w-0 flex-1 justify-center px-1">
          <DelishLogo size="sm" />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 min-[380px]:gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label={lang === "ar" ? "بحث عن منتج" : "Search"}
            className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border transition-all active:scale-95 ${
              searchOpen
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground shadow-2xs hover:bg-secondary/50"
            }`}
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={
              cartCount > 0
                ? lang === "ar"
                  ? `سلة المشتريات (${cartCount})`
                  : `Shopping Cart (${cartCount})`
                : t("cart")
            }
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-border bg-card text-foreground shadow-2xs transition-all hover:bg-secondary/50 active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 && (
              <span
                style={{ backgroundColor: palette.badgeBg || palette.main }}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold text-white shadow-sm ring-2 ring-background"
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Expandable Search Drawer */}
      {searchOpen && (
        <div className="relative z-20 border-b border-border/80 bg-card/90 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-12">
          <div className="mx-auto max-w-xl">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute right-4 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder={lang === "ar" ? "ابحث عن كيك، معجنات، ماكارون..." : t("search")}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-2xl border border-input bg-background py-3 pr-11 pl-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Expansive Catalog Container */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* Refined Luxury Heading */}
        <section className="mb-8 text-center sm:mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-4 py-1 text-xs font-bold text-primary shadow-2xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {lang === "ar" ? "تشكيلة البوتيك الحرفية · عمّان" : "Artisan Boutique Collection · Amman"}
            </span>
          </div>

          <h1 className="mt-3 font-sans text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {lang === "ar" ? "قائمة الكيك والحلويات الفاخرة" : "Luxury Cake & Pastry Collection"}
          </h1>

          <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {lang === "ar"
              ? "نخبز كل صنف يومياً بأجود المكونات والشوكولاتة البلجيكية الفاخرة لنقدم لكم مذاقاً استثنائياً في مناسباتكم."
              : "Handcrafted daily using fine Belgian chocolate and fresh ingredients for your cherished celebrations."}
          </p>
        </section>

        {/* Minimalist Horizontal Category Filter Ribbon */}
        {categories.length > 0 && (
          <nav
            aria-label="Categories Filter"
            className="mb-8 flex items-center justify-start gap-2 overflow-x-auto pb-2 no-scrollbar sm:justify-center sm:pb-0"
          >
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
                selectedCategory === null
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/80 bg-card text-foreground shadow-2xs hover:border-primary/40 hover:bg-secondary/40"
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>{lang === "ar" ? "جميع الأصناف" : "All Menu"}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  selectedCategory === null
                    ? "bg-primary-foreground/20 text-white"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {products.length}
              </span>
            </button>

            {categories.map((category) => {
              const active = selectedCategory === category.id;
              const categoryName = lang === "ar" ? category.name_ar : category.name_en;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(active ? null : category.id)}
                  className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/80 bg-card text-foreground shadow-2xs hover:border-primary/40 hover:bg-secondary/40"
                  }`}
                >
                  <span>{categoryName}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Product Catalog Grid */}
        <section aria-label="Products Grid">
          {content.isPending ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-xs text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
              <span>{t("loadingMenu")}</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-[2.5rem] border border-border bg-card py-20 text-center shadow-2xs">
              <Cake className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-base font-bold text-foreground">{t("emptyMenu")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {lang === "ar" ? "جرّب تغيير التصنيف أو كلمة البحث" : "Try clearing filters"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {visible.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  lang={lang}
                  onSelect={onSelectProduct}
                />
              ))}
            </div>
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
  const description =
    lang === "ar"
      ? product.description_ar || "كيك وحلويات فاخرة تُخبز طازجة يومياً بأجود المكونات الطبيعية"
      : product.description_en || "Handcrafted artisan treats baked daily with fresh ingredients";
  const unitPrice = product.price;
  const photoSrc = resolveProductPhoto(product);

  return (
    <article
      onClick={() => onSelect?.(product.id)}
      className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-[2rem] border border-border/80 bg-card p-4 shadow-2xs transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-xl sm:p-5"
    >
      {/* Top Image Showcase: Large 4:3 Aspect Ratio with Soft Ambient Background */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-secondary/20 transition-colors">
        <img
          src={photoSrc}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* Category micro-tag over image */}
        <div className="absolute top-3.5 right-3.5 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-md">
          {product.category || (lang === "ar" ? "ديليش" : "Delish")}
        </div>

        {/* Popular Tag if applicable */}
        {product.is_popular && (
          <div className="absolute top-3.5 left-3.5 flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-500/90 px-2.5 py-1 text-[10px] font-extrabold text-white shadow-xs backdrop-blur-xs">
            <Sparkles className="h-3 w-3" />
            <span>{lang === "ar" ? "الأكثر طلباً" : "Popular"}</span>
          </div>
        )}

        {/* Hover Quick Action Pill on Desktop */}
        <div className="pointer-events-none absolute inset-0 z-10 hidden items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:flex">
          <span className="flex items-center gap-1.5 rounded-full border border-white/40 bg-card/95 px-4 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur-md transition-transform duration-200 hover:scale-105">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{lang === "ar" ? "تفاصيل وتخصيص الكيك" : "Customize Cake"}</span>
          </span>
        </div>
      </div>

      {/* Card Body: Typography & Information Hierarchy */}
      <div className="mt-4 flex flex-1 flex-col justify-between space-y-3 px-1">
        <div>
          <span className="text-[11px] font-bold text-primary tracking-wide">
            {product.category || (lang === "ar" ? "كيك فاخر" : "Artisan Cake")}
          </span>
          <h2 className="mt-0.5 font-sans text-base font-bold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-lg line-clamp-2 min-h-[2.5rem] sm:min-h-[2.75rem]">
            {name}
          </h2>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        {/* Card Footer: Clear Price in JOD & Tactile Action Button */}
        <div className="mt-2 flex items-center justify-between border-t border-border/70 pt-3.5">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-muted-foreground uppercase">
              {lang === "ar" ? "السعر يبدأ من" : "Starting from"}
            </span>
            <span className="font-sans text-lg font-extrabold text-foreground sm:text-xl">
              {formatJod(unitPrice, lang)}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(product.id);
            }}
            aria-label={lang === "ar" ? `اختيار ${name}` : `Select ${name}`}
            className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-2xs transition-all duration-200 hover:bg-primary/90 hover:shadow-xs active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{lang === "ar" ? "اختيار" : "Select"}</span>
          </button>
        </div>
      </div>
    </article>
  );
});
