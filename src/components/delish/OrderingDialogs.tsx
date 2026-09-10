import { useId, useState } from "react";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { CakeBuilder } from "./CakeBuilder";
import { Pic } from "./Pic";
import { imageSets } from "@/lib/images";
import { products, type Product } from "@/lib/menu";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { useDismissable } from "@/lib/a11y";

type DialogKind = "cake" | "shop" | null;

export function OrderingDialogs({ kind, onClose, onCart }: { kind: DialogKind; onClose: () => void; onCart: () => void }) {
  const { lang } = useLang();
  const titleId = useId();
  useDismissable(Boolean(kind), onClose);
  if (!kind) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 sm:items-center sm:p-5">
      <button type="button" tabIndex={-1} aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-card shadow-[var(--shadow-soft)] sm:rounded-3xl">
        <header className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border bg-card px-5 py-3">
          <h2 id={titleId} className="truncate font-display text-xl font-bold">
            {kind === "cake" ? (lang === "ar" ? "صمّم كيكتك" : "Design your cake") : lang === "ar" ? "قائمة ديليش" : "Delish menu"}
          </h2>
          <button type="button" onClick={onClose} aria-label={lang === "ar" ? "إغلاق" : "Close"} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-border">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="p-5 sm:p-7">
          {kind === "cake" ? <CakeBuilder onDone={() => { onClose(); onCart(); }} /> : <QuickShop onCart={onCart} />}
        </div>
      </section>
    </div>
  );
}

function QuickShop({ onCart }: { onCart: () => void }) {
  const { lang, t } = useLang();
  const { add } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const addProduct = (product: Product) => {
    const qty = quantities[product.id] ?? 1;
    add({ ar: product.ar, en: product.en, unit: product.price, qty, image: imageSets[product.image]?.src, detailsAr: [], detailsEn: [] });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const qty = quantities[product.id] ?? 1;
        const imageSet = imageSets[product.image];
        if (!imageSet) return null;
        return (
          <article key={product.id} className="overflow-hidden rounded-2xl border border-border bg-background">
            <Pic set={imageSet} alt={lang === "ar" ? product.ar : product.en} sizes="(min-width: 1024px) 300px, 50vw" className="aspect-4/3 w-full object-cover" />
            <div className="p-4">
              <h3 className="font-display font-bold">{lang === "ar" ? product.ar : product.en}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{lang === "ar" ? product.descAr : product.descEn}</p>
              <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <div className="flex items-center rounded-full border border-border">
                  <button type="button" onClick={() => setQuantities((q) => ({ ...q, [product.id]: Math.max(1, qty - 1) }))} aria-label="Decrease" className="grid h-12 w-10 place-items-center"><Minus className="h-4 w-4" /></button>
                  <span className="w-6 text-center text-sm font-bold">{qty}</span>
                  <button type="button" onClick={() => setQuantities((q) => ({ ...q, [product.id]: qty + 1 }))} aria-label="Increase" className="grid h-12 w-10 place-items-center"><Plus className="h-4 w-4" /></button>
                </div>
                <button type="button" onClick={() => addProduct(product)} className="min-h-12 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground">
                  {product.price.toFixed(2)} {t("jod")} · {t("addToCart")}
                </button>
              </div>
            </div>
          </article>
        );
      })}
      <button type="button" onClick={onCart} className="sm:col-span-2 lg:col-span-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-primary font-bold text-primary">
        <ShoppingBag className="h-4 w-4" /> {t("cart")}
      </button>
    </div>
  );
}