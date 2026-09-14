import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ProductDetailsView } from "@/components/delish/ProductDetailsView";
import { CartDrawer } from "@/components/delish/CartDrawer";
import { useCart } from "@/lib/cart";
import { customizationSummary } from "@/components/delish/CakeCustomizationPanel";
import { useStorefrontContent } from "@/hooks/use-storefront-content";

export const Route = createFileRoute("/product-details")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search['id'] === "string" ? search['id'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Product Details | DELISH Bakes" },
      { name: "description", content: "Choose your size, add candles, balloons or an acrylic name, and order your cake from DELISH Bakes." },
      { property: "og:title", content: "Product Details | DELISH Bakes" },
      { property: "og:description", content: "Choose your size, add candles, balloons or an acrylic name, and order your cake from DELISH Bakes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductDetailsPage,
});

function ProductDetailsPage() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { add, count } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const content = useStorefrontContent();

  // With no id (e.g. the banner button) we fall back to the first popular cake.
  const product = useMemo(() => {
    const products = content.data?.products ?? [];
    if (id) return products.find((item) => item.id === id) ?? null;
    return products.find((item) => item.is_popular) ?? products[0] ?? null;
  }, [content.data, id]);

  return (
    <main className="min-h-dvh w-full bg-background">
      <ProductDetailsView
        product={product}
        isPending={content.isPending}
        cartCount={count}
        onBack={() => {
          void navigate({ to: "/discover" });
        }}
        onOpenCart={() => setCartOpen(true)}
        onAddToCart={(item) => {
          const extras = customizationSummary(item.customization);
          const notes = item.customization.notes.trim();
          const details = item.size ? [item.size] : [];
          add({
            ar: item.nameAr,
            en: item.nameEn,
            unit: item.price,
            qty: item.quantity,
            image: item.image ?? undefined,
            designImage: item.customization.designImageUrl ?? undefined,
            notes: notes || undefined,
            detailsAr: [...details, ...extras.ar],
            detailsEn: [...details, ...extras.en],
            extrasAr: extras.ar,
            extrasEn: extras.en,
            spec: { kind: "catalog", productId: item.productId },
          });
          setCartOpen(true);
        }}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </main>
  );
}
