import React, { memo, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { priceForSize, tintFill, getProductFallbackImage, type StorefrontProduct } from "@/lib/storefront-content";
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
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-3.5 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2">
          {onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label={lang === "ar" ? "القائمة الرئيسية" : "Main Menu"}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xs transition hover:bg-secondary/60 active:scale-95"
            >
              <Menu className="h-4 w-4" />
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
            aria-label={lang === "ar" ? "بحث" : "Search"}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xs transition hover:bg-secondary/60 active:scale-95"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={t("cart")}
            className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xs transition hover:bg-secondary/60 active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 && (
              <span
                style={{ backgroundColor: palette.badgeBg || palette.main }}
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white shadow"
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {searchOpen && (
        <div className="relative z-20 px-5 pt-3 pb-1">
          <input
            type="search"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            autoFocus
          />
        </div>
      )}

      <main className="relative z-10 w-full max-w-3xl flex-1 space-y-6 self-center overflow-x-hidden px-4 py-5 sm:px-6">
        {/* Dynamic Hero Banner */}
        {banner && banner.is_active !== false && (
          <section
            aria-label="Promotional Hero Showcase"
            className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-secondary/20 to-secondary/40 p-5 shadow-xs transition-all hover:shadow-sm sm:p-7"
          >
            <div className="relative z-10 flex flex-col items-center justify-between gap-5 sm:gap-6 md:flex-row">
              {/* Left Content Side */}
              <div className="min-w-0 flex-1 space-y-3 text-start">
                <h2 className="font-display text-xl leading-snug font-extrabold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                  {banner.discount_text ||
                    (lang === "ar"
                      ? "كيكات مميزة تُصنع بحب لمناسباتكم الخاصة"
                      : "Signature Celebration Cakes")}
                </h2>

                <p className="max-w-lg text-xs leading-relaxed font-medium text-muted-foreground sm:text-sm">
                  {banner.subtitle ||
                    (lang === "ar"
                      ? "سواء كان حفل تخرج، عيد ميلاد، أو ذكرى مميزة.. نصمم لك كيكة استثنائية تناسب ذوقك وتليق بلحظاتك السعيدة."
                      : "We craft exceptional cakes tailored to your special moments.")}
                </p>

                {/* Refined Value Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs">
                    <Cake className="h-3.5 w-3.5 text-primary" />
                    {lang === "ar" ? "خبيز طازج يومياً بأجود المكونات" : "Baked Fresh Daily"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs">
                    <Truck className="h-3.5 w-3.5 text-primary" />
                    {lang === "ar" ? "توصيل مبرد وآمن في عمّان" : "Refrigerated Amman Delivery"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    {lang === "ar"
                      ? "دفع آمن عبر كليك أو نقد عند الاستلام"
                      : "Easy CliQ & Cash Payment"}
                  </span>
                </div>
              </div>

              {/* Right Showcase Image */}
              <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-sm sm:h-44 sm:w-44">
                <img
                  src={banner.image_url || luxuryCakeShowcaseImg}
                  alt={banner.discount_text || "Delish Bakery Banner"}
                  className="h-full w-full rounded-xl object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            </div>
          </section>
        )}

        {/* Discover by category */}
        {categories.length > 0 && (
          <section aria-label="Discover by category" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-foreground sm:text-base">
                {t("discoverByCategory")}
              </h3>
            </div>

            <div className="no-scrollbar flex w-full max-w-full gap-3 overflow-x-auto overscroll-x-contain px-1 pt-1 pb-2 sm:gap-4">
              {categories.map((category) => {
                const active = selectedCategory === category.id;
                const categoryName = lang === "ar" ? category.name_ar : category.name_en;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCategory(active ? null : category.id)}
                    className={`group flex min-w-[5.5rem] max-w-[6.5rem] shrink-0 cursor-pointer flex-col items-center gap-2 rounded-2xl p-2 transition-all duration-200 sm:min-w-[6rem] sm:max-w-[7rem] ${
                      active
                        ? "-translate-y-0.5 bg-secondary/40 shadow-xs ring-1 ring-primary/40"
                        : "hover:-translate-y-0.5 hover:bg-secondary/20"
                    }`}
                  >
                    <CategoryCircle
                      imageUrl={category.image_url}
                      icon={category.icon}
                      name={categoryName}
                      active={active}
                    />

                    {/* Category Title */}
                    <span
                      className={`line-clamp-2 text-center text-xs leading-tight transition-colors ${
                        active ? "font-bold text-primary" : "font-medium text-foreground"
                      }`}
                    >
                      {categoryName}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Product Catalog Grid */}
        <section aria-label="Product Catalog" className="space-y-4 pb-10">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-display text-base font-bold text-foreground sm:text-lg">
              {activeCategoryName
                ? activeCategoryName
                : lang === "ar"
                  ? "قائمة المنتجات"
                  : "Product Catalog"}
            </h3>
          </div>

          {content.isPending ? (
            <p className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />{" "}
              {t("loadingMenu")}
            </p>
          ) : visible.length === 0 ? (
            <p className="rounded-3xl border border-border bg-card py-12 text-center text-xs text-muted-foreground shadow-2xs">
              {t("emptyMenu")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
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

function CategoryCircle({
  imageUrl,
  icon,
  name,
  active,
}: {
  imageUrl?: string | null | undefined;
  icon?: string | null | undefined;
  name: string;
  active: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(imageUrl && !imgFailed);

  return (
    <div
      className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 bg-card p-1 transition-all duration-200 sm:h-20 sm:w-20 ${
        active
          ? "scale-105 border-primary shadow-sm ring-2 ring-primary/20"
          : "border-border group-hover:border-primary/50"
      }`}
    >
      {showImg ? (
        <img
          src={imageUrl!}
          alt={name}
          onError={() => setImgFailed(true)}
          className="h-full w-full rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="grid h-full w-full place-items-center rounded-full bg-secondary/30 text-2xl sm:text-3xl shadow-inner select-none">
          {icon || "🎂"}
        </span>
      )}
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
  const { palette } = useBrandPalette();
  const name = lang === "ar" ? product.name_ar : product.name_en;
  const description =
    lang === "ar"
      ? product.description_ar || "كيك وحلويات فاخرة تُخبز طازجة يومياً"
      : product.description_en || "Handcrafted artisan treats baked daily";
  const unitPrice = product.price;

  const fallback = useMemo(
    () => getProductFallbackImage(product.slug, product.category, name),
    [product.slug, product.category, name]
  );
  const [currentSrc, setCurrentSrc] = useState(product.image_url || fallback);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(product.image_url || fallback);
    setImgFailed(false);
  }, [product.image_url, fallback]);

  return (
    <div
      onClick={() => onSelect?.(product.id)}
      className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
    >
      {/* Top Square Image Showcase Container */}
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-secondary/15 p-2 transition-colors">
        {/* Center Hover Action Pill */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-foreground/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(product.id);
            }}
            className="pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card/95 px-3.5 py-1.5 text-xs font-bold text-foreground shadow-sm backdrop-blur-xs transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{lang === "ar" ? "نظرة سريعة" : "Quick Look"}</span>
          </button>
        </div>

        {/* Product Photo or Fallback Badge */}
        {!imgFailed ? (
          <img
            src={currentSrc}
            alt={name}
            loading="lazy"
            onError={() => {
              if (currentSrc !== fallback && fallback) {
                setCurrentSrc(fallback);
              } else {
                setImgFailed(true);
              }
            }}
            className="h-full w-full object-contain drop-shadow-xs transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-2 select-none">
            <span className="text-3xl sm:text-4xl">🎂</span>
            <span className="mt-1 text-[10px] font-bold text-primary">DELISH Bakes</span>
          </div>
        )}
      </div>

      {/* Card Body Content */}
      <div className="mt-3 flex-1 space-y-1 px-0.5">
        <span className="block text-[11px] font-semibold text-primary/90">
          {product.category || (lang === "ar" ? "حلويات ديليش" : "Delish Bakes")}
        </span>
        <h4 className="line-clamp-1 text-sm leading-snug font-bold text-foreground sm:text-base">
          {name}
        </h4>
        <p className="line-clamp-1 text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Card Footer Row: Price & Tactile Button */}
      <div className="mt-3 flex items-center justify-between border-t border-border px-0.5 pt-2.5">
        <div className="min-w-0">
          <span className="text-sm font-bold text-foreground sm:text-base">
            {formatJod(unitPrice, lang)}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(product.id);
          }}
          aria-label={lang === "ar" ? `طلب ${name}` : `Order ${name}`}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition hover:scale-110 active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
