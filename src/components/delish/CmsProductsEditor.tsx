import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  CMS_KEY,
  CmsImageField,
  CmsPriorityPicker,
  CmsTintPicker,
  cmsFieldClass,
  cmsGhostBtnClass,
  cmsLabelClass,
  cmsPrimaryBtnClass,
} from "@/components/delish/CmsSharedControls";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  deleteStorefrontProduct,
  saveStorefrontProduct,
  setProductVisibility,
} from "@/lib/cms.functions";
import { jd } from "@/lib/currency";
import type { PriorityColor } from "@/lib/priority";
import {
  tintFill,
  type SizePrice,
  type StorefrontCategory,
  type StorefrontProduct,
} from "@/lib/storefront-content";

const DEFAULT_SIZES: SizePrice[] = [
  { label: "6 inch", price: 0 },
  { label: "9 inch", price: 0 },
  { label: "12 inch", price: 0 },
];

type ProductDraft = {
  id?: string | undefined;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  category: string;
  category_id: string | null;
  price: string;
  sizes: { label: string; price: string }[];
  image_url: string | null;
  tint: string;
  filling_ar: string;
  filling_en: string;
  price_on_request: boolean;
  is_available: boolean;
  is_popular: boolean;
  priority_color: PriorityColor | null;
};

const emptyProduct: ProductDraft = {
  name_en: "",
  name_ar: "",
  description_en: "",
  description_ar: "",
  category: "cakes",
  category_id: null,
  price: "0",
  sizes: DEFAULT_SIZES.map((size) => ({ label: size.label, price: "" })),
  image_url: null,
  tint: "cream",
  filling_ar: "",
  filling_en: "",
  price_on_request: false,
  is_available: true,
  is_popular: true,
  priority_color: null,
};

const toDraft = (product: StorefrontProduct): ProductDraft => ({
  id: product.id,
  name_en: product.name_en,
  name_ar: product.name_ar,
  description_en: product.description_en ?? "",
  description_ar: product.description_ar ?? "",
  category: product.category,
  category_id: product.category_id,
  price: String(product.price),
  sizes: (product.sizes.length ? product.sizes : DEFAULT_SIZES).map((size) => ({
    label: size.label,
    price: size.price ? String(size.price) : "",
  })),
  image_url: product.image_url,
  tint: product.tint ?? "cream",
  filling_ar: product.filling_ar ?? "",
  filling_en: product.filling_en ?? "",
  price_on_request: product.price_on_request,
  is_available: product.is_available,
  is_popular: product.is_popular,
  priority_color: product.priority_color ?? null,
});

/** Storefront product catalog CRUD, availability toggles, and size pricing tab inside CmsPanel. */
export function CmsProductsEditor({
  products,
  categories,
}: {
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
}) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveStorefrontProduct);
  const visibilityFn = useServerFn(setProductVisibility);
  const deleteFn = useServerFn(deleteStorefrontProduct);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [search, setSearch] = useState("");

  const refresh = () => void queryClient.invalidateQueries({ queryKey: CMS_KEY });

  const save = useMutation({
    mutationFn: (input: ProductDraft) =>
      saveFn({
        data: {
          id: input.id,
          name_en: input.name_en,
          name_ar: input.name_ar,
          description_en: input.description_en,
          description_ar: input.description_ar,
          category: input.category,
          category_id: input.category_id,
          price: Number(input.price) || 0,
          sizes: input.sizes
            .filter((size) => size.label.trim() && size.price !== "")
            .map((size) => ({ label: size.label.trim(), price: Number(size.price) || 0 })),
          image_url: input.image_url,
          tint: input.tint,
          filling_ar: input.filling_ar,
          filling_en: input.filling_en,
          price_on_request: input.price_on_request,
          is_available: input.is_available,
          is_popular: input.is_popular,
          priority_color: input.priority_color,
        },
      }),
    onSuccess: () => {
      setDraft(null);
      refresh();
    },
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; is_available?: boolean; is_popular?: boolean }) =>
      visibilityFn({ data: input }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: refresh,
  });

  const list = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) =>
      `${product.name_ar} ${product.name_en} ${product.category}`.toLowerCase().includes(needle),
    );
  }, [products, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            setDraft({ ...emptyProduct, sizes: emptyProduct.sizes.map((s) => ({ ...s })) })
          }
          className={cmsPrimaryBtnClass}
        >
          <Plus className="h-4 w-4" aria-hidden /> منتج جديد · New product
        </button>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث عن منتج…"
          className="min-h-12 flex-1 rounded-full border border-input bg-background px-4 text-sm"
        />
      </div>

      <ul className="grid gap-3">
        {list.map((product) => (
          <li
            key={product.id}
            className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-3xl border border-border p-4 sm:flex sm:flex-wrap ${tintFill(product.tint)}`}
          >
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-card/80">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">
                  لا صورة
                </span>
              )}
            </div>
            <div className="min-w-0 sm:me-auto">
              <p className="text-sm font-bold break-words text-foreground">
                {product.name_ar} · {product.name_en}
              </p>
              <p className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{jd(product.price)}</span>
                {product.sizes.length > 0 && (
                  <span>{product.sizes.map((s) => s.label).join(" · ")}</span>
                )}
                {product.price_on_request && (
                  <span className="font-bold text-primary">السعر عند الطلب</span>
                )}
                {product.filling_ar && <span>حشوة: {product.filling_ar}</span>}
              </p>
            </div>

            <label className="col-span-2 inline-flex min-w-0 items-center gap-2 text-xs font-bold text-foreground sm:col-auto">
              <input
                type="checkbox"
                checked={product.is_available}
                onChange={(event) =>
                  toggle.mutate({ id: product.id, is_available: event.target.checked })
                }
                className="h-5 w-5 rounded border-input"
              />
              {product.is_available ? "متوفر · Active" : "غير متوفر · Out of stock"}
            </label>

            <label className="col-span-2 inline-flex min-w-0 items-center gap-2 text-xs font-bold text-foreground sm:col-auto">
              <input
                type="checkbox"
                checked={product.is_popular}
                onChange={(event) =>
                  toggle.mutate({ id: product.id, is_popular: event.target.checked })
                }
                className="h-5 w-5 rounded border-input"
              />
              في الأشهر · Popular
            </label>

            <button
              type="button"
              onClick={() => setDraft(toDraft(product))}
              className={`${cmsGhostBtnClass} col-span-1`}
            >
              <Pencil className="h-4 w-4" aria-hidden /> تعديل · Edit
            </button>
            <button
              type="button"
              onClick={() => remove.mutate(product.id)}
              className={`${cmsGhostBtnClass} col-span-1 text-destructive`}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> حذف
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto rounded-3xl sm:max-w-2xl">
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate(draft);
              }}
            >
              <DialogHeader>
                <DialogTitle className="font-display text-lg font-bold text-foreground">
                  {draft.id ? "تعديل منتج · Edit product" : "منتج جديد · New product"}
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className={cmsLabelClass}>الاسم بالعربية</span>
                  <input
                    value={draft.name_ar}
                    onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
                    className={cmsFieldClass}
                    required
                  />
                </label>
                <label className="space-y-1.5">
                  <span className={cmsLabelClass}>Name in English</span>
                  <input
                    value={draft.name_en}
                    onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
                    className={cmsFieldClass}
                    required
                  />
                </label>
                <label className="space-y-1.5">
                  <span className={cmsLabelClass}>الوصف بالعربية</span>
                  <textarea
                    value={draft.description_ar}
                    onChange={(e) => setDraft({ ...draft, description_ar: e.target.value })}
                    rows={3}
                    className="w-full rounded-2xl border border-input bg-background p-3 text-sm"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className={cmsLabelClass}>Description in English</span>
                  <textarea
                    value={draft.description_en}
                    onChange={(e) => setDraft({ ...draft, description_en: e.target.value })}
                    rows={3}
                    className="w-full rounded-2xl border border-input bg-background p-3 text-sm"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className={cmsLabelClass}>القسم · Category</span>
                  <select
                    value={draft.category_id ?? ""}
                    onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })}
                    className={cmsFieldClass}
                  >
                    <option value="">— بدون قسم —</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name_ar} · {category.name_en}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className={cmsLabelClass}>التصنيف الداخلي · Internal tag</span>
                  <input
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className={cmsFieldClass}
                    required
                  />
                </label>
                {draft.price_on_request ? (
                  <p className="rounded-xl border border-border bg-secondary/30 p-3 text-xs font-bold text-foreground">
                    لا حاجة لسعر ثابت — سيظهر زر «اطلب السعر» على الموقع.
                  </p>
                ) : (
                  <label className="space-y-1.5">
                    <span className={cmsLabelClass}>السعر الأساسي · Base price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                      className={cmsFieldClass}
                      required
                    />
                  </label>
                )}
                <label className="space-y-1.5">
                  <span className={cmsLabelClass}>نوع الحشوة · Filling (عربي)</span>
                  <input
                    value={draft.filling_ar}
                    onChange={(e) => setDraft({ ...draft, filling_ar: e.target.value })}
                    placeholder="نوتيلا، لوتس، فراولة…"
                    className={cmsFieldClass}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className={cmsLabelClass}>Filling type (English)</span>
                  <input
                    value={draft.filling_en}
                    onChange={(e) => setDraft({ ...draft, filling_en: e.target.value })}
                    placeholder="Nutella, Lotus, Strawberry…"
                    className={cmsFieldClass}
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={draft.price_on_request}
                    onChange={(e) => setDraft({ ...draft, price_on_request: e.target.checked })}
                    className="h-5 w-5 rounded border-input"
                  />
                  السعر عند الطلب · Price on request (يخفي السعر ويظهر زر «اطلب السعر»)
                </label>
              </div>

              <fieldset className="space-y-2">
                <legend className={cmsLabelClass}>الأحجام والأسعار · Sizes &amp; prices</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {draft.sizes.map((size, index) => (
                    <div key={index} className="grid min-w-0 grid-cols-2 gap-2">
                      <input
                        value={size.label}
                        onChange={(e) => {
                          const sizes = draft.sizes.map((row, i) =>
                            i === index ? { ...row, label: e.target.value } : row,
                          );
                          setDraft({ ...draft, sizes });
                        }}
                        placeholder="6 inch"
                        className={cmsFieldClass}
                        aria-label="حجم"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={size.price}
                        onChange={(e) => {
                          const sizes = draft.sizes.map((row, i) =>
                            i === index ? { ...row, price: e.target.value } : row,
                          );
                          setDraft({ ...draft, sizes });
                        }}
                        placeholder="السعر"
                        className={cmsFieldClass}
                        aria-label="سعر الحجم"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, sizes: [...draft.sizes, { label: "", price: "" }] })
                  }
                  className={cmsGhostBtnClass}
                >
                  <Plus className="h-4 w-4" aria-hidden /> حجم إضافي
                </button>
              </fieldset>

              <CmsImageField
                value={draft.image_url}
                folder="products"
                onChange={(url) => setDraft({ ...draft, image_url: url })}
              />
              <CmsTintPicker value={draft.tint} onChange={(tint) => setDraft({ ...draft, tint })} />
              <CmsPriorityPicker
                value={draft.priority_color}
                onChange={(priority_color) => setDraft({ ...draft, priority_color })}
                hint="اتركها فارغة ليأخذ المنتج أولوية قسمه أو الأولوية الأساسية تلقائياً."
              />

              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-3 text-sm font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={draft.is_available}
                    onChange={(e) => setDraft({ ...draft, is_available: e.target.checked })}
                    className="h-5 w-5 rounded border-input"
                  />
                  متوفر · Active
                </label>
                <label className="flex items-center gap-3 text-sm font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={draft.is_popular}
                    onChange={(e) => setDraft({ ...draft, is_popular: e.target.checked })}
                    className="h-5 w-5 rounded border-input"
                  />
                  يظهر في Popular Cakes
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={save.isPending} className={cmsPrimaryBtnClass}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} حفظ
                  ونشر · Save
                </button>
                <button type="button" onClick={() => setDraft(null)} className={cmsGhostBtnClass}>
                  إلغاء
                </button>
                {save.isError && (
                  <span className="text-xs font-bold text-destructive">
                    {(save.error as Error).message}
                  </span>
                )}
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
