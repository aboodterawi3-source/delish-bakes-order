import { useEffect, useId, useMemo, useState } from "react";
import { Minus, Plus, X, ImageOff } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useDismissable } from "@/lib/a11y";
import { formatJod } from "@/lib/currency";
import { WHATSAPP } from "@/lib/menu";
import { priceForSize, type StorefrontProduct } from "@/lib/storefront-content";

export type ModalAddPayload = {
  product: StorefrontProduct;
  size: string | null;
  quantity: number;
  price: number;
  notes: string;
};

/**
 * Quick details modal opened from any product card. Priced cakes can be added
 * straight to the cart; cakes without a fixed price show "اطلب السعر" instead.
 */
export function StorefrontProductModal({
  product,
  onClose,
  onAdd,
  onMoreOptions,
}: {
  product: StorefrontProduct | null;
  onClose: () => void;
  onAdd: (payload: ModalAddPayload) => void;
  onMoreOptions?: (productId: string) => void;
}) {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const titleId = useId();
  const notesId = useId();
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  useDismissable(Boolean(product), onClose);

  useEffect(() => {
    if (product) {
      setSize(product.sizes[0]?.label ?? null);
      setQuantity(1);
      setNotes("");
    }
  }, [product]);

  const unit = useMemo(() => (product ? priceForSize(product, size) : 0), [product, size]);

  if (!product) return null;

  const name = ar ? product.name_ar : product.name_en;
  const description = ar ? product.description_ar : product.description_en;
  const filling = ar ? product.filling_ar : product.filling_en;
  const askUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
    ar ? `مرحباً، أريد معرفة سعر: ${product.name_ar}` : `Hello, I would like the price for: ${product.name_en}`,
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/75 sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label={ar ? "إغلاق النافذة" : "Close dialog"}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir={ar ? "rtl" : "ltr"}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-[var(--shadow-soft)] sm:rounded-3xl"
      >
        <div className="relative">
          {product.image_url ? (
            <img src={product.image_url} alt={name} className="h-52 w-full object-cover sm:h-60" />
          ) : (
            <div className="grid h-52 w-full place-items-center bg-secondary/40 text-muted-foreground sm:h-60">
              <ImageOff className="h-6 w-6" aria-hidden />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={ar ? "إغلاق" : "Close"}
            className="absolute top-3 end-3 grid h-11 w-11 place-items-center rounded-full bg-background/95 text-foreground shadow-sm"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <h2 id={titleId} className="font-sans text-xl font-extrabold text-foreground">
              {name}
            </h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>

          {filling && (
            <p className="rounded-2xl border border-border bg-secondary/30 p-3 text-xs font-bold text-foreground">
              {ar ? "نوع الحشوة" : "Filling"}: <span className="font-semibold">{filling}</span>
            </p>
          )}

          {product.price_on_request ? (
            <>
              <p className="text-sm font-bold text-primary">
                {ar
                  ? "هذا التصميم يُسعّر حسب الطلب — تواصل معنا لمعرفة السعر."
                  : "This design is priced per request — contact us for a quote."}
              </p>
              <a
                href={askUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="grid min-h-12 w-full place-items-center rounded-full bg-whatsapp text-sm font-bold text-whatsapp-foreground"
              >
                {ar ? "اطلب السعر" : "On request"}
              </a>
            </>
          ) : (
            <>
              {product.sizes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      aria-pressed={size === option.label}
                      onClick={() => setSize(option.label)}
                      className={`min-h-11 rounded-full border px-4 text-xs font-bold ${
                        size === option.label
                          ? "border-gold bg-secondary text-foreground"
                          : "border-border text-foreground hover:border-gold/60"
                      }`}
                    >
                      {option.label} — {formatJod(option.price, lang)}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor={notesId} className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {t("notes")}
                </label>
                <textarea
                  id={notesId}
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-2xl border border-input bg-background p-3 text-sm outline-none focus:border-gold"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-full border border-border px-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label={ar ? "تقليل الكمية" : "Decrease quantity"}
                    className="grid h-11 w-11 place-items-center rounded-full"
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </button>
                  <span className="min-w-6 text-center text-sm font-bold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label={ar ? "زيادة الكمية" : "Increase quantity"}
                    className="grid h-11 w-11 place-items-center rounded-full"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <span className="font-sans text-xl font-extrabold text-foreground">
                  {formatJod(unit * quantity, lang)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onAdd({ product, size, quantity, price: unit, notes })}
                className="min-h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.01]"
              >
                {t("addToCart")}
              </button>

              {onMoreOptions && (
                <button
                  type="button"
                  onClick={() => onMoreOptions(product.id)}
                  className="min-h-11 w-full text-center text-xs text-foreground underline"
                >
                  {ar ? "شمعات، بالونات وتخصيص إضافي" : "Candles, balloons & more options"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
