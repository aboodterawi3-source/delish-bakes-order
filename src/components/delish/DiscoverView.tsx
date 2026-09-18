import React, { memo, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ShoppingBag, ArrowRight, Plus, Loader2, Menu, Sparkles } from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { priceForSize, tintFill, type StorefrontProduct } from "@/lib/storefront-content";
import { LangToggle, useLang, type Lang } from "@/lib/i18n";
import { formatJod } from "@/lib/currency";
import { useBrandPalette, type BrandPalette } from "@/lib/brand-palette";
import luxuryCakeShowcaseImg from "@/assets/luxury-cake-showcase.jpg";

interface DiscoverViewProps {
  onSelectProduct?: (productId: string) => void;
  /** Opens the quick details modal for a product. */
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
      className={`relative flex min-h-dvh w-full max-w-full flex-col overflow-x-hidden overflow-y-auto bg-[#FDFBF7] text-[#4A3B32] ${
        isEmbedded ? "min-h-[740px] max-h-[820px] rounded-[38px] shadow-2xl border-4 border-[#6E3917]" : ""
      }`}
    >
      <BackgroundCurves />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-[#EFE8DC] bg-[#FDFBF7]/90 px-4 py-3.5 backdrop-blur-md sm:px-5">
        <div className="flex items-center gap-2">
          {onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label={lang === "ar" ? "القائمة الرئيسية" : "Main Menu"}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EFE8DC] bg-white text-[#6E3917] shadow-xs transition hover:bg-[#FEF7EB] active:scale-95"
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
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EFE8DC] bg-white text-[#6E3917] shadow-xs transition hover:bg-[#FEF7EB] active:scale-95"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={t("cart")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#EFE8DC] bg-white text-[#6E3917] shadow-xs transition hover:bg-[#FEF7EB] active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#B8801C] text-[9px] font-bold text-white shadow">
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
            className="w-full rounded-2xl border border-[#EFE8DC] bg-white px-4 py-2 text-xs text-[#26160F] placeholder:text-[#4A3B32]/50 focus:outline-none focus:ring-2 focus:ring-[#B8801C]"
            autoFocus
          />
        </div>
      )}

      <main className="relative z-10 w-full max-w-3xl flex-1 space-y-6 self-center overflow-x-hidden px-4 py-4 sm:px-5">
        {/* Dynamic Hero Banner (Managed via Sales/Admin Website Management) */}
        {banner && banner.is_active !== false && (
          <section
            aria-label="Promotional Hero Showcase"
            className="relative overflow-hidden rounded-3xl border border-[#EFE8DC] bg-gradient-to-br from-[#FDFBF7] via-[#FAF5EB] to-[#F5ECE0] p-5 sm:p-6 shadow-sm transition-all hover:shadow-md"
          >
            {/* Ambient background glow decorative elements */}
            <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-[#B8801C]/10 blur-3xl" />
            <div className="absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-[#6E3917]/10 blur-3xl" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6">
              {/* Left Content Side: Purely Dynamic Headline & Subtitle */}
              <div className="flex-1 min-w-0 space-y-3 text-start">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-[#26160F] leading-snug">
                  {banner.discount_text || (lang === "ar" ? "كيكات مميزة تُصنع بحب لمناسباتكم الخاصة 🎂" : "Signature Celebration Cakes 🎂")}
                </h2>

                <p className="text-xs sm:text-sm font-medium text-[#6E3917]/80 leading-relaxed max-w-lg">
                  {banner.subtitle || (lang === "ar" ? "سواء كان حفل تخرج، عيد ميلاد، أو ذكرى مميزة.. نصمم لك كيكة استثنائية تناسب ذوقك وتليق بلحظاتك السعيدة." : "We craft exceptional cakes tailored to your special moments.")}
                </p>

                {/* Visual Value Badges */}
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#EFE8DC] bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#4A3B32] shadow-2xs">
                    🍰 {lang === "ar" ? "خبيز طازج يومياً بأجود المكونات" : "Baked Fresh Daily"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#EFE8DC] bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#4A3B32] shadow-2xs">
                    🚗 {lang === "ar" ? "توصيل مبرد وآمن في كافة مناطق عمّان" : "Refrigerated Amman Delivery"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#EFE8DC] bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#4A3B32] shadow-2xs">
                    ⚡ {lang === "ar" ? "دفع ميسر وسريع عبر كليك أو كاش" : "Easy CliQ & Cash Payment"}
                  </span>
                </div>
              </div>

              {/* Right Showcase Image: Purely Dynamic Image URL */}
              <div className="relative shrink-0 w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-white p-1">
                <img
                  src={banner.image_url || luxuryCakeShowcaseImg}
                  alt={banner.discount_text || "Delish Bakery Banner"}
                  className="h-full w-full object-cover rounded-xl transition-transform duration-700 hover:scale-110"
                />
              </div>
            </div>
          </section>
        )}

        {/* Discover by category — Redesigned & Enlarged */}
        {categories.length > 0 && (
          <section aria-label="Discover by category" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-[#26160F] sm:text-base">{t("discoverByCategory")}</h3>
            </div>

            <div className="no-scrollbar flex w-full max-w-full gap-3.5 sm:gap-5 overflow-x-auto overscroll-x-contain pb-2 pt-1 px-1">
              {categories.map((category) => {
                const active = selectedCategory === category.id;
                const categoryName = lang === "ar" ? category.name_ar : category.name_en;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCategory(active ? null : category.id)}
                    className={`group flex w-20 sm:w-24 shrink-0 flex-col items-center gap-2 rounded-3xl p-2 transition-all duration-300 ${
                      active
                        ? "bg-[#FEF7EB] shadow-sm -translate-y-0.5"
                        : "hover:-translate-y-1 hover:bg-[#FAF5EB]/60"
                    }`}
                  >
                    {/* Generous 80px (desktop) / 64px (mobile) Food Circle */}
                    <div
                      className={`relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-full p-1 transition-all duration-300 ${
                        active
                          ? "border-2 border-[#B8801C] ring-4 ring-[#B8801C]/20 bg-[#FAF5EB] shadow-md scale-105"
                          : "border-2 border-[#EFE8DC] bg-[#FAF5EB] shadow-xs group-hover:border-[#B8801C]/40 group-hover:shadow-md"
                      }`}
                    >
                      {category.image_url ? (
                        <img
                          src={category.image_url}
                          alt={categoryName}
                          className="h-full w-full rounded-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center rounded-full bg-[#FAF5EB] text-xs sm:text-sm font-black text-[#B8801C]">
                          {categoryName.slice(0, 1)}
                        </span>
                      )}
                    </div>

                    {/* Category Title */}
                    <span
                      className={`text-xs sm:text-sm text-center leading-tight line-clamp-1 transition-colors ${
                        active ? "font-extrabold text-[#B8801C]" : "font-bold text-[#26160F] group-hover:text-[#B8801C]"
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

        {/* Popular cakes — Grid */}
        <section aria-label="Popular cakes" className="space-y-4 pb-8">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-black text-[#26160F] sm:text-lg">
              {activeCategoryName ? activeCategoryName : (lang === "ar" ? "قائمة المنتجات" : "Product Catalog")}
            </h3>
          </div>

          {content.isPending ? (
            <p className="flex items-center justify-center gap-2 py-12 text-xs text-[#4A3B32]/70">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("loadingMenu")}
            </p>
          ) : visible.length === 0 ? (
            <p className="rounded-3xl border border-[#EFE8DC] bg-white py-12 text-center text-xs text-[#4A3B32]/70 shadow-xs">
              {t("emptyMenu")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">
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
  const { palette } = useBrandPalette();
  const name = lang === "ar" ? product.name_ar : product.name_en;
  const description = lang === "ar"
    ? product.description_ar || "كيك فاخر مغطى بالسكر والكريمة"
    : product.description_en || "Cake covered with sugar";
  const unitPrice = product.price;

  return (
    <div
      onClick={() => onSelect?.(product.id)}
      style={{ borderColor: palette.border }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-white p-2.5 sm:p-3 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer"
    >
      {/* Top Square Image Showcase Container */}
      <div
        style={{ backgroundColor: palette.cardBg }}
        className="relative aspect-square w-full overflow-hidden rounded-2xl p-3 flex items-center justify-center transition-colors duration-300"
      >
        {/* Center Hover Glassmorphic Action Button (Luxury Quick Look Pill) */}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/15 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(product.id);
            }}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-black/10 bg-white/90 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-[#26160F] shadow-md backdrop-blur-xs transition-all duration-300 transform scale-95 group-hover:scale-100 hover:bg-white hover:shadow-lg active:scale-95 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: palette.main }} />
            <span>{lang === "ar" ? "🎂 نظرة سريعة" : "🎂 Quick Look"}</span>
          </button>
        </div>

        {/* Product Photo */}
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={name}
            loading="lazy"
            className="h-full w-full object-contain drop-shadow-md transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-xs font-bold" style={{ color: palette.main }}>
            {name}
          </span>
        )}
      </div>

      {/* Card Body Content */}
      <div className="mt-3 flex-1 space-y-1 px-1">
        <span className="block text-[9px] font-black uppercase tracking-wider" style={{ color: palette.main }}>
          TRENDING
        </span>
        <h4 className="font-bold text-[#26160F] text-sm sm:text-base leading-tight line-clamp-1 transition-colors">
          {name}
        </h4>
        <p className="text-[11px] font-medium text-[#4A3B32]/70 line-clamp-1">
          {description}
        </p>
      </div>

      {/* Card Footer Row: Price & Prominent [+] Action Button */}
      <div className="mt-3 flex items-center justify-between border-t border-[#EFE8DC] pt-2.5 px-1">
        <div className="min-w-0">
          <span className="font-black text-[#26160F] text-sm sm:text-base">
            {formatJod(unitPrice, lang)}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(product.id);
          }}
          aria-label={lang === "ar" ? "إضافة إلى السلة" : "Add to cart"}
          style={{ backgroundColor: palette.btnBg }}
          className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-2xl text-white shadow-md active:scale-90 transition-all border border-amber-900/10 cursor-pointer hover:opacity-90"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
        </button>
      </div>
    </div>
  );
});

