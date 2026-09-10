import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Circle, Diamond, ShoppingBag } from "lucide-react";
import { LangProvider, useLang } from "@/lib/i18n";
import { CartProvider, useCart } from "@/lib/cart";
import { OrderingDialogs } from "@/components/delish/OrderingDialogs";
import { CartDrawer } from "@/components/delish/CartDrawer";

const TITLE = "Delish Cake & Bake | Luxury Cakes in Amman";
const DESCRIPTION = "Order custom cakes and signature pastries from Delish Cake & Bake in Amman, Jordan.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "keywords", content: "Delish Jordan, custom cakes Amman, pastries Amman, bakery Jordan" },
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
        <ReferenceStorefront />
      </CartProvider>
    </LangProvider>
  );
}

function ReferenceStorefront() {
  const { lang, setLang, dir, t } = useLang();
  const { count } = useCart();
  const [dialog, setDialog] = useState<"cake" | "shop" | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <main className="min-h-dvh bg-background p-0 sm:grid sm:place-items-center sm:p-5 lg:p-8">
      <section aria-label="Delish bakery" className="grid min-h-dvh w-full overflow-hidden bg-card shadow-[var(--shadow-soft)] sm:min-h-0 sm:max-w-[1180px] sm:rounded-[30px] md:grid-cols-2">
        <div className="reference-hero relative flex min-h-[48dvh] items-center justify-center overflow-hidden px-8 py-14 sm:min-h-[520px] md:min-h-[680px]">
          <div aria-hidden="true" className="absolute -bottom-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-card/30 blur-3xl" />
          <div className="relative flex max-w-sm flex-col items-center text-center">
            <div className="grid h-36 w-36 place-items-center rounded-full border-[10px] border-card bg-card shadow-sm sm:h-44 sm:w-44">
              <div className="grid h-[calc(100%-8px)] w-[calc(100%-8px)] place-items-center rounded-full border border-dashed border-primary/55">
                <span className="delish-wordmark font-display text-3xl font-bold sm:text-4xl">Delish</span>
              </div>
            </div>
            <h2 className="mt-8 font-display text-2xl font-bold italic text-primary sm:mt-10 sm:text-3xl">Baked with Love</h2>
            <p className="mt-4 max-w-[290px] text-sm leading-7 text-primary">
              Discover our signature powder-blue macarons and cloud-like pastries made fresh every morning.
            </p>
          </div>
        </div>

        <div className="flex min-h-[52dvh] flex-col bg-card px-7 py-10 sm:px-12 sm:py-14 md:min-h-[680px] lg:px-16">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-primary">EST. 2024</p>
              <h1 className="delish-wordmark mt-2 font-display text-4xl font-bold sm:text-5xl">Delish</h1>
            </div>
            <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="min-h-12 shrink-0 text-xs font-bold text-primary" aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}>
              {lang === "ar" ? "EN" : "عربي"}
            </button>
          </div>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Our bakery brings a modern twist to classic flavors.<br className="hidden sm:block" /> Experience the lightness of our signature collections.
          </p>

          <div className="mt-9 space-y-4">
            <CategoryRow icon="circle" title="Morning Pastries" subtitle="Flaky, buttery, and light" action="Browse" onClick={() => setDialog("shop")} />
            <CategoryRow icon="diamond" title="Custom Cakes" subtitle="For your special moments" action="Order" onClick={() => setDialog("cake")} />
          </div>

          <div className="mt-8 border-t border-border pt-8">
            <button type="button" onClick={() => setDialog("cake")} className="min-h-14 w-full rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5">
              Visit Our Shop
            </button>
            <button type="button" onClick={() => setCartOpen(true)} className="mx-auto mt-3 flex min-h-12 items-center gap-2 text-xs font-semibold text-muted-foreground" aria-label={`${t("cart")} ${count}`}>
              <ShoppingBag className="h-4 w-4" aria-hidden="true" /> {t("cart")}{count > 0 ? ` · ${count}` : ""}
            </button>
          </div>

          <div className="mt-auto pt-5 text-center">
            <p className="text-xs text-muted-foreground">Open Daily: 7am — 6pm</p>
            <nav className="mt-3 flex justify-center gap-5 text-[11px] text-muted-foreground" aria-label="Staff tools">
              <Link to="/admin" className="underline">Admin</Link>
              <Link to="/kds" className="underline">Kitchen</Link>
            </nav>
          </div>
        </div>
      </section>

      <div dir={dir}>
        <OrderingDialogs kind={dialog} onClose={() => setDialog(null)} onCart={() => setCartOpen(true)} />
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      </div>
    </main>
  );
}

function CategoryRow({ icon, title, subtitle, action, onClick }: { icon: "circle" | "diamond"; title: string; subtitle: string; action: string; onClick: () => void }) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-secondary">
        {icon === "circle" ? <Circle className="h-6 w-6 fill-card text-border" aria-hidden="true" /> : <Diamond className="h-6 w-6 fill-card text-border" aria-hidden="true" />}
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold text-foreground">{title}</h2>
        <p className="truncate text-xs italic text-muted-foreground">{subtitle}</p>
      </div>
      <button type="button" onClick={onClick} className="min-h-12 shrink-0 text-xs font-bold text-primary">{action}</button>
    </div>
  );
}
