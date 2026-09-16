import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DiscoverView } from "@/components/delish/DiscoverView";
import { CartDrawer } from "@/components/delish/CartDrawer";
import { StorefrontProductModal } from "@/components/delish/StorefrontProductModal";
import { ContactSection } from "@/components/delish/ContactSection";
import { SiteFooter } from "@/components/delish/SiteFooter";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover | DELISH Bakes Luxury Patisserie" },
      { name: "description", content: "Explore freshly baked croissants, celebration cakes, and signature macarons." },
      { property: "og:title", content: "Discover | DELISH Bakes Luxury Patisserie" },
      { property: "og:description", content: "Explore freshly baked croissants, celebration cakes, and signature macarons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const navigate = useNavigate();
  const { count, add } = useCart();
  const content = useStorefrontContent();
  const [cartOpen, setCartOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  const quickProduct = content.data?.products.find((product) => product.id === quickViewId) ?? null;

  return (
    <main className="min-h-dvh w-full bg-background">
      <DiscoverView
        cartCount={count}
        onOpenCart={() => setCartOpen(true)}
        onQuickView={(id) => setQuickViewId(id)}
        onSelectProduct={(id) => {
          void navigate({ to: "/product-details", search: { id } });
        }}
      />

      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-4">
        <ContactSection />
        <SiteFooter />
      </div>

      <StorefrontProductModal
        product={quickProduct}
        onClose={() => setQuickViewId(null)}
        onMoreOptions={(id) => {
          setQuickViewId(null);
          void navigate({ to: "/product-details", search: { id } });
        }}
        onAdd={({ product, size, quantity, price, notes }) => {
          const details = size ? [size] : [];
          add({
            ar: product.name_ar,
            en: product.name_en,
            unit: price,
            qty: quantity,
            image: product.image_url ?? undefined,
            notes: notes.trim() || undefined,
            detailsAr: details,
            detailsEn: details,
            spec: { kind: "cms", productId: product.id, size },
          });
          setQuickViewId(null);
          setCartOpen(true);
        }}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </main>
  );
}
