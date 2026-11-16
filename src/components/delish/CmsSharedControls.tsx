import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadSiteImage } from "@/lib/cms.functions";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import { convertToWebp, formatBytes } from "@/lib/image-webp";
import { PRIORITY_OPTIONS, type PriorityColor } from "@/lib/priority";
import { TINTS } from "@/lib/storefront-content";

export const CMS_KEY = ["cms-content"] as const;

export const cmsFieldClass =
  "min-h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const cmsLabelClass = "block text-xs font-bold text-foreground";
export const cmsPrimaryBtnClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition disabled:opacity-60";
export const cmsGhostBtnClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 text-xs font-bold text-foreground transition hover:bg-secondary/40";

/** CMS image upload control converting selected files to WebP before storage upload. */
export function CmsImageField({
  value,
  folder,
  onChange,
  note: hint,
}: {
  value: string | null;
  folder: "banner" | "categories" | "products";
  onChange: (url: string | null) => void;
  note?: string;
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
        const isBanner = folder === "banner";
        const converted = await convertToWebp(file, {
          kind: isBanner ? "banner" : "product",
          maxDimension: isBanner ? 1200 : 800,
          quality: 0.8,
        });
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
      <span className={cmsLabelClass}>الصورة · Image</span>
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cmsGhostBtnClass}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden />
          )}
          {busy ? "جار الرفع…" : "رفع صورة · Upload"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className={cmsGhostBtnClass}>
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
        className={cmsFieldClass}
      />
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] font-bold text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Optional kitchen priority. Left empty, the kitchen falls back to the
 * category's priority and finally to the base (soft green) tier.
 */
export function CmsPriorityPicker({
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
      <span className={cmsLabelClass}>أولوية المطبخ (اختياري) · Kitchen priority</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange((event.target.value || null) as PriorityColor | null)}
        className={cmsFieldClass}
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

/** Palette tint selector shared between CMS category and product dialogs. */
export function CmsTintPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (tint: string) => void;
}) {
  return (
    <div className="space-y-2">
      <span className={cmsLabelClass}>لون البطاقة · Card tint</span>
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
