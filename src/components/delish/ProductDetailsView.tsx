import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ShoppingBag, ChevronDown, Plus, Minus, Check } from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";

interface ProductDetailsViewProps {
  onBack?: () => void;
  onOpenCart?: () => void;
  onAddToCart?: (item: { name: string; size: string; quantity: number; price: number }) => void;
  cartCount?: number;
  isEmbedded?: boolean;
}

export function ProductDetailsView({
  onBack,
  onOpenCart,
  onAddToCart,
  cartCount = 2,
  isEmbedded = false,
}: ProductDetailsViewProps) {
  const navigate = useNavigate();
  const [selectedThumb, setSelectedThumb] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState("8 inch Celebration");
  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [addedAnimation, setAddedAnimation] = useState(false);

  const thumbnails = [
    { id: 0, src: "/images/ombre-ruffle-cake.jpg", alt: "Ombre Fondant Ruffle Cake" },
    { id: 1, src: "/images/ube-drip-cake.jpg", alt: "Ube Drip Cake" },
    { id: 2, src: "/images/croissants.jpg", alt: "Fresh Croissants" },
    { id: 3, src: "/images/macaron-stack.jpg", alt: "Macaron Tower" },
  ];

  const sizePricing: Record<string, number> = {
    "6 inch Petite (Serves 6-8)": 95.0,
    "8 inch Celebration": 130.51,
    "10 inch Grand (Serves 20-25)": 185.0,
    "4-Tier Wedding Masterpiece": 290.0,
  };

  const currentPrice = (sizePricing[size] || 130.51) * quantity;

  const handleAdd = () => {
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
    onAddToCart?.({
      name: "Ombre Fondant Ruffle Cake",
      size,
      quantity,
      price: sizePricing[size] || 130.51,
    });
  };

  return (
    <div
      className={`relative flex min-h-dvh w-full flex-col justify-between overflow-y-auto bg-[#F9FBFC] text-[#3E2723] ${
        isEmbedded ? "min-h-[740px] max-h-[820px] rounded-[38px] shadow-2xl border-4 border-[#2A2421]" : ""
      }`}
    >
      <BackgroundCurves />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-3.5 bg-[#F9FBFC]/80 backdrop-blur-md border-b border-[#F1F5F9]/80">
        {/* Left Back Arrow Button */}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-[#5D2E17] shadow-sm transition hover:bg-[#FDE2CF]/40 active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <Link
            to="/discover"
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-[#5D2E17] shadow-sm transition hover:bg-[#FDE2CF]/40 active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        )}

        {/* Center DELISH Bakes + CELEBRATION CAKES */}
        <div className="flex flex-col items-center">
          <DelishLogo size="sm" />
          <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#B8860B] -mt-0.5">
            Celebration Cakes
          </span>
        </div>

        {/* Right Shopping Bag */}
        <button
          type="button"
          onClick={onOpenCart}
          aria-label="Cart"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-[#5D2E17] shadow-sm transition hover:bg-[#FDE2CF]/40 active:scale-95"
        >
          <ShoppingBag className="h-4 w-4" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#8B4513] text-[9px] font-bold text-white shadow">
              {cartCount}
            </span>
          )}
        </button>
      </header>

      {/* Main Product Showcase Block */}
      <main className="relative z-10 flex-1 px-5 pt-3 pb-24 space-y-4">
        {/* Gallery View: Vertical Thumbnails on Left + Large Centered Ruffle Cake */}
        <div className="relative flex items-center justify-center min-h-[290px] sm:min-h-[340px]">
          {/* Vertical thumbnail gallery on the left */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2.5">
            {thumbnails.map((thumb) => {
              const active = selectedThumb === thumb.id;
              return (
                <button
                  key={thumb.id}
                  type="button"
                  onClick={() => setSelectedThumb(thumb.id)}
                  className={`h-11 w-11 overflow-hidden rounded-xl bg-white p-0.5 shadow-sm transition-all duration-200 ${
                    active
                      ? "ring-2 ring-[#8B4513] scale-110 shadow-md"
                      : "opacity-70 hover:opacity-100 hover:scale-105"
                  }`}
                >
                  <img
                    src={thumb.src}
                    alt={thumb.alt}
                    className="h-full w-full object-cover rounded-lg"
                  />
                </button>
              );
            })}
          </div>

          {/* Main Large Centered Image */}
          <div className="h-72 w-56 sm:h-80 sm:w-64 flex items-center justify-center drop-shadow-[0_18px_30px_rgba(62,39,35,0.18)]">
            <img
              src={thumbnails[selectedThumb].src}
              alt="Ombre Fondant Ruffle Cake in blue and purple ruffles"
              className="max-h-full max-w-full object-contain transition-all duration-500 animate-fadeIn"
            />
          </div>
        </div>

        {/* Product Details Block */}
        <div className="space-y-4 pt-1">
          {/* Title and Quantity Counter in Dark Brown */}
          <div className="flex items-start justify-between gap-2">
            <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[#3E2723] leading-tight">
              Ombre Fondant <br />
              Ruffle{" "}
              <span className="font-script text-4xl sm:text-5xl font-normal italic text-[#8B4513]">
                Cake
              </span>
            </h1>

            {/* Quantity toggle [- 1 +] in dark brown pill */}
            <div className="inline-flex items-center rounded-full bg-[#8B4513] px-2.5 py-1 text-white shadow-sm mt-1 shrink-0">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label="Decrease quantity"
                className="p-1 hover:text-amber-200 transition active:scale-90"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-xs font-bold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Increase quantity"
                className="p-1 hover:text-amber-200 transition active:scale-90"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Expandable Description */}
          <div className="rounded-2xl border border-slate-100 bg-white/70 p-3.5 shadow-sm">
            <button
              type="button"
              onClick={() => setDescriptionOpen(!descriptionOpen)}
              className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-[#7B3F00]"
            >
              <span>Description</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  descriptionOpen ? "rotate-180 text-[#8B4513]" : "text-slate-400"
                }`}
              />
            </button>
            {descriptionOpen && (
              <p className="mt-2 text-xs leading-relaxed text-[#5A4A42]">
                Jemma and Calum had chosen shades of magenta and blue for their wedding décor.
                Each delicate fondant tier is hand-ruffled in an exquisite ombre cascade from deep royal indigo to sky pastel blue.
              </p>
            )}
          </div>

          {/* Size Selector */}
          <div className="space-y-1.5">
            <label htmlFor="cake-size-select" className="text-xs font-bold text-[#5D2E17]">
              Size
            </label>
            <div className="relative">
              <select
                id="cake-size-select"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-xs sm:text-sm font-semibold text-[#3E2723] shadow-sm focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#B8860B]/20"
              >
                {Object.keys(sizePricing).map((s) => (
                  <option key={s} value={s}>
                    {s} — ${sizePricing[s].toFixed(2)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B4513]" />
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <footer className="sticky bottom-0 z-20 flex items-center justify-between border-t border-[#F1F5F9] bg-[#F9FBFC]/95 px-6 py-4 backdrop-blur-md">
        {/* Price tag on left */}
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-[#8B4513] uppercase tracking-wider">
            From
          </span>
          <span className="font-sans text-2xl sm:text-3xl font-extrabold text-[#3E2723]">
            ${currentPrice.toFixed(2)}
          </span>
        </div>

        {/* Dark brown pill button "ADD TO CART" */}
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#8B4513] px-7 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-[0_8px_20px_-4px_rgba(139,69,19,0.4)] transition-all hover:bg-[#5D2E17] hover:shadow-[0_10px_24px_-4px_rgba(93,46,23,0.5)] active:scale-[0.98]"
        >
          {addedAnimation ? (
            <>
              <Check className="h-4 w-4 text-amber-200" />
              <span>ADDED!</span>
            </>
          ) : (
            <span>ADD TO CART</span>
          )}
        </button>
      </footer>
    </div>
  );
}
