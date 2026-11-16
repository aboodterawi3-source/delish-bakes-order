import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { deleteCategory, reorderCategories, saveCategory } from "@/lib/cms.functions";
import type { PriorityColor } from "@/lib/priority";
import { tintFill, type StorefrontCategory } from "@/lib/storefront-content";

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

/** Storefront category ordering, visibility, and priority management tab inside CmsPanel. */
export function CmsCategoriesEditor({ categories }: { categories: StorefrontCategory[] }) {
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
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: refresh,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderFn({ data: { ids } }),
    onSuccess: refresh,
  });

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
        <button
          type="button"
          onClick={() => setDraft({ ...emptyCategory })}
          className={cmsPrimaryBtnClass}
        >
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
                <img
                  src={category.image_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
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
            <button
              type="button"
              aria-label="أعلى"
              onClick={() => move(index, -1)}
              className={cmsGhostBtnClass}
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="أسفل"
              onClick={() => move(index, 1)}
              className={cmsGhostBtnClass}
            >
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
              className={cmsGhostBtnClass}
            >
              <Pencil className="h-4 w-4" aria-hidden /> تعديل
            </button>
            <button
              type="button"
              onClick={() => remove.mutate(category.id)}
              className={`${cmsGhostBtnClass} text-destructive`}
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
              </div>
              <CmsImageField
                value={draft.image_url}
                folder="categories"
                onChange={(url) => setDraft({ ...draft, image_url: url })}
              />
              <CmsTintPicker value={draft.tint} onChange={(tint) => setDraft({ ...draft, tint })} />
              <CmsPriorityPicker
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
                <button type="submit" disabled={save.isPending} className={cmsPrimaryBtnClass}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} حفظ ·
                  Save
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
