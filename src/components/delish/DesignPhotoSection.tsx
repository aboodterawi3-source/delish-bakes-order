import { useEffect, useRef, useState } from "react";
import { AlertCircle, ImageUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { convertToWebp, dataUrlToBlob, formatBytes } from "@/lib/image-webp";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import { deleteDesignImage, uploadDesignImage } from "@/lib/design-upload.functions";
import { parseDesignImageUrls, serializeDesignImageUrls } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type {
  CakeCustomizationErrors,
  Customization,
} from "@/components/delish/CakeCustomizationPanel";

/**
 * The reference-photo step on its own, so an order-entry screen can place it
 * directly under the order name instead of inside the cake customisation list.
 * Same markup, same state and same upload behaviour as the panel section.
 */
export function DesignPhotoSection({
  value,
  onChange,
  errors = {},
  onClearError,
}: {
  value: Customization;
  onChange: (next: Customization) => void;
  errors?: CakeCustomizationErrors;
  onClearError?: ((key: keyof CakeCustomizationErrors) => void) | undefined;
}) {
  const { lang } = useLang();
  const ar = lang === "ar";

  const clear = (key: keyof CakeCustomizationErrors) => {
    if (onClearError) onClearError(key);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedSize, setSavedSize] = useState<{ before: number; after: number } | null>(null);
  const upload = useServerFn(uploadDesignImage);
  const deleteImage = useServerFn(deleteDesignImage);

  const imageUrls = parseDesignImageUrls(value.designImageUrl);
  const [photoMode, setPhotoMode] = useState<"none" | "yes">(imageUrls.length > 0 ? "yes" : "none");

  useEffect(() => {
    setPhotoMode(imageUrls.length > 0 ? "yes" : "none");
  }, [imageUrls.length]);

  const deleteStoredUrl = (url: string) => {
    const token =
      typeof window !== "undefined" ? sessionStorage.getItem(`delish_photo_token_${url}`) : null;
    void deleteImage({ data: { url, deleteToken: token } }).catch(() => {});
  };

  const removeAllPhotos = () => {
    for (const url of imageUrls) {
      deleteStoredUrl(url);
    }
    onChange({ ...value, designImageUrl: null });
    setSavedSize(null);
    clear("photo");
  };

  const removePhotoAt = (index: number) => {
    const targetUrl = imageUrls[index];
    if (targetUrl) deleteStoredUrl(targetUrl);
    const nextUrls = imageUrls.filter((_, idx) => idx !== index);
    onChange({ ...value, designImageUrl: serializeDesignImageUrls(nextUrls) });
    if (nextUrls.length === 0) setSavedSize(null);
    clear("photo");
  };

  const uploadSingleFile = async (
    file: File,
  ): Promise<{ url: string; before: number; after: number }> => {
    const converted = await convertToWebp(file, {
      kind: "cake",
      maxDimension: 800,
      quality: 0.8,
    });

    let savedUrl: string | null = null;
    let deleteToken: string | null = null;

    if (typeof window !== "undefined") {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const session = (await supabase.auth.getSession()).data.session;
        if (session?.access_token) {
          const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.webp`;
          const blob = dataUrlToBlob(converted.dataUrl, "image/webp");
          const { data: uploadResult, error: uploadErr } = await supabase.storage
            .from("order-designs")
            .upload(path, blob, { contentType: "image/webp", upsert: false });

          if (!uploadErr && uploadResult?.path) {
            const { data: signed } = await supabase.storage
              .from("order-designs")
              .createSignedUrl(uploadResult.path, 60 * 60 * 24 * 365 * 5);
            if (signed?.signedUrl) {
              savedUrl = signed.signedUrl;
            }
          }
        }
      } catch {
        // Fall through to server upload
      }
    }

    if (!savedUrl) {
      const saved = await upload({
        data: {
          data_url: converted.dataUrl,
          previous_url: null,
          previous_deleteToken: null,
        },
      });
      savedUrl = saved.url;
      deleteToken = saved.deleteToken;
    }

    if (typeof window !== "undefined" && deleteToken && savedUrl) {
      sessionStorage.setItem(`delish_photo_token_${savedUrl}`, deleteToken);
    }
    return {
      url: savedUrl,
      before: converted.originalBytes,
      after: converted.bytes,
    };
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const remainingSlots = Math.max(0, 10 - imageUrls.length);
    if (remainingSlots === 0) {
      setUploadError(ar ? "الحد الأقصى هو 10 صور للطلب الواحد" : "Maximum 10 photos per order");
      return;
    }

    const files = Array.from(fileList).slice(0, remainingSlots);
    setUploadError(null);
    setUploading(true);
    try {
      const nextUrls = [...imageUrls];
      let totalBefore = 0;
      let totalAfter = 0;
      for (const file of files) {
        const uploaded = await uploadSingleFile(file);
        nextUrls.push(uploaded.url);
        totalBefore += uploaded.before;
        totalAfter += uploaded.after;
      }
      onChange({ ...value, designImageUrl: serializeDesignImageUrls(nextUrls) });
      setSavedSize({ before: totalBefore, after: totalAfter });
      clear("photo");
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : ar ? "تعذّر رفع الصورة" : "Upload failed",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div
      id="custom-field-photo"
      className={`rounded-2xl border p-3.5 transition-all ${
        errors?.photo ? "border-red-400 bg-red-50/30" : "border-slate-200/90 bg-white shadow-2xs"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-xs font-bold text-[#3E2723]">
          {ar ? "صور مرجعية للتصميم" : "Reference Design Photos"}
        </label>
        <span className="text-[11px] text-muted-foreground">
          {imageUrls.length > 0
            ? ar
              ? `${imageUrls.length} / 10 صور مرفقة`
              : `${imageUrls.length} / 10 attached`
            : ar
              ? "اختياري (يدعم عدة صور)"
              : "Optional (multiple allowed)"}
        </span>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setPhotoMode("none");
            removeAllPhotos();
          }}
          className={`min-h-11 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            photoMode === "none"
              ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
              : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
          }`}
        >
          {ar ? "التصميم الأصلي" : "Original Design"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPhotoMode("yes");
          }}
          className={`min-h-11 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            photoMode === "yes"
              ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
              : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
          }`}
        >
          {ar ? "📷 إرفاق صور خاصة" : "📷 Upload Photos"}
        </button>
      </div>

      {photoMode === "yes" && (
        <div
          className={`rounded-xl border bg-[#F9FBFC] p-3.5 ${
            errors?.photo ? "border-red-400 bg-red-50/20" : "border-slate-200"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            className="sr-only"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          {imageUrls.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {imageUrls.map((url, idx) => (
                  <div
                    key={url}
                    className="group relative overflow-hidden rounded-xl border border-amber-200 bg-white shadow-2xs"
                  >
                    <img
                      src={url}
                      alt={ar ? `التصميم المرجعي ${idx + 1}` : `Reference design ${idx + 1}`}
                      className="h-32 w-full object-cover"
                    />
                    <span className="absolute top-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePhotoAt(idx)}
                      title={ar ? "إزالة هذه الصورة" : "Remove this photo"}
                      className="absolute bottom-1.5 left-1.5 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-white/95 px-2 py-1 text-[11px] font-bold text-red-600 shadow-xs hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      {ar ? "حذف" : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
              {savedSize && (
                <p className="text-[11px] text-[#5A4A42]">
                  {ar
                    ? `تم تحسين الصور: ${formatBytes(savedSize.before)} ← ${formatBytes(savedSize.after)} WebP`
                    : `Optimized: ${formatBytes(savedSize.before)} → ${formatBytes(savedSize.after)} WebP`}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {imageUrls.length < 10 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#B8860B] bg-white px-3 py-1.5 text-xs font-bold text-[#7B3F00] hover:bg-amber-50 disabled:opacity-60"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {uploading
                      ? ar
                        ? "جاري رفع الصور..."
                        : "Uploading..."
                      : ar
                        ? "إضافة صور أخرى"
                        : "Add more photos"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={removeAllPhotos}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {ar ? "إزالة الكل" : "Remove All"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-[#B8860B] bg-white p-5 text-[#7B3F00] transition hover:bg-amber-50/50 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <ImageUp className="h-6 w-6" />
              )}
              <span className="text-xs font-bold">
                {uploading
                  ? ar
                    ? "جاري تحسين ورفع الصور..."
                    : "Optimizing & uploading..."
                  : ar
                    ? "اضغط هنا لاختيار صورة أو أكثر للكيكة المطلوبة (JPG, PNG, WebP)"
                    : "Click to select one or more cake design photos"}
              </span>
            </button>
          )}

          {uploadError && <p className="mt-2 text-xs font-semibold text-red-600">{uploadError}</p>}
        </div>
      )}

      {errors?.photo ? (
        <p className="mt-1.5 flex animate-pulse items-center gap-1 text-xs font-bold text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errors.photo}
        </p>
      ) : null}
    </div>
  );
}
