import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ProductDetailsView } from "@/components/delish/ProductDetailsView";
import { CartDrawer } from "@/components/delish/CartDrawer";
import { CartProvider, useCart } from "@/lib/cart";

export const Route = createFileRoute("/product-details")({
  head: () => ({
    meta: [
      { title: "Ombre Fondant Ruffle Cake | DELISH Bakes" },
      { name: "description", content: "Handcrafted ombre fondant ruffle wedding and celebration cake in shades of magenta, purple, and pastel blue." },
    ],
  }),
  component: ProductDetailsPageWrapper,
});

function ProductDetailsPageWrapper() {
  return (
    <CartProvider>
      <ProductDetailsPage />
    </CartProvider>
  );
}

function ProductDetailsPage() {
  const navigate = useNavigate();
  const { addItem, totalItems } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <main className="min-h-dvh w-full bg-[#F9FBFC]">
      <ProductDetailsView
        cartCount={totalItems || 1}
        onBack={() => {
          void navigate({ to: "/discover" });
        }}
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
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </main>
  );
}
