import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { DiscoverView } from "@/components/delish/DiscoverView";
import { CartDrawer } from "@/components/delish/CartDrawer";
import { StorefrontMenuDrawer } from "@/components/delish/StorefrontMenuDrawer";
import { StorefrontProductModal } from "@/components/delish/StorefrontProductModal";
import { SiteFooter } from "@/components/delish/SiteFooter";
import { useCart } from "@/lib/cart";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import { customizationSummary } from "@/components/delish/CakeCustomizationPanel";

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
  const { add, count } = useCart();
  const content = useStorefrontContent();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId || !content.data?.products) return null;
    return content.data.products.find((p) => p.id === selectedProductId) ?? null;
  }, [content.data, selectedProductId]);

  return (
    <main className="min-h-dvh w-full bg-[#FDFBF7]">
      <DiscoverView
        cartCount={count}
        onOpenCart={() => setCartOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
        onSelectProduct={(id) => {
          setSelectedProductId(id);
        }}
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <SiteFooter />
      </div>

      <StorefrontProductModal
        product={selectedProduct}
        onClose={() => setSelectedProductId(null)}
        onAdd={(payload) => {
          const extras = customizationSummary(payload.customization);
          const notes = payload.customization.notes.trim() || payload.notes.trim();
          const details = [
            payload.size ? `الحجم: ${payload.size}` : "",
            payload.flavor ? `النكهة: ${payload.flavor}` : "",
            payload.filling ? `الحشوة: ${payload.filling}` : "",
            payload.inscription ? `الكتابة: ${payload.inscription}` : "",
          ].filter(Boolean);

          add({
            ar: payload.product.name_ar,
            en: payload.product.name_en,
            unit: payload.price,
            qty: payload.quantity,
            image: payload.product.image_url ?? undefined,
            designImage: payload.customization.designImageUrl ?? undefined,
            notes: notes || undefined,
            detailsAr: [...details, ...extras.ar],
            detailsEn: [...details, ...extras.en],
            extrasAr: extras.ar,
            extrasEn: extras.en,
            spec: { kind: "cms", productId: payload.product.id, size: payload.size ?? null },
          });
          setSelectedProductId(null);
          setCartOpen(true);
        }}
      />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <StorefrontMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </main>
  );
}
