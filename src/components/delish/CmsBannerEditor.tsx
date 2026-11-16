import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  CMS_KEY,
  CmsImageField,
  cmsFieldClass,
  cmsLabelClass,
} from "@/components/delish/CmsSharedControls";
import { saveBanner } from "@/lib/cms.functions";

/** Storefront hero banner management tab inside CmsPanel. */
export function CmsBannerEditor({
  banner,
}: {
  banner: {
    discount_text: string;
    subtitle: string;
    button_text: string;
    image_url: string | null;
  } | null;
}) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveBanner);
  const [form, setForm] = useState({
    discount_text: banner?.discount_text ?? "كيكات مميزة تُصنع بحب لمناسباتكم الخاصة 🎂",
    subtitle:
      banner?.subtitle ??
      "سواء كان حفل تخرج، عيد ميلاد، أو ذكرى مميزة.. نصمم لك كيكة استثنائية تناسب ذوقك وتليق بلحظاتك السعيدة.",
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
      className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-xs sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground sm:text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            إدارة البانر العلوي للمتجر (Hero Banner Management)
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            التحكم في عنوان ووصف وصورة البانر الرئيسي في أعلى الصفحة الرئيسية للمتجر.
          </p>
        </div>
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 text-xs font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60 sm:text-sm"
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          <span>💾 حفظ ونشر البانر على الموقع / Save & Publish</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className={cmsLabelClass}>العنوان الرئيسي للبانر (Headline)</span>
          <input
            type="text"
            value={form.discount_text}
            onChange={(e) => setForm({ ...form, discount_text: e.target.value })}
            placeholder="مثال: كيكات مميزة تُصنع بحب لمناسباتكم الخاصة 🎂"
            className={cmsFieldClass}
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className={cmsLabelClass}>الوصف الفرعي والترويجي (Subtitle / Description)</span>
          <textarea
            rows={2}
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            placeholder="مثال: سواء كان حفل تخرج، عيد ميلاد، أو ذكرى مميزة.."
            className="w-full rounded-2xl border border-input bg-background p-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            required
          />
        </label>
      </div>

      <CmsImageField
        value={form.image_url}
        folder="banner"
        onChange={(url) => setForm({ ...form, image_url: url })}
        note="اختر صورة عالية الجودة للبانر من جهازك (سيتم تحويلها لـ WebP وتأطيرها تلقائياً)."
      />

      <div className="flex items-center justify-end border-t border-border/50 pt-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-60"
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          <span>💾 حفظ ونشر البانر على الموقع / Save & Publish</span>
        </button>
      </div>
    </form>
  );
}
