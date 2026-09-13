import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Smartphone, Layers, ArrowRight, Sparkles, ChefHat, BadgeDollarSign, Shield, Share2 } from "lucide-react";
import { LangProvider } from "@/lib/i18n";
import { CartProvider, useCart } from "@/lib/cart";
import { WelcomeView } from "@/components/delish/WelcomeView";
import { DiscoverView } from "@/components/delish/DiscoverView";
import { ProductDetailsView } from "@/components/delish/ProductDetailsView";
import { CartDrawer } from "@/components/delish/CartDrawer";
import { BackgroundCurves } from "@/components/delish/BackgroundCurves";

const TITLE = "DELISH Bakes | Luxury Patisserie & Celebration Cakes";
const DESCRIPTION = "Closer to love with every bite. Handcrafted luxury celebration cakes, artisan pastries, and signature macarons in Amman, Jordan.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "keywords", content: "Delish Jordan, custom cakes Amman, pastries Amman, luxury bakery Jordan, macarons" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Page,
});

function Page() {
  return (
    <LangProvider>
      <CartProvider>
        <StorefrontShowcase />
      </CartProvider>
    </LangProvider>
  );
}

function StorefrontShowcase() {
  const navigate = useNavigate();
  const { addItem, totalItems } = useCart();
  const [activeTab, setActiveTab] = useState<"welcome" | "discover" | "product">("welcome");
  const [showcaseMode, setShowcaseMode] = useState<"showcase" | "single">("showcase");
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="relative min-h-dvh w-full bg-[#F9FBFC] text-[#3E2723] overflow-x-hidden">
      <BackgroundCurves />

      {/* Top Architecture Navigation Bar */}
      <nav aria-label="Quick Access Bar" className="relative z-30 border-b border-[#F1F5F9] bg-[#F9FBFC]/90 backdrop-blur-md px-4 py-2.5 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Brand Wordmark & Mode Switcher */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-serif text-lg font-bold tracking-widest text-[#B8860B] uppercase">DELISH</span>
              <span className="font-script text-xl italic text-[#8B4513] -mt-1">Bakes</span>
            </Link>

            {/* View Mode Toggle (Desktop only) */}
            <div className="hidden lg:flex items-center rounded-full bg-slate-100/90 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowcaseMode("showcase")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
                  showcaseMode === "showcase" ? "bg-white text-[#5D2E17] shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-[#B8860B]" />
                <span>Reference Showcase (3 Devices)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowcaseMode("single")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
                  showcaseMode === "single" ? "bg-white text-[#5D2E17] shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5 text-[#B8860B]" />
                <span>Single Device</span>
              </button>
            </div>
          </div>

          {/* Quick Route Links to Dashboards and Screens */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Link
              to="/welcome"
              className="rounded-full px-2.5 py-1 font-semibold text-[#8B4513] hover:bg-[#FDE2CF]/50 transition"
            >
              /welcome
            </Link>
            <Link
              to="/discover"
              className="rounded-full px-2.5 py-1 font-semibold text-[#8B4513] hover:bg-[#FDE2CF]/50 transition"
            >
              /discover
            </Link>
            <Link
              to="/product-details"
              className="rounded-full px-2.5 py-1 font-semibold text-[#8B4513] hover:bg-[#FDE2CF]/50 transition"
            >
              /product-details
            </Link>

            <span className="h-4 w-px bg-slate-200 mx-1 hidden sm:inline" />

            <Link
              to="/kds"
              className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-white px-2.5 py-1 font-bold text-[#8B4513] hover:bg-amber-50 shadow-xs transition"
            >
              <ChefHat className="h-3 w-3 text-[#B8860B]" />
              KDS
            </Link>
            <Link
              to="/sales"
              className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-white px-2.5 py-1 font-bold text-[#8B4513] hover:bg-amber-50 shadow-xs transition"
            >
              <BadgeDollarSign className="h-3 w-3 text-[#B8860B]" />
              Sales
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-white px-2.5 py-1 font-bold text-[#8B4513] hover:bg-amber-50 shadow-xs transition"
            >
              <Shield className="h-3 w-3 text-[#B8860B]" />
              Admin
            </Link>
            <Link
              to="/social-portal"
              className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-white px-2.5 py-1 font-bold text-[#8B4513] hover:bg-amber-50 shadow-xs transition"
            >
              <Share2 className="h-3 w-3 text-[#B8860B]" />
              Social
            </Link>
          </div>
        </div>
      </nav>

      {/* Showcase Mode: 3 Mobile Phone Devices Side-by-Side (Pixel-Perfect to Reference Photo!) */}
      {showcaseMode === "showcase" ? (
        <main className="relative z-10 px-4 py-8 lg:py-12">
          {/* Headline banner */}
          <div className="mx-auto max-w-4xl text-center mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDE2CF]/70 px-3.5 py-1 text-xs font-bold text-[#7B3F00] shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-[#B8860B]" />
              Pixel-Perfect Luxury Experience
            </span>
            <h1 className="mt-3 font-sans text-2xl sm:text-4xl font-extrabold tracking-tight text-[#3E2723]">
              Delish Jordan Patisserie &amp; Celebration Cakes
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-[#7A6458]">
              Interactive multi-screen customer journey: Welcome Landing, Discover Catalog, and Ombre Cake Product Details.
            </p>

            {/* Mobile Tab Pill Switcher (Visible on smaller viewports) */}
            <div className="mt-5 flex lg:hidden justify-center">
              <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs font-bold shadow-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("welcome")}
                  className={`rounded-full px-4 py-1.5 transition ${
                    activeTab === "welcome" ? "bg-[#8B4513] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  1. Welcome
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("discover")}
                  className={`rounded-full px-4 py-1.5 transition ${
                    activeTab === "discover" ? "bg-[#8B4513] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  2. Discover
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("product")}
                  className={`rounded-full px-4 py-1.5 transition ${
                    activeTab === "product" ? "bg-[#8B4513] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  3. Details
                </button>
              </div>
            </div>
          </div>

          {/* Desktop: 3 Phones Side-by-Side Grid matching reference mockup */}
          <div className="mx-auto hidden lg:grid max-w-7xl grid-cols-3 gap-6 xl:gap-8 items-start justify-center">
            {/* Phone 1: Welcome Screen */}
            <div className="flex flex-col items-center">
              <div className="mb-3 flex items-center justify-between w-full px-4 text-xs font-bold text-[#8B4513]">
                <span>01. WELCOME SCREEN</span>
                <Link to="/welcome" className="hover:underline flex items-center gap-1">Open Full <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="w-full max-w-[375px] h-[780px] rounded-[48px] bg-black p-3.5 shadow-[0_25px_60px_-15px_rgba(62,39,35,0.3)] ring-1 ring-slate-800">
                {/* iPhone Frame Speaker & Dynamic Island */}
                <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-[#F9FBFC]">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 h-4 w-28 rounded-full bg-black" />
                  <WelcomeView
                    onExplore={() => setActiveTab("discover")}
                    isEmbedded
                  />
                </div>
              </div>
            </div>

            {/* Phone 2: Discover Screen */}
            <div className="flex flex-col items-center">
              <div className="mb-3 flex items-center justify-between w-full px-4 text-xs font-bold text-[#8B4513]">
                <span>02. DISCOVER / CATALOG</span>
                <Link to="/discover" className="hover:underline flex items-center gap-1">Open Full <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="w-full max-w-[375px] h-[780px] rounded-[48px] bg-black p-3.5 shadow-[0_25px_60px_-15px_rgba(62,39,35,0.3)] ring-1 ring-slate-800">
                <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-[#F9FBFC]">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 h-4 w-28 rounded-full bg-black" />
                  <DiscoverView
                    cartCount={totalItems || 2}
                    onOpenCart={() => setCartOpen(true)}
                    onSelectProduct={() => setActiveTab("product")}
                    isEmbedded
                  />
                </div>
              </div>
            </div>

            {/* Phone 3: Product Details Screen */}
            <div className="flex flex-col items-center">
              <div className="mb-3 flex items-center justify-between w-full px-4 text-xs font-bold text-[#8B4513]">
                <span>03. PRODUCT DETAILS</span>
                <Link to="/product-details" className="hover:underline flex items-center gap-1">Open Full <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="w-full max-w-[375px] h-[780px] rounded-[48px] bg-black p-3.5 shadow-[0_25px_60px_-15px_rgba(62,39,35,0.3)] ring-1 ring-slate-800">
                <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-[#F9FBFC]">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 h-4 w-28 rounded-full bg-black" />
                  <ProductDetailsView
                    cartCount={totalItems || 1}
                    onBack={() => setActiveTab("discover")}
                    onOpenCart={() => setCartOpen(true)}
                    onAddToCart={(item) => {
                      addItem({
                        productId: "prod-ombre-ruffle",
                        nameAr: "كيك أمبري فوندان رفل",
                        nameEn: item.name,
                        unitPrice: item.price,
                        quantity: item.quantity,
                        optionsAr: [item.size],
                        optionsEn: [item.size],
                      });
                      setCartOpen(true);
                    }}
                    isEmbedded
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Single Phone Display with active tab */}
          <div className="lg:hidden mx-auto flex justify-center">
            <div className="w-full max-w-[380px] rounded-[44px] bg-black p-3 shadow-2xl ring-1 ring-slate-800">
              <div className="relative overflow-hidden rounded-[32px] bg-[#F9FBFC] min-h-[680px]">
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 h-4 w-24 rounded-full bg-black" />
                {activeTab === "welcome" && (
                  <WelcomeView onExplore={() => setActiveTab("discover")} isEmbedded />
                )}
                {activeTab === "discover" && (
                  <DiscoverView
                    cartCount={totalItems || 2}
                    onOpenCart={() => setCartOpen(true)}
                    onSelectProduct={() => setActiveTab("product")}
                    isEmbedded
                  />
                )}
                {activeTab === "product" && (
                  <ProductDetailsView
                    cartCount={totalItems || 1}
                    onBack={() => setActiveTab("discover")}
                    onOpenCart={() => setCartOpen(true)}
                    onAddToCart={(item) => {
                      addItem({
                        productId: "prod-ombre-ruffle",
                        nameAr: "كيك أمبري فوندان رفل",
                        nameEn: item.name,
                        unitPrice: item.price,
                        quantity: item.quantity,
                        optionsAr: [item.size],
                        optionsEn: [item.size],
                      });
                      setCartOpen(true);
                    }}
                    isEmbedded
                  />
                )}
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* Single View Mode */
        <main className="relative z-10 mx-auto max-w-md min-h-[calc(100dvh-60px)] shadow-lg bg-[#F9FBFC]">
          {activeTab === "welcome" && (
            <WelcomeView onExplore={() => setActiveTab("discover")} />
          )}
          {activeTab === "discover" && (
            <DiscoverView
              cartCount={totalItems || 2}
              onOpenCart={() => setCartOpen(true)}
              onSelectProduct={() => setActiveTab("product")}
            />
          )}
          {activeTab === "product" && (
            <ProductDetailsView
              cartCount={totalItems || 1}
              onBack={() => setActiveTab("discover")}
              onOpenCart={() => setCartOpen(true)}
              onAddToCart={(item) => {
                addItem({
                  productId: "prod-ombre-ruffle",
                  nameAr: "كيك أمبري فوندان رفل",
                  nameEn: item.name,
                  unitPrice: item.price,
                  quantity: item.quantity,
                  optionsAr: [item.size],
                  optionsEn: [item.size],
                });
                setCartOpen(true);
              }}
            />
          )}
        </main>
      )}

      {/* Cart Drawer */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
