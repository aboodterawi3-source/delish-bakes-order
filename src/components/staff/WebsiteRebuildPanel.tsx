import { useMemo, useState } from "react";
import { Plus, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StorefrontProductModal, type ModalAddPayload } from "@/components/delish/StorefrontProductModal";
import { customizationSummary } from "@/components/delish/CakeCustomizationPanel";
import type { StorefrontProduct } from "@/lib/storefront-content";
import type { RebuildLine, SalesOrder } from "@/lib/sales.functions";

const jd = (value: number) => `${value.toFixed(2)} د.أ`;

type Draft = RebuildLine & { key: string };

/**
 * Website-style modification screen: staff rebuild the order using the exact
 * product cards and customization sheet the customer sees on the website.
 * The basket starts empty so nothing from the old edit form carries over.
 */
export function WebsiteRebuildPanel({
  order,
  products,
  busy,
  onReplace,
}: {
  order: SalesOrder;
  products: StorefrontProduct[];
  busy: boolean;
  onReplace: (lines: RebuildLine[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<StorefrontProduct | null>(null);
  const [lines, setLines] = useState<Draft[]>([]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const product of products) if (product.category?.trim()) set.add(product.category.trim());
    return [...set].sort();
  }, [products]);
  const [category, setCategory] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category && product.category !== category) return false;
      if (!needle) return true;
      return (
        product.name_ar.toLowerCase().includes(needle) || product.name_en.toLowerCase().includes(needle)
      );
    });
  }, [category, products, query]);

  const total = lines.reduce((acc, line) => acc + line.unitPrice * line.quantity, 0);

  const addLine = (payload: ModalAddPayload) => {
    const summary = customizationSummary(payload.customization).ar;
    const options = [...(payload.size ? [`الحجم: ${payload.size}`] : []), ...summary];
    setLines((current) => [
      ...current,
      {
        key: `${payload.product.id}-${Date.now()}`,
        productId: payload.product.id,
        name: payload.product.name_ar,
        quantity: payload.quantity,
        unitPrice: payload.price,
        options,
        notes: payload.notes.trim() || null,
      },
    ]);
    setPicked(null);
    toast.success("تمت إضافة الصنف إلى الطلب الجديد");
  };

  const importCurrent = () =>
    setLines(
      order.items.map((item, index) => ({
        key: `current-${item.id}-${index}`,
        productId: item.product_id ?? null,
        name: item.name_ar,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        options: item.options_ar,
        notes: item.notes,
      })),
    );

  return (
    <section dir="rtl" className="space-y-4 rounded-3xl border border-primary/30 bg-secondary/20 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 font-display text-base font-bold text-foreground">
          إعادة بناء الطلب بواجهة الموقع · Website builder
        </h3>
        <button
          type="button"
          onClick={importCurrent}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-bold text-foreground"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden /> نسخ أصناف الطلب الحالية
        </button>
      </header>
      <p className="text-xs text-muted-foreground">
        اختر المنتجات كما يفعل العميل على الموقع، وحدّد الحجم والشموع والبالونات والأكريليك والحشوة
        والملاحظات، ثم اضغط «استبدال أصناف الطلب» ليُحفظ كل شيء على الطلب فوراً.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث عن منتج…"
          className="min-h-11 w-full rounded-2xl border border-input bg-card px-3 text-sm"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="min-h-11 w-full rounded-2xl border border-input bg-card px-3 text-sm"
        >
          <option value="">كل الأقسام</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => setPicked(product)}
            className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-start shadow-xs transition-transform hover:-translate-y-0.5"
          >
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name_ar}
                loading="lazy"
                className="h-28 w-full object-cover"
              />
            ) : null}
            <div className="space-y-1 p-3">
              <p className="break-words text-sm font-bold text-foreground">{product.name_ar}</p>
              <p className="text-xs font-bold text-primary">
                {product.price_on_request ? "السعر عند الطلب" : jd(product.price)}
              </p>
              {product.filling_ar?.trim() ? (
                <p className="text-[11px] text-muted-foreground">حشوة: {product.filling_ar}</p>
              ) : null}
            </div>
          </button>
        ))}
        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            لا توجد منتجات مطابقة.
          </p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
        <p className="text-sm font-bold text-foreground">أصناف الطلب الجديد</p>
        {lines.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            لم تُختر أصناف بعد — اضغط أي منتج بالأعلى للبدء.
          </p>
        ) : (
          <ul className="grid gap-2">
            {lines.map((line, index) => (
              <li key={line.key} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 break-words text-sm font-bold text-foreground">
                    {line.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}
                    aria-label="حذف الصنف"
                    className="grid h-10 w-10 place-items-center rounded-full border border-destructive/40 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {(line.options ?? []).length > 0 ? (
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {(line.options ?? []).join(" · ")}
                  </p>
                ) : null}
                {line.notes ? (
                  <p className="mt-1 break-words text-xs text-muted-foreground">ملاحظة: {line.notes}</p>
                ) : null}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-foreground">
                    الكمية
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) => {
                        const qty = Math.max(1, Math.trunc(Number(event.target.value) || 1));
                        setLines((current) =>
                          current.map((row, at) => (at === index ? { ...row, quantity: qty } : row)),
                        );
                      }}
                      className="mt-1 min-h-11 w-full rounded-xl border border-input bg-card px-2 text-center text-sm font-bold"
                    />
                  </label>
                  <label className="block text-xs font-bold text-foreground">
                    سعر الوحدة (د.أ)
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(event) => {
                        const price = Math.max(0, Number(event.target.value) || 0);
                        setLines((current) =>
                          current.map((row, at) => (at === index ? { ...row, unitPrice: price } : row)),
                        );
                      }}
                      className="mt-1 min-h-11 w-full rounded-xl border border-input bg-card px-2 text-center text-sm font-bold"
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm font-bold text-foreground">مجموع الأصناف: {jd(total)}</p>
        <button
          type="button"
          disabled={busy || lines.length === 0}
          onClick={() =>
            onReplace(
              lines.map(({ key: _key, ...line }) => line),
            )
          }
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> استبدال أصناف الطلب · Replace items
        </button>
      </div>

      <StorefrontProductModal product={picked} onClose={() => setPicked(null)} onAdd={addLine} />
    </section>
  );
}
