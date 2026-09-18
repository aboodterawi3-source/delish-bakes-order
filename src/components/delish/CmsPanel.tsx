import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,

  Trash2,
  X,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteCategory,
  deleteStorefrontProduct,
  getCmsContent,
  reorderCategories,
  saveBanner,
  saveCategory,
  saveStorefrontProduct,
  setProductVisibility,
  uploadSiteImage,
} from "@/lib/cms.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { convertToWebp, formatBytes } from "@/lib/image-webp";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import {
  TINTS,
  tintFill,
  type SizePrice,
  type StorefrontCategory,
  type StorefrontProduct,
} from "@/lib/storefront-content";
import { PRIORITY_OPTIONS, type PriorityColor } from "@/lib/priority";

const CMS_KEY = ["cms-content"] as const;

const DEFAULT_SIZES: SizePrice[] = [
  { label: "6 inch", price: 0 },
  { label: "9 inch", price: 0 },
  { label: "12 inch", price: 0 },
];

type Tab = "banner" | "categories" | "products";

const tabs: { value: Tab; ar: string; en: string }[] = [
  { value: "banner", ar: "البانر", en: "Banner" },
  { value: "categories", ar: "الأقسام", en: "Categories" },
  { value: "products", ar: "المنتجات", en: "Products" },
];

const field =
  "min-h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const label = "block text-xs font-bold text-foreground";
const primaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition disabled:opacity-60";
const ghostBtn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 text-xs font-bold text-foreground transition hover:bg-secondary/40";

/** Website controller: the sales desk owns the customer app's content. */
export function CmsPanel() {
  const [tab, setTab] = useState<Tab>("banner");
  const content = useQuery({ queryKey: CMS_KEY, queryFn: () => getCmsContent() });

  if (content.isPending) {
    return (
      <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> جار تحميل المحتوى…
      </p>
    );
  }

  if (content.isError) {
    return (
      <p className="py-12 text-center text-sm text-destructive">
        {(content.error as Error).message}
      </p>
    );
  }

  return (
    <section className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto" role="tablist" aria-label="إدارة الموقع">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-5 text-xs font-bold transition ${
              tab === item.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-foreground hover:bg-secondary/40"
            }`}
          >
            {item.ar} · {item.en}
          </button>
        ))}
      </div>

      {tab === "banner" && <BannerEditor banner={content.data.banner} />}
      {tab === "categories" && <CategoriesEditor categories={content.data.categories} />}
      {tab === "products" && (
        <ProductsEditor products={content.data.products} categories={content.data.categories} />
      )}
    </section>
  );
}

/* ---------------------------- image upload field ---------------------------- */

function ImageField({
  value,
  folder,
  onChange,
}: {
  value: string | null;
  folder: "banner" | "categories" | "products";
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadFn = useServerFn(uploadSiteImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const pick = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setBusy(true);
      setError(null);
      setNote(null);
      try {
        // Convert on the device first: WebP at 90% quality, ~500KB target.
        const converted = await convertToWebp(file);
        const uploaded = await uploadFn({ data: { data_url: converted.dataUrl, folder } });
        onChange(uploaded.url);
        setNote(`${formatBytes(converted.originalBytes)} → ${formatBytes(converted.bytes)} WebP`);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "تعذّر رفع الصورة");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [folder, onChange, uploadFn],
  );

  return (
    <div className="space-y-2">
      <span className={label}>الصورة · Image</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-20 w-20 overflow-hidden rounded-2xl border border-border bg-secondary/30">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">
              لا صورة
            </span>
          )}
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={ghostBtn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
          {busy ? "جار الرفع…" : "رفع صورة · Upload"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className={ghostBtn}>
            <X className="h-4 w-4" aria-hidden /> إزالة
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(event) => void pick(event.target.files?.[0])}
        />
      </div>
      <input
        type="url"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value.trim() || null)}
        placeholder="أو ألصق رابط صورة · or paste an image URL"
        className={field}
      />
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      {error && <p className="text-[11px] font-bold text-destructive">{error}</p>}
    </div>
  );
}

/* ------------------------------ priority picker ----------------------------- */

/**
 * Optional kitchen priority. Left empty, the kitchen falls back to the
 * category's priority and finally to the base (soft green) tier.
 */
function PriorityPicker({
  value,
  onChange,
  hint,
}: {
  value: PriorityColor | null;
  onChange: (value: PriorityColor | null) => void;
  hint: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className={label}>أولوية المطبخ (اختياري) · Kitchen priority</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange((event.target.value || null) as PriorityColor | null)}
        className={field}
      >
        <option value="">الأولوية الأساسية (تلقائي) · Base priority (default)</option>
        {PRIORITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.ar} · {option.en}
          </option>
        ))}
      </select>
      <span className="block text-[11px] font-medium text-muted-foreground">{hint}</span>
    </label>
  );
}

/* -------------------------------- tint picker ------------------------------- */

function TintPicker({ value, onChange }: { value: string | null; onChange: (tint: string) => void }) {
  return (
    <div className="space-y-2">
      <span className={label}>لون البطاقة · Card tint</span>
      <div className="flex flex-wrap gap-2">
        {TINTS.map((tint) => (
          <button
            key={tint.value}
            type="button"
            aria-pressed={value === tint.value}
            onClick={() => onChange(tint.value)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-xs font-bold text-foreground transition ${
              value === tint.value ? "border-primary ring-2 ring-primary" : "border-border"
            } ${tint.fill}`}
          >
            {tint.ar} · {tint.en}
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- banner ---------------------------------- */

function BannerEditor({ banner }: { banner: { discount_text: string; subtitle: string; button_text: string; image_url: string | null } | null }) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveBanner);
  const [form, setForm] = useState({
    discount_text: banner?.discount_text ?? "كيكات مميزة تُصنع بحب لمناسباتكم الخاصة 🎂",
    subtitle: banner?.subtitle ?? "سواء كان حفل تخرج، عيد ميلاد، أو ذكرى مميزة.. نصمم لك كيكة استثنائية تناسب ذوقك وتليق بلحظاتك السعيدة.",
    button_text: banner?.button_text ?? "طلب مخصص",
    image_url: banner?.image_url ?? null,
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CMS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["storefront-content"] });
      toast.success("تم حفظ ونشر البانر الرئيسي على الموقع بنجاح 🌸");
    },
    onError: (err: Error) => {
      toast.error(`تعذر حفظ البانر: ${err.message}`);
    },
  });

  return (
    <form
      className="space-y-5 rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="font-display text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            إدارة البانر العلوي للمتجر (Hero Banner Management)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            التحكم في عنوان ووصف وصورة البانر الرئيسي في أعلى الصفحة الرئيسية للمتجر.
          </p>
        </div>
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60 cursor-pointer"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          <span>💾 حفظ ونشر البانر على الموقع / Save & Publish</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className={label}>العنوان الرئيسي للبانر (Headline)</span>
          <input
            type="text"
            value={form.discount_text}
            onChange={(e) => setForm({ ...form, discount_text: e.target.value })}
            placeholder="مثال: كيكات مميزة تُصنع بحب لمناسباتكم الخاصة 🎂"
            className={field}
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className={label}>الوصف الفرعي والترويجي (Subtitle / Description)</span>
          <textarea
            rows={2}
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            placeholder="مثال: سواء كان حفل تخرج، عيد ميلاد، أو ذكرى مميزة.."
            className="w-full rounded-2xl border border-input bg-background p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
        </label>
      </div>

      {/* Image Uploader with live preview & file input */}
      <ImageField
        value={form.image_url}
        folder="banner"
        onChange={(url) => setForm({ ...form, image_url: url })}
        note="اختر صورة عالية الجودة للبانر من جهازك (سيتم تحويلها لـ WebP وتأطيرها تلقائياً)."
      />

      <div className="pt-2 flex items-center justify-end border-t border-border/50">
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-60 cursor-pointer"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          <span>💾 حفظ ونشر البانر على الموقع / Save & Publish</span>
        </button>
      </div>
    </form>
  );
}

/* ------------------------------- categories -------------------------------- */

type CategoryDraft = {
  id?: string | undefined;
  name_en: string;
  name_ar: string;
  image_url: string | null;
  tint: string;
  is_active: boolean;
  priority_color: PriorityColor | null;
};

const emptyCategory: CategoryDraft = {
  name_en: "",
  name_ar: "",
  image_url: null,
  tint: "blush",
  is_active: true,
  priority_color: null,
};

function CategoriesEditor({ categories }: { categories: StorefrontCategory[] }) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveCategory);
  const deleteFn = useServerFn(deleteCategory);
  const reorderFn = useServerFn(reorderCategories);
  const [draft, setDraft] = useState<CategoryDraft | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: CMS_KEY });
  const save = useMutation({
    mutationFn: (input: CategoryDraft) =>
      saveFn({
        data: {
          id: input.id,
          name_en: input.name_en,
          name_ar: input.name_ar,
          image_url: input.image_url,
          tint: input.tint,
          is_active: input.is_active,
          priority_color: input.priority_color,
          sort_order: categories.length + 1,
        },
      }),
    onSuccess: () => {
      setDraft(null);
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteFn({ data: { id } }), onSuccess: refresh });
  const reorder = useMutation({ mutationFn: (ids: string[]) => reorderFn({ data: { ids } }), onSuccess: refresh });

  const move = (index: number, direction: -1 | 1) => {
    const ids = categories.map((category) => category.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setDraft({ ...emptyCategory })} className={primaryBtn}>
          <Plus className="h-4 w-4" aria-hidden /> قسم جديد · New category
        </button>
        <p className="text-xs text-muted-foreground">الترتيب هنا هو نفس ترتيب الشريط عند العميل.</p>
      </div>

      <ul className="grid gap-3">
        {categories.map((category, index) => (
          <li
            key={category.id}
            className={`flex flex-wrap items-center gap-3 rounded-3xl border border-border p-4 ${tintFill(category.tint)}`}
          >
            <div className="h-12 w-12 overflow-hidden rounded-2xl bg-card/80">
              {category.image_url ? (
                <img src={category.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-xs font-bold text-muted-foreground">
                  {category.name_en.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="me-auto">
              <p className="text-sm font-bold text-foreground">
                {category.name_ar} · {category.name_en}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {category.is_active ? "ظاهر للعميل" : "مخفي"} · #{category.sort_order}
              </p>
            </div>
            <button type="button" aria-label="أعلى" onClick={() => move(index, -1)} className={ghostBtn}>
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" aria-label="أسفل" onClick={() => move(index, 1)} className={ghostBtn}>
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() =>
                setDraft({
                  id: category.id,
                  name_en: category.name_en,
                  name_ar: category.name_ar,
                  image_url: category.image_url,
                  tint: category.tint,
                  is_active: category.is_active,
                  priority_color: category.priority_color ?? null,
                })
              }
              className={ghostBtn}
            >
              <Pencil className="h-4 w-4" aria-hidden /> تعديل
            </button>
            <button
              type="button"
              onClick={() => remove.mutate(category.id)}
              className={`${ghostBtn} text-destructive`}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> حذف
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={draft !== null} onOpenChange={(open: boolean) => !open && setDraft(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto rounded-3xl sm:max-w-xl">
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
                  {draft.id ? "تعديل قسم · Edit category" : "قسم جديد · New category"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className={label}>الاسم بالعربية</span>
                  <input value={draft.name_ar} onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })} className={field} required />
                </label>
                <label className="space-y-1.5">
                  <span className={label}>Name in English</span>
                  <input value={draft.name_en} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} className={field} required />
                </label>
              </div>
              <ImageField value={draft.image_url} folder="categories" onChange={(url) => setDraft({ ...draft, image_url: url })} />
              <TintPicker value={draft.tint} onChange={(tint) => setDraft({ ...draft, tint })} />
              <PriorityPicker
                value={draft.priority_color}
                onChange={(priority_color) => setDraft({ ...draft, priority_color })}
                hint="تُطبَّق على كل منتجات القسم إن لم يكن للمنتج أولوية خاصة."
              />
              <label className="flex items-center gap-3 text-sm font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="h-5 w-5 rounded border-input"
                />
                ظاهر عند العميل · Visible
              </label>
       <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
                <button type="submit" disabled={save.isPending} className={primaryBtn}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} حفظ · Save
                </button>
                <button type="button" onClick={() => setDraft(null)} className={ghostBtn}>
                  إلغاء
                </button>
                {save.isError && <span className="text-xs font-bold text-destructive">{(save.error as Error).message}</span>}
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------- products --------------------------------- */

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

function ProductsEditor({
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

  const remove = useMutation({ mutationFn: (id: string) => deleteFn({ data: { id } }), onSuccess: refresh });

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
        <button type="button" onClick={() => setDraft({ ...emptyProduct, sizes: emptyProduct.sizes.map((s) => ({ ...s })) })} className={primaryBtn}>
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
                <img src={product.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">لا صورة</span>
              )}
            </div>
             <div className="min-w-0 sm:me-auto">
               <p className="break-words text-sm font-bold text-foreground">
                {product.name_ar} · {product.name_en}
              </p>
               <p className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{product.price.toFixed(2)} د.أ</span>
                {product.sizes.length > 0 && <span>{product.sizes.map((s) => s.label).join(" · ")}</span>}
                {product.price_on_request && <span className="font-bold text-primary">السعر عند الطلب</span>}
                {product.filling_ar && <span>حشوة: {product.filling_ar}</span>}
              </p>
            </div>

             <label className="col-span-2 inline-flex min-w-0 items-center gap-2 text-xs font-bold text-foreground sm:col-auto">
              <input
                type="checkbox"
                checked={product.is_available}
                onChange={(event) => toggle.mutate({ id: product.id, is_available: event.target.checked })}
                className="h-5 w-5 rounded border-input"
              />
              {product.is_available ? "متوفر · Active" : "غير متوفر · Out of stock"}
            </label>

             <label className="col-span-2 inline-flex min-w-0 items-center gap-2 text-xs font-bold text-foreground sm:col-auto">
              <input
                type="checkbox"
                checked={product.is_popular}
                onChange={(event) => toggle.mutate({ id: product.id, is_popular: event.target.checked })}
                className="h-5 w-5 rounded border-input"
              />
              في الأشهر · Popular
            </label>

             <button type="button" onClick={() => setDraft(toDraft(product))} className={`${ghostBtn} col-span-1`}>
              <Pencil className="h-4 w-4" aria-hidden /> تعديل · Edit
            </button>
             <button type="button" onClick={() => remove.mutate(product.id)} className={`${ghostBtn} col-span-1 text-destructive`}>
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
              <span className={label}>الاسم بالعربية</span>
              <input value={draft.name_ar} onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })} className={field} required />
            </label>
            <label className="space-y-1.5">
              <span className={label}>Name in English</span>
              <input value={draft.name_en} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} className={field} required />
            </label>
            <label className="space-y-1.5">
              <span className={label}>الوصف بالعربية</span>
              <textarea
                value={draft.description_ar}
                onChange={(e) => setDraft({ ...draft, description_ar: e.target.value })}
                rows={3}
                className="w-full rounded-2xl border border-input bg-background p-3 text-sm"
              />
            </label>
            <label className="space-y-1.5">
              <span className={label}>Description in English</span>
              <textarea
                value={draft.description_en}
                onChange={(e) => setDraft({ ...draft, description_en: e.target.value })}
                rows={3}
                className="w-full rounded-2xl border border-input bg-background p-3 text-sm"
              />
            </label>
            <label className="space-y-1.5">
              <span className={label}>القسم · Category</span>
              <select
                value={draft.category_id ?? ""}
                onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })}
                className={field}
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
              <span className={label}>التصنيف الداخلي · Internal tag</span>
              <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={field} required />
            </label>
            {/* Price is optional once the product is priced on request. */}
            {draft.price_on_request ? (
              <p className="rounded-xl border border-border bg-secondary/30 p-3 text-xs font-bold text-foreground">
                لا حاجة لسعر ثابت — سيظهر زر «اطلب السعر» على الموقع.
              </p>
            ) : (
              <label className="space-y-1.5">
                <span className={label}>السعر الأساسي · Base price</span>
                <input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={field} required />
              </label>
            )}
            <label className="space-y-1.5">
              <span className={label}>نوع الحشوة · Filling (عربي)</span>
              <input value={draft.filling_ar} onChange={(e) => setDraft({ ...draft, filling_ar: e.target.value })} placeholder="نوتيلا، لوتس، فراولة…" className={field} />
            </label>
            <label className="space-y-1.5">
              <span className={label}>Filling type (English)</span>
              <input value={draft.filling_en} onChange={(e) => setDraft({ ...draft, filling_en: e.target.value })} placeholder="Nutella, Lotus, Strawberry…" className={field} />
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
            <legend className={label}>الأحجام والأسعار · Sizes &amp; prices</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {draft.sizes.map((size, index) => (
                 <div key={index} className="grid min-w-0 grid-cols-2 gap-2">
                  <input
                    value={size.label}
                    onChange={(e) => {
                      const sizes = draft.sizes.map((row, i) => (i === index ? { ...row, label: e.target.value } : row));
                      setDraft({ ...draft, sizes });
                    }}
                    placeholder="6 inch"
                    className={field}
                    aria-label="حجم"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={size.price}
                    onChange={(e) => {
                      const sizes = draft.sizes.map((row, i) => (i === index ? { ...row, price: e.target.value } : row));
                      setDraft({ ...draft, sizes });
                    }}
                    placeholder="السعر"
                    className={field}
                    aria-label="سعر الحجم"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, sizes: [...draft.sizes, { label: "", price: "" }] })}
              className={ghostBtn}
            >
              <Plus className="h-4 w-4" aria-hidden /> حجم إضافي
            </button>
          </fieldset>

          <ImageField value={draft.image_url} folder="products" onChange={(url) => setDraft({ ...draft, image_url: url })} />
          <TintPicker value={draft.tint} onChange={(tint) => setDraft({ ...draft, tint })} />
          <PriorityPicker
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
                <button type="submit" disabled={save.isPending} className={primaryBtn}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} حفظ ونشر · Save
                </button>
                <button type="button" onClick={() => setDraft(null)} className={ghostBtn}>
                  إلغاء
                </button>
                {save.isError && <span className="text-xs font-bold text-destructive">{(save.error as Error).message}</span>}
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
