import React, { memo, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  ShoppingBag,
  Plus,
  Loader2,
  Menu,
  Sparkles,
  Truck,
  ShieldCheck,
  Cake,
  SlidersHorizontal,
  ChevronLeft,
  ArrowRight,
  Layers,
} from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { type StorefrontProduct } from "@/lib/storefront-content";
import { LangToggle, useLang, type Lang } from "@/lib/i18n";
import { formatJod } from "@/lib/currency";
import { useBrandPalette } from "@/lib/brand-palette";
import luxuryCakeShowcaseImg from "@/assets/luxury-cake-showcase.jpg";

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

  const banner = content.data?.banner ?? null;
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

  const activeCategory = categories.find((category) => category.id === selectedCategory) ?? null;
  const activeCategoryName = activeCategory
    ? lang === "ar"
      ? activeCategory.name_ar
      : activeCategory.name_en
    : null;

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
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
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
          <LangToggle variant="peach" className="shrink-0" />
        </div>

        <div className="flex min-w-0 flex-col items-center">
          <DelishLogo size="sm" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
            aria-label={t("cart")}
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
        <div className="relative z-20 border-b border-border/80 bg-card/90 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto max-w-xl">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute right-3.5 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder={lang === "ar" ? "ابحث عن كيك، معجنات، ماكارون..." : t("search")}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-2xl border border-input bg-background py-2.5 pr-10 pl-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Boutique Promotional Showcase Banner */}
        {banner && banner.is_active !== false && (
          <section
            aria-label="Promotional Hero Showcase"
            className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-card via-secondary/30 to-amber-50/40 p-6 shadow-sm transition-all sm:p-8"
          >
            <div className="relative z-10 flex flex-col items-center justify-between gap-6 md:flex-row">
              {/* Content Side */}
              <div className="min-w-0 flex-1 space-y-3.5 text-start">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{lang === "ar" ? "إبداعات ديليش الخاصة" : "Delish Signature"}</span>
                </div>

                <h2 className="font-sans text-xl font-extrabold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                  {banner.discount_text ||
                    (lang === "ar"
                      ? "كيكات مميزة تُصنع بحب لمناسباتكم الخاصة"
                      : "Signature Celebration Cakes")}
                </h2>

                <p className="max-w-xl text-xs leading-relaxed font-medium text-muted-foreground sm:text-sm">
                  {banner.subtitle ||
                    (lang === "ar"
                      ? "سواء كان حفل تخرج، عيد ميلاد، أو ذكرى مميزة.. نصمم لك كيكة استثنائية تناسب ذوقك وتليق بلحظاتك السعيدة في عمّان."
                      : "We craft exceptional cakes tailored to your special moments in Amman.")}
                </p>

                {/* Trust Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs">
                    <Cake className="h-3.5 w-3.5 text-primary" />
                    <span>{lang === "ar" ? "خبيز طازج يومياً" : "Baked Fresh Daily"}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs">
                    <Truck className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {lang === "ar" ? "توصيل مبرد في عمّان" : "Refrigerated Amman Delivery"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    <span>{lang === "ar" ? "دفع سهل عبر كليك (CliQ)" : "Easy CliQ & Cash"}</span>
                  </span>
                </div>
              </div>

              {/* Showcase Photo */}
              <div className="relative h-44 w-44 shrink-0 overflow-hidden rounded-2xl border-2 border-border/80 bg-card p-1 shadow-md sm:h-52 sm:w-52">
                <img
                  src={banner.image_url || luxuryCakeShowcaseImg}
                  alt={banner.discount_text || "Delish Bakery Banner"}
                  className="h-full w-full rounded-xl object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            </div>
          </section>
        )}

        {/* Easy-Access Category Navigation Bar */}
        {categories.length > 0 && (
          <section aria-label="Discover by category" className="space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-sans text-sm font-bold tracking-tight text-foreground sm:text-base">
                {lang === "ar" ? "تصفّح حسب التصنيف" : t("discoverByCategory")}
              </h3>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="cursor-pointer text-xs font-bold text-primary hover:underline"
                >
                  {lang === "ar" ? "عرض جميع الأصناف" : "Show all"}
                </button>
              )}
            </div>

            {/* Category Ribbon with dedicated 'All' button */}
            <div className="no-scrollbar flex w-full max-w-full gap-2.5 overflow-x-auto overscroll-x-contain px-0.5 pt-1 pb-2 sm:gap-3">
              {/* "All" Categories Button */}
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                aria-pressed={selectedCategory === null}
                className={`group flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                  selectedCategory === null
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-foreground shadow-2xs hover:bg-secondary/40"
                }`}
              >
                <Layers className="h-4 w-4" />
                <span>{lang === "ar" ? "جميع الأصناف" : "All Items"}</span>
              </button>

              {/* Individual Category Pills */}
              {categories.map((category) => {
                const active = selectedCategory === category.id;
                const categoryName = lang === "ar" ? category.name_ar : category.name_en;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCategory(active ? null : category.id)}
                    className={`group flex shrink-0 cursor-pointer items-center gap-2.5 rounded-2xl border px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-foreground shadow-2xs hover:bg-secondary/40"
                    }`}
                  >
                    {/* Small category image circle */}
                    <div
                      className={`relative h-7 w-7 overflow-hidden rounded-full border bg-background transition-transform group-hover:scale-105 ${
                        active ? "border-primary-foreground/40" : "border-border"
                      }`}
                    >
                      {category.image_url ? (
                        <img
                          src={category.image_url}
                          alt={categoryName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-[10px] font-bold">
                          {categoryName.slice(0, 1)}
                        </span>
                      )}
                    </div>

                    <span>{categoryName}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Product Catalog Grid (Redesigned with large, appetizing photography) */}
        <section aria-label="Product Catalog" className="space-y-4 pb-12">
          <div className="flex items-center justify-between px-1">
            <div className="space-y-0.5">
              <h3 className="font-sans text-lg font-bold text-foreground sm:text-xl">
                {activeCategoryName
                  ? activeCategoryName
                  : lang === "ar"
                    ? "قائمة المنتجات المميزة"
                    : "Featured Catalog"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {lang === "ar"
                  ? `عرض ${visible.length} صنف متوفر للطلب المباشر في عمّان`
                  : `Showing ${visible.length} available items`}
              </p>
            </div>
          </div>

          {content.isPending ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-xs text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
              <span>{t("loadingMenu")}</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card py-16 text-center shadow-2xs">
              <Cake className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">{t("emptyMenu")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {lang === "ar" ? "جرّب تغيير التصنيف أو كلمة البحث" : "Try clearing filters"}
              </p>
            </div>
          ) : (
            /* Spacious, responsive grid: single/two column on mobile, 3 on tablet, 4 on desktop */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
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
      ? product.description_ar || "كيك وحلويات فاخرة تُخبز طازجة يومياً بأجود المكونات"
      : product.description_en || "Handcrafted artisan treats baked daily with fresh ingredients";
  const unitPrice = product.price;

  return (
    <article
      onClick={() => onSelect?.(product.id)}
      className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-[1.5rem] border border-border/80 bg-card p-3.5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg sm:p-4"
    >
      {/* Top Image Container: Large aspect ratio & appetizing presentation */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-secondary/25 transition-colors sm:aspect-[4/3]">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-secondary/30 text-xs font-bold text-primary">
            <Cake className="mb-1 h-8 w-8 opacity-40" />
            <span>{name}</span>
          </div>
        )}

        {/* Category micro-tag over image */}
        <div className="absolute top-2.5 right-2.5 rounded-lg border border-white/20 bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-xs">
          {product.category || (lang === "ar" ? "ديليش" : "Delish")}
        </div>

        {/* Hover Quick Action Pill on Desktop */}
        <div className="pointer-events-none absolute inset-0 z-10 hidden items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:flex">
          <span className="flex items-center gap-1.5 rounded-full border border-white/30 bg-card/95 px-4 py-2 text-xs font-bold text-foreground shadow-md backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{lang === "ar" ? "تفاصيل وتخصيص الكيك" : "Customize"}</span>
          </span>
        </div>
      </div>

      {/* Card Body: Typography & Hierarchy */}
      <div className="mt-3.5 flex flex-1 flex-col justify-between space-y-1.5 px-0.5">
        <div>
          <h4 className="font-sans text-base leading-snug font-bold text-foreground transition-colors group-hover:text-primary sm:text-lg">
            {name}
          </h4>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        {/* Card Footer: Clear Price in JOD & Tactile Action Button */}
        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-muted-foreground uppercase">
              {lang === "ar" ? "السعر يبدأ من" : "Starting from"}
            </span>
            <span className="font-sans text-base font-extrabold text-foreground sm:text-lg">
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
            className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-2xs transition-all duration-200 hover:bg-primary/90 hover:shadow-xs active:scale-95"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>{lang === "ar" ? "اختيار" : "Select"}</span>
          </button>
        </div>
      </div>
    </article>
  );
});
