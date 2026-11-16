import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { DiscoverView } from "@/components/delish/DiscoverView";
import { SiteFooter } from "@/components/delish/SiteFooter";
import { useCart, buildCmsCartLine } from "@/lib/cart";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { customizationSummary } from "@/components/delish/CakeCustomizationPanel";
import type { ModalAddPayload } from "@/components/delish/StorefrontProductModal";

// Lazy-loaded heavy interactive modals and drawers for faster initial page load & 60 FPS scroll
const CartDrawer = lazy(() =>
  import("@/components/delish/CartDrawer").then((m) => ({ default: m.CartDrawer })),
);
const StorefrontMenuDrawer = lazy(() =>
  import("@/components/delish/StorefrontMenuDrawer").then((m) => ({
    default: m.StorefrontMenuDrawer,
  })),
);
const StorefrontProductModal = lazy(() =>
  import("@/components/delish/StorefrontProductModal").then((m) => ({
    default: m.StorefrontProductModal,
  })),
);

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover | DELISH Bakes Luxury Patisserie" },
      {
        name: "description",
        content: "Explore freshly baked croissants, celebration cakes, and signature macarons.",
      },
      { property: "og:title", content: "Discover | DELISH Bakes Luxury Patisserie" },
      {
        property: "og:description",
        content: "Explore freshly baked croissants, celebration cakes, and signature macarons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { add, count } = useCart();
  const content = useStorefrontContent();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const handleOpenCart = useCallback(() => setCartOpen(true), []);
  const handleCloseCart = useCallback(() => setCartOpen(false), []);
  const handleOpenMenu = useCallback(() => setMenuOpen(true), []);
  const handleCloseMenu = useCallback(() => setMenuOpen(false), []);
  const handleSelectProduct = useCallback((id: string) => setSelectedProductId(id), []);
  const handleCloseProductModal = useCallback(() => setSelectedProductId(null), []);

  const handleAddProduct = useCallback(
    (payload: ModalAddPayload) => {
      const extras = customizationSummary(payload.customization);
      const notes = payload.customization.notes.trim();
      add(
        buildCmsCartLine({
          productId: payload.product.id,
          nameAr: payload.product.name_ar,
          nameEn: payload.product.name_en,
          unitPrice: payload.price,
          quantity: payload.quantity,
          size: payload.size,
          image: payload.product.image_url,
          designImage: payload.customization.designImageUrl,
          notes,
          extrasAr: extras.ar,
          extrasEn: extras.en,
          flavor: payload.flavor,
          filling: payload.filling,
          customizationFilling: payload.customization.filling,
          inscription: payload.inscription,
          prefixSizeLabel: true,
        }),
      );
      setSelectedProductId(null);
      setCartOpen(true);
    },
    [add],
  );

  const selectedProduct = useMemo(() => {
    if (!selectedProductId || !content.data?.products) return null;
    return content.data.products.find((p) => p.id === selectedProductId) ?? null;
  }, [content.data, selectedProductId]);

  return (
    <main className="min-h-dvh w-full bg-[#FDFBF7]">
      <DiscoverView
        cartCount={count}
        onOpenCart={handleOpenCart}
        onOpenMenu={handleOpenMenu}
        onSelectProduct={handleSelectProduct}
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <SiteFooter />
      </div>

      <Suspense fallback={null}>
        {selectedProduct && (
          <StorefrontProductModal
            product={selectedProduct}
            onClose={handleCloseProductModal}
            onAdd={handleAddProduct}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {cartOpen && <CartDrawer open={cartOpen} onClose={handleCloseCart} />}
      </Suspense>

      <Suspense fallback={null}>
        {menuOpen && <StorefrontMenuDrawer open={menuOpen} onClose={handleCloseMenu} />}
      </Suspense>
    </main>
  );
}
