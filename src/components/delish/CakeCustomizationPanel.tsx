import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Check, ImageUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { convertToWebp, formatBytes } from "@/lib/image-webp";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import { deleteDesignImage, uploadDesignImage } from "@/lib/design-upload.functions";
import { parseDesignImageUrls, serializeDesignImageUrls } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

/** One balloon colour with its own count; several may be combined. */
export type BalloonPick = { id: string; label: string; qty: number };

export type Customization = {
  /** Chosen cake filling (e.g. Nutella, Lotus, Pistachio). */
  filling: string;
  /** Explicit staff/customer choice for candles (null when not chosen yet). */
  candleChoice?: "none" | "standard" | "number" | "both" | null;
  /** Both candle kinds may be chosen at the same time, each with its own input. */
  standardCandles: boolean;
  candleQty: number;
  numberCandles: boolean;
  candleDigits: string;
  numberCandleQty: number;
  /** Explicit choice for balloons (null when not chosen yet). */
  balloonChoice?: "none" | "yes" | null;
  balloons: boolean;
  /** Multi-colour selection: any number of colours, each with a count. */
  balloonPicks: BalloonPick[];
  balloonNotes: string;
  /** Explicit choice for acrylic topper (null when not chosen yet). */
  topperChoice?: "none" | "yes" | null;
  topper: boolean;
  topperText: string;
  gift: boolean;
  senderPhone: string;
  recipientPhone: string;
  notes: string;
  designImageUrl: string | null;
};

export const emptyCustomization: Customization = {
  filling: "",
  candleChoice: null,
  standardCandles: false,
  candleQty: 1,
  numberCandles: false,
  candleDigits: "",
  numberCandleQty: 1,
  balloonChoice: null,
  balloons: false,
  balloonPicks: [],
  balloonNotes: "",
  topperChoice: null,
  topper: false,
  topperText: "",
  gift: false,
  senderPhone: "",
  recipientPhone: "",
  notes: "",
  designImageUrl: null,
};

/** Bilingual lines describing the picked extras; shown to staff on the order. */
export function customizationSummary(c: Customization) {
  const ar: string[] = [];
  const en: string[] = [];

  if (c.filling && c.filling.trim()) {
    ar.push(`الحشوة: ${c.filling.trim()}`);
    en.push(`Filling: ${c.filling.trim()}`);
  }
  if (c.standardCandles || c.numberCandles) {
    if (c.candleDigits.trim()) {
      ar.push(`شموع: ${c.candleDigits.trim()}`);
      en.push(`Candles: ${c.candleDigits.trim()}`);
    } else {
      ar.push("شموع: مطلوبة");
      en.push("Candles: requested");
    }
  }
  if (c.balloons) {
    const picks = c.balloonPicks.filter((p) => p.qty > 0);
    if (picks.length > 0) {
      const list = picks.map((p) => `${p.label} × ${p.qty}`).join(" + ");
      ar.push(`بالونات: ${list}`);
      en.push(`Balloons: ${list}`);
    }
    if (c.balloonNotes.trim()) {
      ar.push(`بالونات إضافية: ${c.balloonNotes.trim()}`);
      en.push(`Extra balloons: ${c.balloonNotes.trim()}`);
    }
    if (picks.length === 0 && !c.balloonNotes.trim()) {
      ar.push("بالونات: مطلوبة");
      en.push("Balloons: requested");
    }
  }
  if (c.topper) {
    if (c.topperText.trim()) {
      ar.push(`توبر أكريليك: ${c.topperText.trim()}`);
      en.push(`Acrylic topper: ${c.topperText.trim()}`);
    } else {
      ar.push("توبر أكريليك: مطلوب");
      en.push("Acrylic topper: requested");
    }
  }
  if (c.gift) {
    ar.push("هدية: نعم");
    en.push("Gift: yes");
    if (c.senderPhone.trim()) {
      ar.push(`هاتف المُرسل: ${c.senderPhone.trim()}`);
      en.push(`Sender phone: ${c.senderPhone.trim()}`);
    }
    if (c.recipientPhone.trim()) {
      ar.push(`هاتف المُستلم: ${c.recipientPhone.trim()}`);
      en.push(`Recipient phone: ${c.recipientPhone.trim()}`);
    }
  }
  if (c.designImageUrl) {
    ar.push("صورة مرجعية: مرفقة");
    en.push("Reference photo: attached");
  }
  return { ar, en };
}

export type CakeCustomizationErrors = {
  filling?: string;
  candles?: string;
  balloons?: string;
  topper?: string;
  photo?: string;
  notes?: string;
};

const baseInputClass =
  "mt-1 w-full rounded-xl px-3.5 text-sm text-[#3E2723] transition-all outline-none";

const normalInputClass = `${baseInputClass} min-h-11 border border-slate-200 bg-[#F9FBFC] focus:border-[#B8860B] focus:bg-white focus:ring-2 focus:ring-[#B8860B]/20`;

const errorInputClass = `${baseInputClass} min-h-11 border-2 border-red-500 bg-red-50/50 ring-2 ring-red-200 focus:border-red-600 focus:bg-red-50/70 focus:ring-red-300`;

export function CakeCustomizationPanel({
  value,
  onChange,
  hideGift = false,
  hidePhoto = false,
  errors = {},
  onClearError,
}: {
  value: Customization;
  onChange: (next: Customization) => void;
  hideGift?: boolean;
  hidePhoto?: boolean;
  errors?: CakeCustomizationErrors;
  onClearError?: (key: keyof CakeCustomizationErrors) => void;
}) {
  const { lang } = useLang();
  const ar = lang === "ar";

  const set = <K extends keyof Customization>(key: K, next: Customization[K]) =>
    onChange({ ...value, [key]: next });

  const clear = (key: keyof CakeCustomizationErrors) => {
    if (onClearError) onClearError(key);
  };

  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center justify-between border-b border-[#FDE2CF]/80 pb-2.5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#5D2E17]">
          <Sparkles className="h-4 w-4 text-[#B8860B]" />
          <span>{ar ? "تخصيص الكيكة والإضافات" : "Customization & Add-ons"}</span>
        </h3>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-[#8B4513]">
          {ar ? "إجباري *" : "Required *"}
        </span>
      </div>

      {/* 1. CAKE FILLING */}
      <div
        id="custom-field-filling"
        className={`rounded-2xl border p-3.5 transition-all ${
          errors?.filling
            ? "border-red-400 bg-red-50/30"
            : "border-slate-200/90 bg-white shadow-2xs"
        }`}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="field-input-filling" className="block text-xs font-bold text-[#3E2723]">
            {ar ? "نوع الحشوة المفضلة" : "Preferred Filling"}
          </label>
          {value.filling.trim() ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> {ar ? "تم التحديد" : "Selected"}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-[#8B4513]">
              {ar ? "إجباري *" : "Required *"}
            </span>
          )}
        </div>

        <input
          id="field-input-filling"
          type="text"
          value={value.filling}
          onChange={(e) => {
            set("filling", e.target.value);
            if (e.target.value.trim()) clear("filling");
          }}
          placeholder={
            ar ? "اكتب نوع الحشوة المطلوبة بالتفصيل..." : "Type preferred filling details..."
          }
          className={errors?.filling ? errorInputClass : normalInputClass}
        />

        {errors?.filling ? (
          <p className="mt-1.5 flex animate-pulse items-center gap-1 text-xs font-bold text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.filling}
          </p>
        ) : null}
      </div>

      {/* 2. CANDLES */}
      <div
        id="custom-field-candles"
        className={`rounded-2xl border p-3.5 transition-all ${
          errors?.candles
            ? "border-red-400 bg-red-50/30"
            : "border-slate-200/90 bg-white shadow-2xs"
        }`}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="field-input-candles" className="block text-xs font-bold text-[#3E2723]">
            {ar ? "شموع الاحتفال" : "Celebration Candles"}
          </label>
          {value.candleDigits.trim() ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> {ar ? "تم التحديد" : "Selected"}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-[#8B4513]">
              {ar ? "إجباري *" : "Required *"}
            </span>
          )}
        </div>

        <input
          id="field-input-candles"
          type="text"
          value={value.candleDigits}
          onChange={(e) => {
            const next = e.target.value;
            const hasVal = Boolean(next.trim());
            onChange({
              ...value,
              candleChoice: hasVal ? "standard" : null,
              standardCandles: hasVal,
              numberCandles: false,
              candleDigits: next,
            });
            if (hasVal) clear("candles");
          }}
          maxLength={120}
          placeholder={
            ar ? "اكتب تفاصيل الشموع (أو اكتب: بدون)..." : "Type candle details (or type: none)..."
          }
          className={errors?.candles ? errorInputClass : normalInputClass}
        />

        {errors?.candles ? (
          <p className="mt-1.5 flex animate-pulse items-center gap-1 text-xs font-bold text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.candles}
          </p>
        ) : null}
      </div>

      {/* 3. BALLOONS */}
      <div
        id="custom-field-balloons"
        className={`rounded-2xl border p-3.5 transition-all ${
          errors?.balloons
            ? "border-red-400 bg-red-50/30"
            : "border-slate-200/90 bg-white shadow-2xs"
        }`}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="field-input-balloons" className="block text-xs font-bold text-[#3E2723]">
            {ar ? "بالونات هيليوم" : "Helium Balloons"}
          </label>
          {value.balloonNotes.trim() ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> {ar ? "تم التحديد" : "Selected"}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-[#8B4513]">
              {ar ? "إجباري *" : "Required *"}
            </span>
          )}
        </div>

        <input
          id="field-input-balloons"
          type="text"
          value={value.balloonNotes}
          onChange={(e) => {
            const next = e.target.value;
            const hasVal = Boolean(next.trim());
            onChange({
              ...value,
              balloonChoice: hasVal ? "yes" : null,
              balloons: hasVal,
              balloonPicks: [],
              balloonNotes: next,
            });
            if (hasVal) clear("balloons");
          }}
          maxLength={120}
          placeholder={
            ar
              ? "اكتب تفاصيل البالونات (أو اكتب: بدون)..."
              : "Type balloon details (or type: none)..."
          }
          className={errors?.balloons ? errorInputClass : normalInputClass}
        />

        {errors?.balloons ? (
          <p className="mt-1.5 flex animate-pulse items-center gap-1 text-xs font-bold text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.balloons}
          </p>
        ) : null}
      </div>

      {/* 4. ACRYLIC TOPPER */}
      <div
        id="custom-field-topper"
        className={`rounded-2xl border p-3.5 transition-all ${
          errors?.topper ? "border-red-400 bg-red-50/30" : "border-slate-200/90 bg-white shadow-2xs"
        }`}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="field-input-topper" className="block text-xs font-bold text-[#3E2723]">
            {ar ? "توبر أكريليك احتفالي" : "Acrylic Cake Topper"}
          </label>
          {value.topperText.trim() ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> {ar ? "تم التحديد" : "Selected"}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-[#8B4513]">
              {ar ? "إجباري *" : "Required *"}
            </span>
          )}
        </div>

        <input
          id="field-input-topper"
          type="text"
          value={value.topperText}
          onChange={(e) => {
            const next = e.target.value;
            const hasVal = Boolean(next.trim());
            onChange({
              ...value,
              topperChoice: hasVal ? "yes" : null,
              topper: hasVal,
              topperText: next,
            });
            if (hasVal) clear("topper");
          }}
          maxLength={60}
          placeholder={
            ar ? "اكتب عبارة التوبر المطلوبة (أو اكتب: بدون)…" : "Type topper text (or type: none)…"
          }
          className={errors?.topper ? errorInputClass : normalInputClass}
        />

        {errors?.topper ? (
          <p className="mt-1.5 flex animate-pulse items-center gap-1 text-xs font-bold text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.topper}
          </p>
        ) : null}
      </div>

      {/* 5. REFERENCE PHOTO — hosted by the screen when hidePhoto is set */}
      {!hidePhoto && (
        <DesignPhotoSection
          value={value}
          onChange={onChange}
          errors={errors}
          onClearError={onClearError}
        />
      )}

      {/* 6. GIFT */}
      {!hideGift && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="block text-xs font-bold text-[#3E2723]">
              {ar ? "إرسال كهدية لشخص عزيز" : "Send as a Gift"}
            </span>
            <span className="text-[11px] text-muted-foreground">{ar ? "اختياري" : "Optional"}</span>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                onChange({ ...value, gift: false, senderPhone: "", recipientPhone: "" })
              }
              className={`min-h-11 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                !value.gift
                  ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                  : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
              }`}
            >
              {ar ? "طلب عادي" : "Standard Order"}
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...value, gift: true })}
              className={`min-h-11 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                value.gift
                  ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                  : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
              }`}
            >
              {ar ? "🎁 إرسال كهدية" : "🎁 Send as Gift"}
            </button>
          </div>

          {value.gift && (
            <div className="mt-2 grid gap-2.5 rounded-xl border border-slate-200 bg-[#F9FBFC] p-2.5 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-[#3E2723]">
                  {ar ? "هاتف المُرسل:" : "Sender Phone:"}
                </span>
                <input
                  inputMode="tel"
                  value={value.senderPhone}
                  onChange={(e) => set("senderPhone", e.target.value.replace(/[^0-9+\s-]/g, ""))}
                  maxLength={25}
                  placeholder="07 9xxx xxxx"
                  className={normalInputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-[#3E2723]">
                  {ar ? "هاتف المُستلم:" : "Recipient Phone:"}
                </span>
                <input
                  inputMode="tel"
                  value={value.recipientPhone}
                  onChange={(e) => set("recipientPhone", e.target.value.replace(/[^0-9+\s-]/g, ""))}
                  maxLength={25}
                  placeholder="07 9xxx xxxx"
                  className={normalInputClass}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

    // When staff is logged in, try direct authenticated storage upload first for instant response:
    if (typeof window !== "undefined") {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const session = (await supabase.auth.getSession()).data.session;
        if (session?.access_token) {
          const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.webp`;
          const parts = converted.dataUrl.split(",");
          const bstr = atob(parts[1] || "");
          const u8arr = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) {
            u8arr[i] = bstr.charCodeAt(i);
          }
          const blob = new Blob([u8arr], { type: "image/webp" });
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
