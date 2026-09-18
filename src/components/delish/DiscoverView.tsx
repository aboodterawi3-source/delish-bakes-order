import React, { memo, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ShoppingBag, ArrowRight, Plus, Loader2, Menu, Sparkles } from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { priceForSize, tintFill, type StorefrontProduct } from "@/lib/storefront-content";
import { LangToggle, useLang, type Lang } from "@/lib/i18n";
import { formatJod } from "@/lib/currency";

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAllCatalog, setShowAllCatalog] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const banner = content.data?.banner ?? null;
  const categories = content.data?.categories ?? [];
  const products = content.data?.products ?? [];

  const visible = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return products
      .filter((product) => (showAllCatalog ? true : product.is_popular))
      .filter((product) => (selectedCategory ? product.category_id === selectedCategory : true))
      .filter((product) =>
        needle
          ? `${product.name_en} ${product.name_ar} ${product.category}`.toLowerCase().includes(needle)
          : true,
      );
  }, [products, selectedCategory, searchQuery, showAllCatalog]);

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
        {/* Promotional hero banner */}
        {banner && (
          <section
            aria-label="Promotional offer"
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#B8801C] to-[#C58B24] p-5 text-white shadow-md"
          >
            <div className="absolute -right-8 -bottom-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20" viewBox="0 0 400 200" fill="none">
              <path d="M180 -20 C240 60, 260 140, 420 180" stroke="currentColor" strokeWidth="24" strokeOpacity="0.2" />
            </svg>

            <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-semibold tracking-wide text-amber-100">{banner.subtitle}</p>
                <h2 className="text-3xl font-black uppercase leading-none tracking-tight text-white">
                  {banner.discount_text}
                </h2>
                <div className="pt-2">
                  <Link
                    to="/product-details"
                    search={{ id: undefined }}
                    className="inline-flex items-center justify-center rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#6E3917] shadow-sm transition hover:bg-[#FEF7EB] active:scale-95"
                  >
                    {banner.button_text}
                  </Link>
                </div>
              </div>

              {banner.image_url && (
                <div className="relative -my-2 flex h-24 w-24 items-center justify-center sm:h-28 sm:w-36">
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

        {/* Discover by category — Redesigned & Enlarged */}
        {categories.length > 0 && (
          <section aria-label="Discover by category" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-[#26160F] sm:text-base">{t("discoverByCategory")}</h3>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-semibold text-[#B8801C] transition-transform hover:underline active:scale-95"
                >
                  {t("showAll")}
                </button>
              )}
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
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-[#26160F] sm:text-lg">
              {activeCategoryName ? `${t("popular")} · ${activeCategoryName}` : t("popular")}
            </h3>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                setShowAllCatalog((prev) => !prev);
              }}
              aria-label={t("showAll")}
              className="flex items-center gap-1.5 text-xs font-extrabold text-[#B8801C] hover:text-[#9E6C14] transition-all rounded-full bg-[#FEF7EB] px-3.5 py-1 border border-[#EFE8DC] active:scale-95 shadow-xs"
            >
              <span>{showAllCatalog ? (lang === "ar" ? "المميز فقط ✨" : "Popular Only ✨") : t("showAll")}</span>
              <ArrowRight className={`h-3.5 w-3.5 transition-transform duration-300 ${showAllCatalog ? "rotate-180" : ""}`} />
            </button>
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
  const name = lang === "ar" ? product.name_ar : product.name_en;
  const description = lang === "ar"
    ? product.description_ar || "كيك فاخر مغطى بالسكر والكريمة"
    : product.description_en || "Cake covered with sugar";
  const unitPrice = product.price;

  return (
    <div
      onClick={() => onSelect?.(product.id)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-[#EFE8DC] bg-white p-2.5 sm:p-3 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[#B8801C]/40 hover:shadow-xl cursor-pointer"
    >
      {/* Top Square Image Showcase Container */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#FAF5EB] p-3 flex items-center justify-center">
        {/* Center Hover Glassmorphic Action Button (Luxury Quick Look Pill) */}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/15 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(product.id);
            }}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#B8801C]/40 bg-white/85 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-[#26160F] shadow-md backdrop-blur-xs transition-all duration-300 transform scale-95 group-hover:scale-100 hover:bg-white hover:border-[#B8801C] hover:shadow-lg active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#B8801C]" />
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
          <span className="grid h-full w-full place-items-center text-xs font-bold text-[#B8801C]">
            {name}
          </span>
        )}
      </div>

      {/* Card Body Content */}
      <div className="mt-3 flex-1 space-y-1 px-1">
        <span className="block text-[9px] font-black uppercase tracking-wider text-[#B8801C]">
          TRENDING
        </span>
        <h4 className="font-bold text-[#26160F] text-sm sm:text-base leading-tight line-clamp-1 group-hover:text-[#B8801C] transition-colors">
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
          className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-2xl bg-[#B8801C] text-white shadow-md hover:bg-[#9E6C14] active:scale-90 transition-all border border-amber-900/10"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
        </button>
      </div>
    </div>
  );
});

