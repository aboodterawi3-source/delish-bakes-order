import { useEffect, useId, useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { Option, Product } from "@/lib/menu";
import { imageSets } from "@/lib/images";
import { Pic } from "@/components/delish/Pic";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { useDismissable } from "@/lib/a11y";
import {
  CakeCustomizationPanel,
  customizationSummary,
  emptyCustomization,
  type Customization,
} from "./CakeCustomizationPanel";


export function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t, lang } = useLang();
  const { add } = useCart();
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [flavorId, setFlavorId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [customization, setCustomization] = useState<Customization>(emptyCustomization);
  const titleId = useId();
  const notesId = useId();

  useDismissable(Boolean(product), onClose);


  useEffect(() => {
    if (product) {
      setSizeId(product.sizes?.[0]?.id ?? null);
      setFlavorId(product.flavors?.[0]?.id ?? null);
      setQty(1);
      setNotes("");
      setCustomization(emptyCustomization);
    }
  }, [product]);

  const size = product?.sizes?.find((s) => s.id === sizeId) ?? null;
  const flavor = product?.flavors?.find((f) => f.id === flavorId) ?? null;

  const unit = useMemo(
    () => (product ? product.price + (size?.price ?? 0) + (flavor?.price ?? 0) : 0),
    [product, size, flavor],
  );

  if (!product) return null;

  const label = (o: Option) => (lang === "ar" ? o.ar : o.en);

  const submit = () => {
    const extras = customizationSummary(customization);
    const extraNote = customization.notes.trim();
    const allNotes = [notes.trim(), extraNote].filter(Boolean).join(" — ");
    add({
      ar: product.ar,
      en: product.en,
      unit,
      qty,
      spec: {
        kind: "catalog",
        productId: product.id,
        sizeId: size?.id,
        flavorId: flavor?.id,
      },
      image: imageSets[product.image]!.src,
      designImage: customization.designImageUrl ?? undefined,
      detailsAr: [
        size ? `${t_ar("size")}: ${size.ar}` : "",
        flavor ? `${t_ar("flavor")}: ${flavor.ar}` : "",
        ...extras.ar,
      ].filter(Boolean),
      detailsEn: [
        size ? `Size: ${size.en}` : "",
        flavor ? `Flavor: ${flavor.en}` : "",
        ...extras.en,
      ].filter(Boolean),
      extrasAr: extras.ar,
      extrasEn: extras.en,
      notes: allNotes || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/75 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label={lang === "ar" ? "إغلاق النافذة" : "Close dialog"}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-[var(--shadow-soft)] sm:rounded-3xl"
      >
        <div className="relative">
          <Pic
            set={imageSets[product.image]!}
            alt={lang === "ar" ? product.ar : product.en}
            sizes="(min-width: 640px) 512px, 100vw"
            className="h-48 w-full object-cover sm:h-56"
          />
          <button
            onClick={onClose}
            aria-label={lang === "ar" ? "إغلاق" : "Close"}
            className="absolute top-3 end-3 grid h-12 w-12 place-items-center rounded-full bg-background/95 text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>


        <div className="space-y-5 p-5">
          <div>
            <h2 id={titleId} className="font-display text-xl font-semibold">
              {lang === "ar" ? product.ar : product.en}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{lang === "ar" ? product.descAr : product.descEn}</p>
          </div>

          {product.sizes && (
            <Group title={t("size")}>
              {product.sizes.map((s) => (
                <Chip key={s.id} active={s.id === sizeId} onClick={() => setSizeId(s.id)}>
                  {label(s)}
                  {s.price > 0 && <span className="ms-1 text-gold-deep">+{s.price}</span>}
                </Chip>
              ))}
            </Group>
          )}

          {product.flavors && (
            <Group title={t("flavor")}>
              {product.flavors.map((f) => (
                <Chip key={f.id} active={f.id === flavorId} onClick={() => setFlavorId(f.id)}>
                  {label(f)}
                  {f.price > 0 && <span className="ms-1 text-gold-deep">+{f.price}</span>}
                </Chip>
              ))}
            </Group>
          )}

          <div>
            <label htmlFor={notesId} className="mb-2 block text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {t("notes")}
            </label>
            <textarea
              id={notesId}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPh")}
              rows={2}
              className="w-full rounded-2xl border border-input bg-background p-3 text-sm outline-none focus:border-gold"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full border border-border px-1">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label={lang === "ar" ? "تقليل الكمية" : "Decrease quantity"}
                className="grid h-12 w-12 place-items-center rounded-full"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-6 text-center text-sm font-semibold" aria-live="polite">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => q + 1)}
                aria-label={lang === "ar" ? "زيادة الكمية" : "Increase quantity"}
                className="grid h-12 w-12 place-items-center rounded-full"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="text-end">
              <div className="font-display text-xl font-semibold">
                {(unit * qty).toFixed(2)} <span className="text-sm">{t("jod")}</span>
              </div>
            </div>
          </div>

          <button
            onClick={submit}
            className="min-h-12 w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
          >
            {t("addToCart")}
          </button>
        </div>
      </div>
    </div>

  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-12 rounded-full border px-4 text-sm transition-colors ${
        active
          ? "border-gold bg-secondary font-semibold text-foreground"
          : "border-border text-foreground hover:border-gold/60"
      }`}
    >
      {children}
    </button>
  );
}

const arLabels: Record<string, string> = { size: "الحجم", flavor: "النكهة" };
const t_ar = (k: string) => arLabels[k] ?? k;
