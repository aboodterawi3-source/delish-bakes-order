import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ImageUp,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { convertToWebp, formatBytes } from "@/lib/image-webp";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import { uploadDesignImage } from "@/lib/design-upload.functions";

/** One balloon colour with its own count; several may be combined. */
export type BalloonPick = { id: string; label: string; qty: number };

export type Customization = {
  /** Chosen cake filling (e.g. Nutella, Lotus, Pistachio). */
  filling: string;
  /** Both candle kinds may be chosen at the same time, each with its own input. */
  standardCandles: boolean;
  candleQty: number;
  numberCandles: boolean;
  candleDigits: string;
  numberCandleQty: number;
  balloons: boolean;
  /** Multi-colour selection: any number of colours, each with a count. */
  balloonPicks: BalloonPick[];
  balloonNotes: string;
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
  standardCandles: false,
  candleQty: 1,
  numberCandles: false,
  candleDigits: "",
  numberCandleQty: 1,
  balloons: false,
  balloonPicks: [],
  balloonNotes: "",
  topper: false,
  topperText: "",
  gift: false,
  senderPhone: "",
  recipientPhone: "",
  notes: "",
  designImageUrl: null,
};

const POPULAR_FILLINGS = [
  "نوتيلا وبندق",
  "لوتس كراميل",
  "فستق حلبي",
  "شوكولاتة بلجيكية",
  "فراولة طازجة وكريمة",
  "فانيلا كلاسيك",
  "كراميل مملح",
  "أوريو وكريمة",
  "رد فيلفت وجبنة",
];

const BALLOON_COLORS = [
  { id: "gold", ar: "ذهبي", en: "Gold", swatch: "#B8860B" },
  { id: "peach", ar: "خوخي", en: "Peach", swatch: "#FDE2CF" },
  { id: "rose", ar: "وردي", en: "Rose", swatch: "#E8A0BF" },
  { id: "sky", ar: "سماوي", en: "Sky blue", swatch: "#9CC7E8" },
  { id: "white", ar: "أبيض", en: "White", swatch: "#F8F8F6" },
  { id: "chocolate", ar: "بني", en: "Chocolate", swatch: "#8B4513" },
];

/** Bilingual lines describing the picked extras; shown to staff on the order. */
export function customizationSummary(c: Customization) {
  const ar: string[] = [];
  const en: string[] = [];

  if (c.filling && c.filling.trim()) {
    ar.push(`الحشوة: ${c.filling.trim()}`);
    en.push(`Filling: ${c.filling.trim()}`);
  }
  if (c.standardCandles) {
    ar.push(`شموع عادية: ${c.candleQty}`);
    en.push(`Standard candles: ${c.candleQty}`);
  }
  if (c.numberCandles && c.candleDigits.trim()) {
    ar.push(`شموع أرقام: ${c.candleDigits.trim()} × ${c.numberCandleQty}`);
    en.push(`Number candles: ${c.candleDigits.trim()} × ${c.numberCandleQty}`);
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
  if (c.topper && c.topperText.trim()) {
    ar.push(`توبر أكريليك: ${c.topperText.trim()}`);
    en.push(`Acrylic topper: ${c.topperText.trim()}`);
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

function Counter({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="inline-flex items-center rounded-full bg-[#8B4513] px-2.5 py-1 text-white shadow-sm">
      <button
        type="button"
        aria-label={`${label} −`}
        onClick={() => onChange(Math.max(1, value - 1))}
        className="p-1 transition hover:text-amber-200 active:scale-90"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="px-2 text-xs font-bold">{value}</span>
      <button
        type="button"
        aria-label={`${label} +`}
        onClick={() => onChange(Math.min(99, value + 1))}
        className="p-1 transition hover:text-amber-200 active:scale-90"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const baseInputClass =
  "mt-1 w-full rounded-xl px-3.5 text-sm text-[#3E2723] transition-all outline-none";

const normalInputClass = `${baseInputClass} min-h-12 border border-slate-200 bg-[#F9FBFC] focus:border-[#B8860B] focus:bg-white focus:ring-2 focus:ring-[#B8860B]/20`;

const errorInputClass = `${baseInputClass} min-h-12 border-2 border-red-500 bg-red-50/50 ring-2 ring-red-200 focus:border-red-600 focus:bg-red-50/70 focus:ring-red-300`;

const normalTextareaClass = `${baseInputClass} border border-slate-200 bg-[#F9FBFC] p-3 text-sm focus:border-[#B8860B] focus:bg-white focus:ring-2 focus:ring-[#B8860B]/20`;

const errorTextareaClass = `${baseInputClass} border-2 border-red-500 bg-red-50/50 p-3 text-sm ring-2 ring-red-200 focus:border-red-600 focus:bg-red-50/70 focus:ring-red-300`;

export function CakeCustomizationPanel({
  value,
  onChange,
  hideGift = false,
  errors = {},
  onClearError,
}: {
  value: Customization;
  onChange: (next: Customization) => void;
  hideGift?: boolean;
  errors?: CakeCustomizationErrors;
  onClearError?: (key: keyof CakeCustomizationErrors) => void;
}) {
  const set = <K extends keyof Customization>(key: K, next: Customization[K]) =>
    onChange({ ...value, [key]: next });

  const clear = (key: keyof CakeCustomizationErrors) => {
    if (onClearError) onClearError(key);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedSize, setSavedSize] = useState<{ before: number; after: number } | null>(null);
  const upload = useServerFn(uploadDesignImage);

  // Derive active modes
  const candleMode =
    value.standardCandles && value.numberCandles
      ? "both"
      : value.standardCandles
        ? "standard"
        : value.numberCandles
          ? "number"
          : "none";

  const [balloonMode, setBalloonMode] = useState<"none" | "yes">(value.balloons ? "yes" : "none");
  const [topperMode, setTopperMode] = useState<"none" | "yes">(value.topper ? "yes" : "none");
  const [photoMode, setPhotoMode] = useState<"none" | "yes">(value.designImageUrl ? "yes" : "none");

  // Keep the three yes/no switches in step with the values the parent owns, so a
  // reset, a prefilled order or a product switch cannot leave a confirmed "no
  // balloons" line sitting next to balloons the customer asked for.
  useEffect(() => {
    setBalloonMode(value.balloons ? "yes" : "none");
  }, [value.balloons]);
  useEffect(() => {
    setTopperMode(value.topper ? "yes" : "none");
  }, [value.topper]);
  useEffect(() => {
    setPhotoMode(value.designImageUrl ? "yes" : "none");
  }, [value.designImageUrl]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const converted = await convertToWebp(file);
      const saved = await upload({ data: { data_url: converted.dataUrl } });
      onChange({ ...value, designImageUrl: saved.url });
      setSavedSize({ before: converted.originalBytes, after: converted.bytes });
      clear("photo");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "تعذّر رفع الصورة · Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      {/* SECTION HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#FDE2CF] pb-2.5">
        <h3 className="flex items-center gap-2 font-bold text-sm text-[#5D2E17]">
          <Sparkles className="h-4 w-4 text-[#B8860B]" />
          تخصيص الكيكة والإضافات · Cake Customization
        </h3>
        <span className="rounded-full bg-amber-100/80 px-2.5 py-0.5 text-[11px] font-bold text-[#8B4513]">
          جميع الخانات إجبارية للتأكيد *
        </span>
      </div>

      {/* 1. CAKE FILLING */}
      <div
        id="custom-field-filling"
        className={`rounded-2xl border p-4 transition-all ${
          errors?.filling ? "border-red-400 bg-red-50/30 shadow-xs" : "border-slate-200/90 bg-white"
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="field-input-filling" className="block text-sm font-bold text-[#3E2723]">
            نوع الحشوة · Cake Filling <span className="text-red-500">*</span>
          </label>
          {value.filling.trim() ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> تم التحديد
            </span>
          ) : (
            <span className="text-[11px] font-bold text-red-600">إجباري *</span>
          )}
        </div>

        {/* Quick filling selection pills */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-[#7A6458]">اقتراحات سريعة:</span>
          {POPULAR_FILLINGS.map((fill) => {
            const isSelected = value.filling === fill;
            return (
              <button
                key={fill}
                type="button"
                onClick={() => {
                  set("filling", fill);
                  clear("filling");
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                  isSelected
                    ? "border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                    : "border-slate-200 bg-white text-[#5D2E17] hover:bg-amber-50"
                }`}
              >
                {fill}
              </button>
            );
          })}
        </div>

        {/* Input box */}
        <input
          id="field-input-filling"
          type="text"
          value={value.filling}
          onChange={(e) => {
            set("filling", e.target.value);
            if (e.target.value.trim()) clear("filling");
          }}
          placeholder="اكتب نوع الحشوة المطلوبة بالتفصيل (أو اختر من الاقتراحات أعلاه)…"
          className={errors?.filling ? errorInputClass : normalInputClass}
        />

        {errors?.filling ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600 animate-pulse">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.filling}
          </p>
        ) : null}
      </div>

      {/* 2. CANDLES */}
      <div
        id="custom-field-candles"
        className={`rounded-2xl border p-4 transition-all ${
          errors?.candles ? "border-red-400 bg-red-50/30 shadow-xs" : "border-slate-200/90 bg-white"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-bold text-[#3E2723]">
            الشموع · Candles <span className="text-red-500">*</span>
          </label>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
            إجباري *
          </span>
        </div>

        {/* Choice buttons */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-2.5">
          {[
            { id: "none", label: "🚫 بدون شموع" },
            { id: "standard", label: "🕯️ شموع عادية" },
            { id: "number", label: "🔢 شموع أرقام" },
            { id: "both", label: "✨ عادية + أرقام" },
          ].map((opt) => {
            const active = candleMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (opt.id === "none") {
                    onChange({
                      ...value,
                      standardCandles: false,
                      numberCandles: false,
                      candleDigits: "",
                    });
                  } else if (opt.id === "standard") {
                    onChange({
                      ...value,
                      standardCandles: true,
                      numberCandles: false,
                      candleQty: value.candleQty || 1,
                    });
                  } else if (opt.id === "number") {
                    onChange({
                      ...value,
                      standardCandles: false,
                      numberCandles: true,
                      numberCandleQty: value.numberCandleQty || 1,
                    });
                  } else {
                    onChange({
                      ...value,
                      standardCandles: true,
                      numberCandles: true,
                      candleQty: value.candleQty || 1,
                      numberCandleQty: value.numberCandleQty || 1,
                    });
                  }
                  clear("candles");
                }}
                className={`min-h-11 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                    : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {candleMode === "none" && (
          <div className="rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 text-xs font-semibold text-slate-600">
            ✓ تم تأكيد الاختيار: طلب الكيكة بدون شموع.
          </div>
        )}

        {value.standardCandles && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 my-2">
            <span className="text-xs font-bold text-[#3E2723]">عدد الشموع العادية:</span>
            <Counter
              value={value.candleQty}
              onChange={(n) => set("candleQty", n)}
              label="Candles"
            />
          </div>
        )}

        {value.numberCandles && (
          <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 my-2">
            <div>
              <label className="block text-xs font-bold text-[#3E2723] mb-1">
                أرقام الشموع المطلوبة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={value.candleDigits}
                onChange={(e) => {
                  set("candleDigits", e.target.value.replace(/[^0-9]/g, ""));
                  if (e.target.value.trim()) clear("candles");
                }}
                placeholder="مثال: 25 أو 18"
                className={errors?.candles ? errorInputClass : normalInputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#3E2723] mb-1">عدد الأطقم:</label>
              <div className="pt-2">
                <Counter
                  value={value.numberCandleQty}
                  onChange={(n) => set("numberCandleQty", n)}
                  label="Number candles"
                />
              </div>
            </div>
          </div>
        )}

        {errors?.candles ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600 animate-pulse">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.candles}
          </p>
        ) : null}
      </div>

      {/* 3. BALLOONS */}
      <div
        id="custom-field-balloons"
        className={`rounded-2xl border p-4 transition-all ${
          errors?.balloons
            ? "border-red-400 bg-red-50/30 shadow-xs"
            : "border-slate-200/90 bg-white"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-bold text-[#3E2723]">
            البالونات · Balloons <span className="text-red-500">*</span>
          </label>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
            إجباري *
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <button
            type="button"
            onClick={() => {
              setBalloonMode("none");
              onChange({ ...value, balloons: false, balloonPicks: [], balloonNotes: "" });
              clear("balloons");
            }}
            className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              balloonMode === "none"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            🚫 بدون بالونات
          </button>
          <button
            type="button"
            onClick={() => {
              setBalloonMode("yes");
              onChange({ ...value, balloons: true });
            }}
            className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              balloonMode === "yes"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            🎈 إضافة بالونات
          </button>
        </div>

        {balloonMode === "none" ? (
          <div className="rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 text-xs font-semibold text-slate-600">
            ✓ تم تأكيد الاختيار: طلب الكيكة بدون بالونات.
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-[#F9FBFC] p-3.5">
            <span className="block text-xs font-bold text-[#3E2723]">
              اختر ألوان البالونات المطلوبة:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {BALLOON_COLORS.map((color) => {
                const label = `${color.en} / ${color.ar}`;
                const selected = value.balloonPicks.some((p) => p.id === color.id);
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => {
                      const nextPicks = selected
                        ? value.balloonPicks.filter((p) => p.id !== color.id)
                        : [...value.balloonPicks, { id: color.id, label, qty: 1 }];
                      set("balloonPicks", nextPicks);
                      if (nextPicks.length > 0 || value.balloonNotes.trim()) clear("balloons");
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? "border-[#8B4513] bg-[#8B4513] text-white"
                        : "border-slate-200 bg-white text-[#5A4A42] hover:bg-amber-50"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: color.swatch }}
                    />
                    {color.ar} ({color.en})
                  </button>
                );
              })}
            </div>

            {value.balloonPicks.length > 0 && (
              <ul className="space-y-1.5 border-t border-slate-200 pt-2">
                {value.balloonPicks.map((pick) => (
                  <li
                    key={pick.id}
                    className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-[#3E2723]"
                  >
                    <span>{pick.label}</span>
                    <div className="flex items-center gap-2">
                      <Counter
                        value={pick.qty}
                        onChange={(n) =>
                          set(
                            "balloonPicks",
                            value.balloonPicks.map((p) =>
                              p.id === pick.id ? { ...p, qty: n } : p,
                            ),
                          )
                        }
                        label={pick.label}
                      />
                      <button
                        type="button"
                        aria-label={`حذف ${pick.label}`}
                        onClick={() =>
                          set(
                            "balloonPicks",
                            value.balloonPicks.filter((p) => p.id !== pick.id),
                          )
                        }
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label className="block text-xs font-bold text-[#3E2723] mb-1">
                ألوان أو تفاصيل بالونات إضافية:
              </label>
              <input
                type="text"
                value={value.balloonNotes}
                onChange={(e) => {
                  set("balloonNotes", e.target.value);
                  if (e.target.value.trim() || value.balloonPicks.length > 0) clear("balloons");
                }}
                placeholder="مثال: 5 بالونات هيليوم بلون مميز أو كروم..."
                className={normalInputClass}
              />
            </div>
          </div>
        )}

        {errors?.balloons ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600 animate-pulse">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.balloons}
          </p>
        ) : null}
      </div>

      {/* 4. ACRYLIC TOPPER */}
      <div
        id="custom-field-topper"
        className={`rounded-2xl border p-4 transition-all ${
          errors?.topper ? "border-red-400 bg-red-50/30 shadow-xs" : "border-slate-200/90 bg-white"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="field-input-topper" className="block text-sm font-bold text-[#3E2723]">
            توبر الأكريليك · Acrylic Topper <span className="text-red-500">*</span>
          </label>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
            إجباري *
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <button
            type="button"
            onClick={() => {
              setTopperMode("none");
              onChange({ ...value, topper: false, topperText: "" });
              clear("topper");
            }}
            className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              topperMode === "none"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            🚫 بدون توبر
          </button>
          <button
            type="button"
            onClick={() => {
              setTopperMode("yes");
              onChange({ ...value, topper: true });
            }}
            className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              topperMode === "yes"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            ✨ إضافة توبر أكريليك
          </button>
        </div>

        {topperMode === "none" ? (
          <div className="rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 text-xs font-semibold text-slate-600">
            ✓ تم تأكيد الاختيار: طلب الكيكة بدون توبر أكريليك.
          </div>
        ) : (
          <div className="space-y-1">
            <input
              id="field-input-topper"
              type="text"
              value={value.topperText}
              onChange={(e) => {
                set("topperText", e.target.value);
                if (e.target.value.trim()) clear("topper");
              }}
              maxLength={60}
              placeholder="اكتب العبارة أو الاسم المطلوب على التوبر (مثال: Happy Birthday Sarah)…"
              className={errors?.topper ? errorInputClass : normalInputClass}
            />
          </div>
        )}

        {errors?.topper ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600 animate-pulse">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.topper}
          </p>
        ) : null}
      </div>

      {/* 5. REFERENCE PHOTO */}
      <div
        id="custom-field-photo"
        className={`rounded-2xl border p-4 transition-all ${
          errors?.photo ? "border-red-400 bg-red-50/30 shadow-xs" : "border-slate-200/90 bg-white"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-bold text-[#3E2723]">
            الصورة المرجعية للتصميم · Reference Photo <span className="text-red-500">*</span>
          </label>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
            إجباري *
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <button
            type="button"
            onClick={() => {
              setPhotoMode("none");
              onChange({ ...value, designImageUrl: null });
              setSavedSize(null);
              clear("photo");
            }}
            className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              photoMode === "none"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            🚫 بدون صورة مرجعية
          </button>
          <button
            type="button"
            onClick={() => {
              setPhotoMode("yes");
            }}
            className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              photoMode === "yes"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            📷 إرفاق صورة تصميم
          </button>
        </div>

        {photoMode === "none" ? (
          <div className="rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 text-xs font-semibold text-slate-600">
            ✓ تم تأكيد الاختيار: طلب الكيك بالتصميم القياسي المتوفر (بدون صورة خاصة).
          </div>
        ) : (
          <div
            className={`rounded-xl border p-4 bg-[#F9FBFC] ${
              errors?.photo ? "border-red-400 bg-red-50/20" : "border-slate-200"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="sr-only"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            {value.designImageUrl ? (
              <div className="space-y-2">
                <img
                  src={value.designImageUrl}
                  alt="التصميم المرجعي"
                  className="max-h-56 w-full rounded-xl object-cover border border-amber-200"
                />
                {savedSize && (
                  <p className="text-[11px] text-[#5A4A42]">
                    تم ضغط الصورة تلقائياً {formatBytes(savedSize.before)} ←{" "}
                    {formatBytes(savedSize.after)} WebP
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...value, designImageUrl: null });
                    setSavedSize(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> إزالة الصورة
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[#B8860B] bg-white p-6 text-[#7B3F00] transition hover:bg-amber-50/50 disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <ImageUp className="h-6 w-6" />
                )}
                <span className="text-xs font-bold">
                  {uploading
                    ? "جاري معالجة الصورة وتحويلها لـ WebP…"
                    : "اضغط هنا لاختيار صورة التصميم (JPG, PNG, WebP)"}
                </span>
              </button>
            )}
            {uploadError && (
              <p className="mt-2 text-xs font-semibold text-red-600">{uploadError}</p>
            )}
          </div>
        )}

        {errors?.photo ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600 animate-pulse">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.photo}
          </p>
        ) : null}
      </div>

      {/* 6. SPECIAL NOTES */}
      <div
        id="custom-field-notes"
        className={`rounded-2xl border p-4 transition-all ${
          errors?.notes ? "border-red-400 bg-red-50/30 shadow-xs" : "border-slate-200/90 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <label htmlFor="field-input-notes" className="block text-sm font-bold text-[#3E2723]">
            ملاحظات وتفاصيل الكيكة · Special Notes <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => {
              set("notes", "لا توجد ملاحظات إضافية");
              clear("notes");
            }}
            className="rounded-lg border border-amber-300 bg-amber-100/90 px-2.5 py-1 text-xs font-bold text-[#7B3F00] transition hover:bg-amber-200 active:scale-95"
          >
            ⚡ لا توجد ملاحظات إضافية
          </button>
        </div>

        <textarea
          id="field-input-notes"
          rows={3}
          value={value.notes}
          onChange={(e) => {
            set("notes", e.target.value);
            if (e.target.value.trim()) clear("notes");
          }}
          maxLength={400}
          placeholder="اكتب أي ملاحظات خاصة (مثال: سكر خفيف، بدون مكسرات، التوصيل قبل 5 عصراً) أو اضغط على الزر السريع أعلاه…"
          className={errors?.notes ? errorTextareaClass : normalTextareaClass}
        />

        <div className="mt-1 flex items-center justify-between text-[11px]">
          {errors?.notes ? (
            <p className="flex items-center gap-1 font-bold text-red-600 animate-pulse">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errors.notes}
            </p>
          ) : (
            <span className={value.notes.trim() ? "font-bold text-emerald-700" : "text-slate-400"}>
              {value.notes.trim() ? "✓ تم تسجيل الملاحظات" : "خانة إجبارية للتأكيد"}
            </span>
          )}
          <span className="text-slate-400">{value.notes.length}/400</span>
        </div>
      </div>

      {/* 7. GIFT (IF NOT HIDDEN) */}
      {!hideGift && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="block text-sm font-bold text-[#3E2723]">
              خيار الهدية · Gift Option
            </span>
            <span className="text-[11px] font-semibold text-slate-500">اختياري</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <button
              type="button"
              onClick={() =>
                onChange({ ...value, gift: false, senderPhone: "", recipientPhone: "" })
              }
              className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                !value.gift
                  ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                  : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
              }`}
            >
              طلب عادي
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...value, gift: true })}
              className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                value.gift
                  ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                  : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
              }`}
            >
              🎁 إرسال كهدية
            </button>
          </div>

          {value.gift && (
            <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-200 bg-[#F9FBFC] p-3">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-[#3E2723]">
                  هاتف المُرسل · Sender phone
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
                  هاتف المُستلم · Recipient phone
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
