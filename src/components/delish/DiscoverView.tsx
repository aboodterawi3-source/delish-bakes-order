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
  Layers,
  MessageCircle,
  Clock,
  MapPin,
  Check,
  ChevronLeft,
} from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { type StorefrontProduct } from "@/lib/storefront-content";
import { LangToggle, useLang, type Lang } from "@/lib/i18n";
import { formatJod } from "@/lib/currency";
import { useBrandPalette } from "@/lib/brand-palette";
import { WHATSAPP } from "@/lib/menu";
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

  // Category counts
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category_id) {
        map[p.category_id] = (map[p.category_id] || 0) + 1;
      }
    });
    return map;
  }, [products]);

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

  // Top featured spotlight item on desktop
  const featuredProduct = useMemo(() => {
    if (visible.length === 0) return null;
    return visible.find((p) => p.is_popular) || visible[0];
  }, [visible]);

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
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-12">
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
        <div className="relative z-20 border-b border-border/80 bg-card/90 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-12">
          <div className="mx-auto max-w-2xl">
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

      {/* Main Expansive Content Container on Desktop */}
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        {/* Mobile-Only Horizontal Category Ribbon (Clean, fast touch browsing) */}
        {categories.length > 0 && (
          <div className="mb-6 space-y-3 lg:hidden">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-sans text-sm font-bold tracking-tight text-foreground">
                {lang === "ar" ? "التصنيفات" : "Categories"}
              </h3>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="cursor-pointer text-xs font-bold text-primary hover:underline"
                >
                  {lang === "ar" ? "عرض الكل" : "Show all"}
                </button>
              )}
            </div>

            <div className="no-scrollbar flex w-full max-w-full gap-2.5 overflow-x-auto overscroll-x-contain px-0.5 pt-1 pb-2">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                  selectedCategory === null
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-foreground shadow-2xs hover:bg-secondary/40"
                }`}
              >
                <Layers className="h-4 w-4" />
                <span>{lang === "ar" ? "جميع الأصناف" : "All"}</span>
              </button>

              {categories.map((category) => {
                const active = selectedCategory === category.id;
                const categoryName = lang === "ar" ? category.name_ar : category.name_en;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(active ? null : category.id)}
                    className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-foreground shadow-2xs hover:bg-secondary/40"
                    }`}
                  >
                    <span>{categoryName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Desktop Split Layout: Sticky Boutique Filter Sidebar + Generous 3-Column Product Stage */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          {/* DESKTOP SIDEBAR (Visible on 1440px / Desktop) */}
          <aside className="hidden space-y-6 lg:sticky lg:top-24 lg:block lg:w-72 lg:shrink-0">
            {/* Category Navigation Card */}
            <div className="rounded-[2rem] border border-border/80 bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
                <span className="font-sans text-sm font-extrabold text-foreground">
                  {lang === "ar" ? "تصنيفات البوتيك" : "Boutique Menu"}
                </span>
                <span className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  {products.length} {lang === "ar" ? "صنف" : "items"}
                </span>
              </div>

              {/* Vertical Category Navigation List */}
              <nav aria-label="Desktop Categories" className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                    selectedCategory === null
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4" />
                    <span>{lang === "ar" ? "جميع الأصناف" : "All Categories"}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      selectedCategory === null
                        ? "bg-primary-foreground/20 text-white"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {products.length}
                  </span>
                </button>

                {categories.map((cat) => {
                  const active = selectedCategory === cat.id;
                  const catName = lang === "ar" ? cat.name_ar : cat.name_en;
                  const count = categoryCounts[cat.id] || 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(active ? null : cat.id)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                        active
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {cat.image_url ? (
                          <img
                            src={cat.image_url}
                            alt=""
                            className="h-5 w-5 rounded-full border border-white/40 object-cover"
                          />
                        ) : (
                          <Cake className="h-4 w-4" />
                        )}
                        <span>{catName}</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          active
                            ? "bg-primary-foreground/20 text-white"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Boutique Concierge & Custom Cake Card */}
            <div className="space-y-3.5 rounded-[2rem] border border-border/80 bg-gradient-to-br from-card via-secondary/25 to-amber-50/30 p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <Sparkles className="h-4 w-4" />
                <span>
                  {lang === "ar" ? "كيك مخصص لكافة المناسبات" : "Custom Celebration Cakes"}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {lang === "ar"
                  ? "هل تبحث عن تصميم كيك استثنائي لحفل تخرج أو زفاف؟ استشر شيف الكيك مباشرة في عمّان."
                  : "Looking for an exclusive wedding or celebration design? Consult our master pastry chef in Amman."}
              </p>
              <a
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
                  "مرحباً ديليش، أود الاستفسار عن تفصيل كيكة خاصة لحفلتي",
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-whatsapp/90 active:scale-95"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{lang === "ar" ? "استشارة عبر واتساب" : "WhatsApp Concierge"}</span>
              </a>
            </div>

            {/* Operating info */}
            <div className="space-y-2 rounded-2xl border border-border/60 bg-card/60 p-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>{lang === "ar" ? "يومياً من 8:00 ص حتى 11:00 م" : "Daily 8 AM – 11 PM"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>
                  {lang === "ar" ? "عمّان، الأردن · توصيل مبرد" : "Amman · Refrigerated Delivery"}
                </span>
              </div>
            </div>
          </aside>

          {/* MAIN PRODUCT CATALOG STAGE */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* Desktop Spotlight Hero Feature Card (Visible on 1440px / Desktop) */}
            {featuredProduct && (
              <section
                aria-label="Featured Product Spotlight"
                className="relative hidden overflow-hidden rounded-[2.5rem] border border-border bg-gradient-to-r from-card via-secondary/30 to-amber-50/40 p-6 shadow-sm transition-all lg:block"
              >
                <div className="grid grid-cols-12 items-center gap-8">
                  {/* Content Column */}
                  <div className="col-span-7 space-y-3.5 text-start">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>
                        {lang === "ar"
                          ? "كيكة التوقيع المميزة لهذا الأسبوع"
                          : "Signature Spotlight"}
                      </span>
                    </div>

                    <h2 className="font-sans text-2xl font-extrabold tracking-tight text-foreground xl:text-3xl">
                      {lang === "ar" ? featuredProduct.name_ar : featuredProduct.name_en}
                    </h2>

                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {lang === "ar"
                        ? featuredProduct.description_ar ||
                          "كيكة احتفالية فاخرة بحشوات التوت الطازج والشوكولاتة البلجيكية، مصنوعة يدوياً بحرفية عالية."
                        : featuredProduct.description_en ||
                          "Handcrafted celebration cake made with fresh berries and Belgian chocolate."}
                    </p>

                    <div className="flex items-center gap-4 pt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase">
                          {lang === "ar" ? "السعر يبدأ من" : "Starting from"}
                        </span>
                        <span className="font-sans text-xl font-black text-foreground">
                          {formatJod(featuredProduct.price, lang)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProduct?.(featuredProduct.id)}
                        className="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
                      >
                        <Cake className="h-4 w-4" />
                        <span>
                          {lang === "ar" ? "تخصيص وطلب الكيكة الآن" : "Customize & Order"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Spotlight Image Column */}
                  <div className="col-span-5 flex justify-end">
                    <div className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl border-2 border-border/80 bg-card p-1 shadow-md">
                      <img
                        src={featuredProduct.image_url || luxuryCakeShowcaseImg}
                        alt={featuredProduct.name_ar}
                        className="h-full w-full rounded-xl object-cover transition-transform duration-700 hover:scale-105"
                      />
                      <span className="absolute top-3 right-3 rounded-lg bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
                        {featuredProduct.category || (lang === "ar" ? "كيك فاخر" : "Cake")}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Catalog Grid Header Row */}
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="space-y-0.5">
                <h3 className="font-sans text-lg font-extrabold text-foreground sm:text-xl">
                  {activeCategoryName
                    ? activeCategoryName
                    : lang === "ar"
                      ? "قائمة المنتجات الكاملة"
                      : "Full Menu Collection"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {lang === "ar"
                    ? `عرض ${visible.length} صنف متوفر للطلب المباشر في عمّان`
                    : `Showing ${visible.length} available items in Amman`}
                </p>
              </div>

              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="hidden cursor-pointer items-center gap-1 text-xs font-bold text-primary hover:underline lg:inline-flex"
                >
                  <span>{lang === "ar" ? "إلغاء التصفية وعرض الكل" : "Reset filter"}</span>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Catalog Grid State */}
            {content.isPending ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-xs text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
                <span>{t("loadingMenu")}</span>
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-[2rem] border border-border bg-card py-20 text-center shadow-2xs">
                <Cake className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-base font-bold text-foreground">{t("emptyMenu")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === "ar" ? "جرّب تغيير التصنيف أو كلمة البحث" : "Try clearing filters"}
                </p>
              </div>
            ) : (
              /* Generous 3-Column Grid on Desktop (each card has ~320px width for appetizing cake view) */
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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
          </div>
        </div>
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
      className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-[1.75rem] border border-border/80 bg-card p-4 shadow-2xs transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl"
    >
      {/* Top Image Showcase: Large 4:3 Aspect Ratio with Soft Ambient Background */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-secondary/25 transition-colors">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-secondary/30 text-xs font-bold text-primary">
            <Cake className="mb-1 h-8 w-8 opacity-40" />
            <span>{name}</span>
          </div>
        )}

        {/* Category micro-tag over image */}
        <div className="absolute top-3 right-3 rounded-xl border border-white/20 bg-black/50 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
          {product.category || (lang === "ar" ? "ديليش" : "Delish")}
        </div>

        {/* Hover Quick Action Pill on Desktop */}
        <div className="pointer-events-none absolute inset-0 z-10 hidden items-center justify-center bg-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:flex">
          <span className="flex items-center gap-1.5 rounded-full border border-white/30 bg-card/95 px-4 py-2 text-xs font-bold text-foreground shadow-md backdrop-blur-xs transition-transform duration-200 hover:scale-105">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{lang === "ar" ? "تفاصيل وتخصيص الكيك" : "Customize"}</span>
          </span>
        </div>
      </div>

      {/* Card Body: Typography & Information Hierarchy */}
      <div className="mt-4 flex flex-1 flex-col justify-between space-y-2 px-0.5">
        <div>
          <h4 className="font-sans text-base leading-snug font-bold text-foreground transition-colors group-hover:text-primary sm:text-lg">
            {name}
          </h4>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        {/* Card Footer: Clear Price in JOD & Tactile Action Button */}
        <div className="mt-3.5 flex items-center justify-between border-t border-border/70 pt-3">
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
            className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-2xs transition-all duration-200 hover:bg-primary/90 hover:shadow-xs active:scale-95"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>{lang === "ar" ? "اختيار" : "Select"}</span>
          </button>
        </div>
      </div>
    </article>
  );
});
