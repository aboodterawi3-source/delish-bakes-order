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
import { deleteDesignImage, uploadDesignImage } from "@/lib/design-upload.functions";
import { useLang } from "@/lib/i18n";

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

const BALLOON_COLORS = [
  { id: "gold", ar: "ذهبي", en: "Gold", swatch: "#B8860B" },
  { id: "peach", ar: "خوخي", en: "Peach", swatch: "#FDE2CF" },
  { id: "rose", ar: "وردي", en: "Rose", swatch: "#E8A0BF" },
  { id: "sky", ar: "سماوي", en: "Sky blue", swatch: "#9CC7E8" },
  { id: "white", ar: "أبيض", en: "White", swatch: "#F8F8F6" },
  { id: "chocolate", ar: "بني", en: "Chocolate", swatch: "#8B4513" },
];

const FILLING_SUGGESTIONS = [
  { ar: "فستق حلبي طبيعي", en: "Natural Pistachio" },
  { ar: "نوتيلا بلجيكية", en: "Belgian Nutella" },
  { ar: "لوتس مقرمش", en: "Crunchy Lotus" },
  { ar: "كراميل مملح", en: "Salted Caramel" },
  { ar: "فانيلا وتوت طازج", en: "Vanilla & Berries" },
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
    <div className="inline-flex items-center rounded-full bg-[#8B4513] px-2.5 py-1 text-white shadow-xs">
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

const normalInputClass = `${baseInputClass} min-h-11 border border-slate-200 bg-[#F9FBFC] focus:border-[#B8860B] focus:bg-white focus:ring-2 focus:ring-[#B8860B]/20`;

const errorInputClass = `${baseInputClass} min-h-11 border-2 border-red-500 bg-red-50/50 ring-2 ring-red-200 focus:border-red-600 focus:bg-red-50/70 focus:ring-red-300`;

const normalTextareaClass = `${baseInputClass} border border-slate-200 bg-[#F9FBFC] p-3 text-sm focus:border-[#B8860B] focus:bg-white focus:ring-2 focus:ring-[#B8860B]/20`;

const errorTextareaClass = `${baseInputClass} border-2 border-red-500 bg-red-50/50 p-3 text-sm ring-2 ring-red-200 focus:border-red-600 focus:bg-red-50/70 focus:ring-red-300`;

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

  // Derive active candle mode
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

  useEffect(() => {
    setBalloonMode(value.balloons ? "yes" : "none");
  }, [value.balloons]);

  useEffect(() => {
    setTopperMode(value.topper ? "yes" : "none");
  }, [value.topper]);

  return (
    <div className="space-y-4 pt-1">
      {/* SECTION HEADER */}
      <div className="flex items-center justify-between border-b border-[#FDE2CF]/80 pb-2.5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#5D2E17]">
          <Sparkles className="h-4 w-4 text-[#B8860B]" />
          <span>{ar ? "تخصيص الكيكة والإضافات" : "Customization & Add-ons"}</span>
        </h3>
        <span className="rounded-full bg-[#FEF7EB] border border-[#FDE2CF] px-2.5 py-0.5 text-[11px] font-semibold text-[#8B4513]">
          {ar ? "اختياري" : "Optional"}
        </span>
      </div>

      {/* 1. CAKE FILLING */}
      <div
        id="custom-field-filling"
        className={`rounded-2xl border p-3.5 transition-all ${
          errors?.filling ? "border-red-400 bg-red-50/30" : "border-slate-200/90 bg-white shadow-2xs"
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="field-input-filling" className="block text-xs font-bold text-[#3E2723]">
            {ar ? "نوع الحشوة المفضلة" : "Preferred Filling"}
          </label>
          {value.filling.trim() ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> {ar ? "تم التحديد" : "Selected"}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">{ar ? "اختياري" : "Optional"}</span>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {FILLING_SUGGESTIONS.map((sug) => {
            const label = ar ? sug.ar : sug.en;
            const isSelected = value.filling === label;
            return (
              <button
                key={sug.en}
                type="button"
                onClick={() => {
                  set("filling", label);
                  clear("filling");
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  isSelected
                    ? "border border-[#8B4513] bg-[#8B4513] text-white"
                    : "border border-slate-200 bg-[#F9FBFC] text-[#5A4A42] hover:bg-amber-50 hover:border-amber-200"
                }`}
              >
                {label}
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
          placeholder={ar ? "أو اكتب نوع الحشوة المطلوبة بالتفصيل..." : "Or type your custom filling..."}
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
        className={`rounded-2xl border p-3.5 transition-all ${
          errors?.candles ? "border-red-400 bg-red-50/30" : "border-slate-200/90 bg-white shadow-2xs"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-[#3E2723]">
            {ar ? "شموع الاحتفال" : "Celebration Candles"}
          </label>
          <span className="text-[11px] text-muted-foreground">{ar ? "اختياري" : "Optional"}</span>
        </div>

        {/* Choice buttons */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-2">
          {[
            { id: "none", labelAr: "بدون شموع", labelEn: "No Candles" },
            { id: "standard", labelAr: "🕯️ شموع عادية", labelEn: "🕯️ Standard" },
            { id: "number", labelAr: "🔢 شموع أرقام", labelEn: "🔢 Numbers" },
            { id: "both", labelAr: "✨ عادية + أرقام", labelEn: "✨ Both" },
          ].map((opt) => {
            const active = candleMode === opt.id;
            const label = ar ? opt.labelAr : opt.labelEn;
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
                className={`min-h-10 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  active
                    ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                    : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {value.standardCandles && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#F9FBFC] p-2.5 my-2">
            <span className="text-xs font-bold text-[#3E2723]">
              {ar ? "عدد الشموع العادية:" : "Standard Candles Count:"}
            </span>
            <Counter
              value={value.candleQty}
              onChange={(n) => set("candleQty", n)}
              label="Candles"
            />
          </div>
        )}

        {value.numberCandles && (
          <div className="grid gap-2.5 sm:grid-cols-2 rounded-xl border border-slate-200 bg-[#F9FBFC] p-2.5 my-2">
            <div>
              <label className="block text-xs font-bold text-[#3E2723] mb-1">
                {ar ? "أرقام الشموع (العمر أو السنة):" : "Candle Numbers:"}
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
                placeholder={ar ? "مثال: 25 أو 18" : "e.g. 25"}
                className={errors?.candles ? errorInputClass : normalInputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#3E2723] mb-1">
                {ar ? "عدد الأطقم:" : "Sets Count:"}
              </label>
              <div className="pt-1">
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
        className={`rounded-2xl border p-3.5 transition-all ${
          errors?.balloons ? "border-red-400 bg-red-50/30" : "border-slate-200/90 bg-white shadow-2xs"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-[#3E2723]">
            {ar ? "بالونات هيليوم" : "Helium Balloons"}
          </label>
          <span className="text-[11px] text-muted-foreground">{ar ? "اختياري" : "Optional"}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            type="button"
            onClick={() => {
              setBalloonMode("none");
              onChange({ ...value, balloons: false, balloonPicks: [], balloonNotes: "" });
              clear("balloons");
            }}
            className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              balloonMode === "none"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            {ar ? "بدون بالونات" : "No Balloons"}
          </button>
          <button
            type="button"
            onClick={() => {
              setBalloonMode("yes");
              onChange({ ...value, balloons: true });
            }}
            className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              balloonMode === "yes"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            {ar ? "🎈 إضافة بالونات" : "🎈 Add Balloons"}
          </button>
        </div>

        {balloonMode === "yes" && (
          <div className="space-y-2.5 rounded-xl border border-slate-200 bg-[#F9FBFC] p-3">
            <span className="block text-xs font-bold text-[#3E2723]">
              {ar ? "اختر ألوان البالونات المطلوبة:" : "Select balloon colors:"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {BALLOON_COLORS.map((color) => {
                const label = ar ? color.ar : color.en;
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
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition cursor-pointer ${
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
                    {label}
                  </button>
                );
              })}
            </div>

            {value.balloonPicks.length > 0 && (
              <ul className="space-y-1.5 border-t border-slate-200 pt-2">
                {value.balloonPicks.map((pick) => (
                  <li
                    key={pick.id}
                    className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-[#3E2723]"
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
                        className="rounded p-1 text-red-600 hover:bg-red-50 cursor-pointer"
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
                {ar ? "ملاحظات إضافية على البالونات:" : "Extra balloon notes:"}
              </label>
              <input
                type="text"
                value={value.balloonNotes}
                onChange={(e) => {
                  set("balloonNotes", e.target.value);
                  if (e.target.value.trim() || value.balloonPicks.length > 0) clear("balloons");
                }}
                placeholder={ar ? "مثال: 5 بالونات هيليوم كروم..." : "e.g. 5 chrome helium balloons..."}
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
        className={`rounded-2xl border p-3.5 transition-all ${
          errors?.topper ? "border-red-400 bg-red-50/30" : "border-slate-200/90 bg-white shadow-2xs"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="field-input-topper" className="block text-xs font-bold text-[#3E2723]">
            {ar ? "توبر أكريليك احتفالي" : "Acrylic Cake Topper"}
          </label>
          <span className="text-[11px] text-muted-foreground">{ar ? "اختياري" : "Optional"}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            type="button"
            onClick={() => {
              setTopperMode("none");
              onChange({ ...value, topper: false, topperText: "" });
              clear("topper");
            }}
            className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              topperMode === "none"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            {ar ? "بدون توبر" : "No Topper"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTopperMode("yes");
              onChange({ ...value, topper: true });
            }}
            className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              topperMode === "yes"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            {ar ? "✨ إضافة توبر" : "✨ Add Topper"}
          </button>
        </div>

        {topperMode === "yes" && (
          <div className="space-y-1 mt-2">
            <input
              id="field-input-topper"
              type="text"
              value={value.topperText}
              onChange={(e) => {
                set("topperText", e.target.value);
                if (e.target.value.trim()) clear("topper");
              }}
              maxLength={60}
              placeholder={ar ? "اكتب العبارة المطلوبة (مثال: مبروك التخرج، Happy Birthday Sarah)…" : "Type topper text (e.g. Happy Birthday)…"}
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

      {/* 5. REFERENCE PHOTO — hosted by the screen when hidePhoto is set */}
      {!hidePhoto && (
        <DesignPhotoSection
          value={value}
          onChange={onChange}
          errors={errors}
          onClearError={onClearError}
        />
      )}

      {/* 6. SPECIAL NOTES */}
      <div
        id="custom-field-notes"
        className={`rounded-2xl border p-3.5 transition-all ${
          errors?.notes ? "border-red-400 bg-red-50/30" : "border-slate-200/90 bg-white shadow-2xs"
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="field-input-notes" className="block text-xs font-bold text-[#3E2723]">
            {ar ? "ملاحظات إضافية للمطبخ" : "Special Kitchen Notes"}
          </label>
          <span className="text-[11px] text-muted-foreground">{ar ? "اختياري" : "Optional"}</span>
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
          placeholder={ar ? "أي ملاحظات خاصة بطلبكم (مثال: سكر خفيف، حساسية مكسرات، التوصيل وقت محدد)..." : "Any special preparation notes (e.g. less sugar, nut allergy)..."}
          className={errors?.notes ? errorTextareaClass : normalTextareaClass}
        />

        <div className="mt-1 flex items-center justify-between text-[11px]">
          {errors?.notes ? (
            <p className="flex items-center gap-1 font-bold text-red-600 animate-pulse">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errors.notes}
            </p>
          ) : (
            <span className={value.notes.trim() ? "font-semibold text-emerald-700" : "text-muted-foreground"}>
              {value.notes.trim() ? (ar ? "✓ تم حفظ الملاحظات" : "✓ Notes recorded") : ""}
            </span>
          )}
          <span className="text-muted-foreground">{value.notes.length}/400</span>
        </div>
      </div>

      {/* 7. GIFT (IF NOT HIDDEN) */}
      {!hideGift && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="block text-xs font-bold text-[#3E2723]">
              {ar ? "إرسال كهدية لشخص عزيز" : "Send as a Gift"}
            </span>
            <span className="text-[11px] text-muted-foreground">{ar ? "اختياري" : "Optional"}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              type="button"
              onClick={() =>
                onChange({ ...value, gift: false, senderPhone: "", recipientPhone: "" })
              }
              className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
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
              className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                value.gift
                  ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                  : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
              }`}
            >
              {ar ? "🎁 إرسال كهدية" : "🎁 Send as Gift"}
            </button>
          </div>

          {value.gift && (
            <div className="grid gap-2.5 sm:grid-cols-2 rounded-xl border border-slate-200 bg-[#F9FBFC] p-2.5 mt-2">
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

  const [photoMode, setPhotoMode] = useState<"none" | "yes">(value.designImageUrl ? "yes" : "none");

  useEffect(() => {
    setPhotoMode(value.designImageUrl ? "yes" : "none");
  }, [value.designImageUrl]);

  const removePhoto = () => {
    if (value.designImageUrl) {
      const token =
        typeof window !== "undefined"
          ? sessionStorage.getItem(`delish_photo_token_${value.designImageUrl}`)
          : null;
      void deleteImage({ data: { url: value.designImageUrl, deleteToken: token } }).catch(() => {});
    }
    onChange({ ...value, designImageUrl: null });
    setSavedSize(null);
    clear("photo");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const converted = await convertToWebp(file, {
        kind: "cake",
        maxDimension: 800,
        quality: 0.8,
      });
      const previousToken =
        value.designImageUrl && typeof window !== "undefined"
          ? sessionStorage.getItem(`delish_photo_token_${value.designImageUrl}`)
          : undefined;

      const saved = await upload({
        data: {
          data_url: converted.dataUrl,
          previous_url: value.designImageUrl || null,
          previous_deleteToken: previousToken || null,
        },
      });
      if (typeof window !== "undefined" && saved.deleteToken) {
        sessionStorage.setItem(`delish_photo_token_${saved.url}`, saved.deleteToken);
      }
      onChange({ ...value, designImageUrl: saved.url });
      setSavedSize({ before: converted.originalBytes, after: converted.bytes });
      clear("photo");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : (ar ? "تعذّر رفع الصورة" : "Upload failed"));
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
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-bold text-[#3E2723]">
          {ar ? "صورة مرجعية للتصميم" : "Reference Design Photo"}
        </label>
        <span className="text-[11px] text-muted-foreground">{ar ? "اختياري" : "Optional"}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          type="button"
          onClick={() => {
            setPhotoMode("none");
            removePhoto();
          }}
          className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
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
          className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
            photoMode === "yes"
              ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
              : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
          }`}
        >
          {ar ? "📷 إرفاق صورة خاصة" : "📷 Upload Photo"}
        </button>
      </div>

      {photoMode === "yes" && (
        <div
          className={`rounded-xl border p-3.5 bg-[#F9FBFC] ${
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
                alt={ar ? "التصميم المرجعي" : "Reference design"}
                className="max-h-52 w-full rounded-xl object-cover border border-amber-200"
              />
              {savedSize && (
                <p className="text-[11px] text-[#5A4A42]">
                  {ar
                    ? `تم تحسين الصورة: ${formatBytes(savedSize.before)} ← ${formatBytes(savedSize.after)} WebP`
                    : `Optimized: ${formatBytes(savedSize.before)} → ${formatBytes(savedSize.after)} WebP`}
                </p>
              )}
              <button
                type="button"
                onClick={removePhoto}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {ar ? "إزالة الصورة" : "Remove Photo"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[#B8860B] bg-white p-5 text-[#7B3F00] transition hover:bg-amber-50/50 disabled:opacity-60 cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <ImageUp className="h-6 w-6" />
              )}
              <span className="text-xs font-bold">
                {uploading
                  ? (ar ? "جاري تحسين ورفع الصورة..." : "Optimizing & uploading...")
                  : (ar ? "اضغط هنا لاختيار صورة الكيكة المطلوبة (JPG, PNG, WebP)" : "Click to select cake design photo")}
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
  );
}
