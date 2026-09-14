import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ProductDetailsView } from "@/components/delish/ProductDetailsView";
import { CartDrawer } from "@/components/delish/CartDrawer";
import { useCart } from "@/lib/cart";
import { customizationSummary } from "@/components/delish/CakeCustomizationPanel";

export const Route = createFileRoute("/product-details")({
  head: () => ({
    meta: [
      { title: "Ombre Fondant Ruffle Cake | DELISH Bakes" },
      { name: "description", content: "Handcrafted ombre fondant ruffle wedding and celebration cake in shades of magenta, purple, and pastel blue." },
      { property: "og:title", content: "Ombre Fondant Ruffle Cake | DELISH Bakes" },
      { property: "og:description", content: "Handcrafted ombre fondant ruffle wedding and celebration cake in shades of magenta, purple, and pastel blue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductDetailsPage,
});

function ProductDetailsPage() {
  const navigate = useNavigate();
  const { add, count } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <main className="min-h-dvh w-full bg-[#F9FBFC]">
      <ProductDetailsView
        cartCount={count}
        onBack={() => {
          void navigate({ to: "/discover" });
        }}
        onOpenCart={() => setCartOpen(true)}
        onAddToCart={(item) => {
          const extras = customizationSummary(item.customization);
          const notes = item.customization.notes.trim();
          add({
            ar: "كيك أمبري فوندان رفل",
            en: item.name,
            unit: item.price,
            qty: item.quantity,
            image: "/images/ombre-ruffle-cake.jpg",
            designImage: item.customization.designImageUrl ?? undefined,
            notes: notes || undefined,
            detailsAr: [item.size, ...extras.ar],
            detailsEn: [item.size, ...extras.en],
            spec: { kind: "catalog", productId: "p1" },
          });
          setCartOpen(true);
        }}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </main>
  );
}
