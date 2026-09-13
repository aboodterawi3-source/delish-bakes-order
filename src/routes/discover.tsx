import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DiscoverView } from "@/components/delish/DiscoverView";
import { CartDrawer } from "@/components/delish/CartDrawer";
import { CartProvider, useCart } from "@/lib/cart";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover | DELISH Bakes Luxury Patisserie" },
      { name: "description", content: "Explore freshly baked croissants, celebration cakes, and signature macarons." },
    ],
  }),
  component: DiscoverPageWrapper,
});

function DiscoverPageWrapper() {
  return (
    <CartProvider>
      <DiscoverPage />
    </CartProvider>
  );
}

function DiscoverPage() {
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <main className="min-h-dvh w-full bg-[#F9FBFC]">
      <DiscoverView
        cartCount={totalItems || 2}
        onOpenCart={() => setCartOpen(true)}
        onSelectProduct={(_id) => {
          void navigate({ to: "/product-details" });
        }}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </main>
  );
}
