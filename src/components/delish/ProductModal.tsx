import { useEffect, useId, useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { Option, Product } from "@/lib/menu";
import { images } from "@/lib/images";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { useDismissable } from "@/lib/a11y";


export function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t, lang } = useLang();
  const { add } = useCart();
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [flavorId, setFlavorId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const titleId = useId();
  const notesId = useId();

  useDismissable(Boolean(product), onClose);


  useEffect(() => {
    if (product) {
      setSizeId(product.sizes?.[0]?.id ?? null);
      setFlavorId(product.flavors?.[0]?.id ?? null);
      setQty(1);
      setNotes("");
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
    add({
      ar: product.ar,
      en: product.en,
      unit,
      qty,
      image: images[product.image],
      detailsAr: [size ? `${t_ar("size")}: ${size.ar}` : "", flavor ? `${t_ar("flavor")}: ${flavor.ar}` : ""].filter(
        Boolean,
      ),
      detailsEn: [size ? `Size: ${size.en}` : "", flavor ? `Flavor: ${flavor.en}` : ""].filter(Boolean),
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cocoa/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
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
          <img
            src={images[product.image]}
            alt={lang === "ar" ? product.ar : product.en}
            loading="lazy"
            width={800}
            height={800}
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
            <h3 className="font-display text-xl font-semibold">{lang === "ar" ? product.ar : product.en}</h3>
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

          <Group title={t("notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPh")}
              rows={2}
              className="w-full rounded-2xl border border-input bg-background p-3 text-sm outline-none focus:border-gold"
            />
          </Group>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 rounded-full border border-border px-2 py-1.5">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="minus" className="p-1">
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-6 text-center text-sm font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} aria-label="plus" className="p-1">
                <Plus className="h-4 w-4" />
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
            className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
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
      className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
        active
          ? "border-gold bg-secondary font-semibold text-foreground"
          : "border-border text-muted-foreground hover:border-gold/60"
      }`}
    >
      {children}
    </button>
  );
}

const arLabels: Record<string, string> = { size: "الحجم", flavor: "النكهة" };
const t_ar = (k: string) => arLabels[k] ?? k;
