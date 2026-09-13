import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ShoppingBag, Heart, Star, ArrowRight, Plus, Minus } from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";

interface DiscoverViewProps {
  onSelectProduct?: (productId: string) => void;
  onOpenCart?: () => void;
  cartCount?: number;
  isEmbedded?: boolean;
}

export function DiscoverView({
  onSelectProduct,
  onOpenCart,
  cartCount = 2,
  isEmbedded = false,
}: DiscoverViewProps) {
  const [selectedCategory, setSelectedCategory] = useState("Cake");
  const [ubeSize, setUbeSize] = useState("9 inch");
  const [germanSize, setGermanSize] = useState("6 inch");
  const [ubeQty, setUbeQty] = useState(1);
  const [germanQty, setGermanQty] = useState(1);
  const [ubeFav, setUbeFav] = useState(true);
  const [germanFav, setGermanFav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    { name: "Cake", bg: "bg-secondary text-secondary-foreground", border: "border-peach-coral/40", img: "/images/ube-drip-cake.jpg" },
    { name: "Pastry", bg: "bg-card text-foreground", border: "border-border", img: "/images/croissants.jpg" },
    { name: "Cupcake", bg: "bg-secondary/70 text-secondary-foreground", border: "border-peach-coral/30", img: "/images/macaron-stack.jpg" },
    { name: "Donuts", bg: "bg-card text-foreground", border: "border-border", img: "/images/macaron-pair.jpg" },
  ];

  return (
    <div
      className={`relative flex min-h-dvh w-full flex-col overflow-y-auto bg-[#F9FBFC] text-[#3E2723] ${
        isEmbedded ? "min-h-[740px] max-h-[820px] rounded-[38px] shadow-2xl border-4 border-[#2A2421]" : ""
      }`}
    >
      <BackgroundCurves />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-3.5 bg-[#F9FBFC]/80 backdrop-blur-md border-b border-[#F1F5F9]/80">
        {/* Left Avatar Icon */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FDE2CF] text-xs font-extrabold text-[#7B3F00] shadow-sm ring-2 ring-[#EFA781]/30">
          A
        </div>

        {/* Center Logo */}
        <div className="flex flex-col items-center">
          <DelishLogo size="sm" />
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-[#5D2E17] shadow-sm transition hover:bg-[#FDE2CF]/30 active:scale-95"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenCart}
            aria-label="Cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-[#5D2E17] shadow-sm transition hover:bg-[#FDE2CF]/30 active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#8B4513] text-[9px] font-bold text-white shadow">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Search Bar Input (collapsible) */}
      {searchOpen && (
        <div className="relative z-20 px-5 pt-2 pb-1 transition-all">
          <input
            type="search"
            placeholder="Search cakes, pastries, croissants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-amber-200/60 bg-white px-4 py-2 text-xs text-[#3E2723] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
            autoFocus
          />
        </div>
      )}

      {/* Main Content Body */}
      <main className="relative z-10 flex-1 px-5 py-4 space-y-6">
        {/* Promotional Hero Banner Card */}
        <section
          aria-label="Promotional offer"
          className="relative overflow-hidden rounded-3xl bg-peach-coral p-5 text-primary-foreground shadow-[var(--shadow-soft)]"
        >
          {/* Subtle dual-tone organic curve inside promo card */}
          <div className="absolute -right-8 -bottom-10 h-44 w-44 rounded-full bg-[#FDE2CF]/40 blur-2xl" />
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
            viewBox="0 0 400 200"
            fill="none"
          >
            <path
              d="M180 -20 C240 60, 260 140, 420 180"
              stroke="#ffffff"
              strokeWidth="24"
              strokeOpacity="0.2"
            />
          </svg>

          <div className="relative z-10 flex items-center justify-between">
            <div className="max-w-[170px] space-y-1.5">
              <p className="text-xs font-semibold tracking-wide text-white/95">
                Everyone's Favorite
              </p>
              <h2 className="text-3xl font-black uppercase tracking-tight text-white leading-none">
                40% OFF
              </h2>
              <div className="pt-2">
                <Link
                  to="/product-details"
                  className="inline-flex items-center justify-center rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#5D2E17] shadow-sm transition hover:bg-[#FFF5EE] active:scale-95"
                >
                  Order now
                </Link>
              </div>
            </div>

            {/* 3D Croissant image */}
            <div className="relative -mr-2 -my-2 w-32 sm:w-36 h-28 flex items-center justify-center">
              <img
                src="/images/croissants.jpg"
                alt="Flaky golden croissants"
                className="h-full w-full object-contain drop-shadow-[0_10px_16px_rgba(93,46,23,0.3)] transition-transform duration-500 hover:scale-105"
              />
            </div>
          </div>
        </section>

        {/* Discover By Category Section */}
        <section aria-label="Discover by category" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-[#3E2723]">
              Discover By Category
            </h3>
            <button
              type="button"
              className="text-xs font-semibold text-[#8B4513] hover:underline flex items-center gap-1"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Horizontal scrollable category pill cards */}
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => {
              const active = selectedCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`flex shrink-0 flex-col items-center gap-2 rounded-2xl p-2.5 transition-all duration-200 border ${cat.border} ${cat.bg} ${
                    active ? "ring-2 ring-[#8B4513] shadow-md scale-[1.02]" : "hover:scale-[1.01]"
                  } w-[76px]`}
                >
                  <div className="h-10 w-10 overflow-hidden rounded-xl bg-white/80 p-0.5 shadow-sm">
                    <img
                      src={cat.img}
                      alt={cat.name}
                      className="h-full w-full object-cover rounded-lg"
                    />
                  </div>
                  <span className="text-[11px] font-bold tracking-tight">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Popular Cake Section */}
        <section aria-label="Popular cakes" className="space-y-3 pb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-[#3E2723]">
              Popular Cake
            </h3>
            <Link
              to="/product-details"
              className="text-xs font-semibold text-[#8B4513] hover:underline flex items-center gap-1"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Card 1: Ube Flavoured Cake (Pixel perfect from reference) */}
          <div
            className="group relative overflow-hidden rounded-3xl bg-secondary/75 p-4 sm:p-5 border border-peach-coral/30 shadow-[var(--shadow-soft)] transition-all hover:shadow-[var(--shadow-card)]"
          >
            {/* Top row: Title + Heart favorite */}
            <div className="flex items-start justify-between">
              <div>
                <Link
                  to="/product-details"
                  className="font-sans text-base sm:text-lg font-extrabold text-foreground hover:text-primary"
                >
                  Ube Flavoured<br />Cake
                </Link>
                {/* Rating badge */}
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <Star className="h-3.5 w-3.5 fill-[#EAB308] text-[#EAB308]" />
                  <span>4.9</span>
                  <span className="text-purple-400/90">(128)</span>
                </div>
              </div>

              {/* Heart favorite button */}
              <button
                type="button"
                onClick={() => setUbeFav(!ubeFav)}
                aria-label="Add to favorites"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-purple-900 shadow-sm transition hover:bg-white active:scale-95"
              >
                <Heart
                  className={`h-4 w-4 ${
                    ubeFav ? "fill-[#DC2626] text-[#DC2626]" : "text-purple-400"
                  }`}
                />
              </button>
            </div>

            {/* Middle row: Size pills & Cake Image */}
            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
              <div className="space-y-3">
                {/* Size pills */}
                <div className="flex flex-wrap gap-1.5">
                  {["6 inch", "9 inch", "12 inch"].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setUbeSize(size)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                        ubeSize === size
                          ? "bg-[#3E2723] text-white shadow-sm"
                          : "border border-purple-200/80 bg-white/80 text-purple-900 hover:bg-white"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                {/* Quantity counter [- 1 +] in dark brown */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-full bg-[#3E2723] px-2 py-0.5 text-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setUbeQty(Math.max(1, ubeQty - 1))}
                      aria-label="Decrease quantity"
                      className="p-1 hover:text-amber-200 transition active:scale-90"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-2 text-xs font-bold">{ubeQty}</span>
                    <button
                      type="button"
                      onClick={() => setUbeQty(ubeQty + 1)}
                      aria-label="Increase quantity"
                      className="p-1 hover:text-amber-200 transition active:scale-90"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Price badge */}
                <div className="pt-1">
                  <span className="inline-block rounded-full bg-[#5D2E17] px-4 py-1.5 text-xs sm:text-sm font-extrabold text-white shadow-sm">
                    $55.00
                  </span>
                </div>
              </div>

              {/* Purple Drip Cake Image */}
              <div
                onClick={() => onSelectProduct?.("ube-cake")}
                className="cursor-pointer h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-2xl transition-transform duration-300 group-hover:scale-105"
              >
                <img
                  src="/images/ube-drip-cake.jpg"
                  alt="Ube Flavoured Cake with purple drip and macarons"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Card 2: German Chocolate Cake */}
          <div
            className="group relative overflow-hidden rounded-3xl bg-card p-4 sm:p-5 border border-border shadow-[var(--shadow-soft)] transition-all hover:shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <Link
                  to="/product-details"
                  className="font-sans text-base sm:text-lg font-extrabold text-[#451A03] hover:text-[#78350F]"
                >
                  German<br />Chocolate Cake
                </Link>
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#9A3412]">
                  <Star className="h-3.5 w-3.5 fill-[#EAB308] text-[#EAB308]" />
                  <span>4.8</span>
                  <span className="text-orange-400/90">(94)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setGermanFav(!germanFav)}
                aria-label="Add to favorites"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-orange-950 shadow-sm transition hover:bg-white active:scale-95"
              >
                <Heart
                  className={`h-4 w-4 ${
                    germanFav ? "fill-[#DC2626] text-[#DC2626]" : "text-orange-300"
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {["6 inch", "9 inch"].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setGermanSize(size)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                        germanSize === size
                          ? "bg-[#3E2723] text-white shadow-sm"
                          : "border border-orange-200/80 bg-white/80 text-orange-950 hover:bg-white"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-full bg-[#3E2723] px-2 py-0.5 text-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setGermanQty(Math.max(1, germanQty - 1))}
                      aria-label="Decrease quantity"
                      className="p-1 hover:text-amber-200 transition active:scale-90"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-2 text-xs font-bold">{germanQty}</span>
                    <button
                      type="button"
                      onClick={() => setGermanQty(germanQty + 1)}
                      aria-label="Increase quantity"
                      className="p-1 hover:text-amber-200 transition active:scale-90"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="inline-block rounded-full bg-[#5D2E17] px-4 py-1.5 text-xs sm:text-sm font-extrabold text-white shadow-sm">
                    $48.00
                  </span>
                </div>
              </div>

              <div
                onClick={() => onSelectProduct?.("ombre-ruffle")}
                className="cursor-pointer h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-2xl transition-transform duration-300 group-hover:scale-105"
              >
                <img
                  src="/images/ombre-ruffle-cake.jpg"
                  alt="Celebration Cake"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
