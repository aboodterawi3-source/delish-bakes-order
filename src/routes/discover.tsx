import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DiscoverView } from "@/components/delish/DiscoverView";
import { CartDrawer } from "@/components/delish/CartDrawer";
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
  const { count } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <main className="min-h-dvh w-full bg-background">
      <DiscoverView
        cartCount={count}
        onOpenCart={() => setCartOpen(true)}
        onSelectProduct={(id) => {
          void navigate({ to: "/product-details", search: { id } });
        }}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </main>
  );
}
