import { AlertCircle, Check, Minus, Plus, Sparkles } from "lucide-react";
import { DesignPhotoSection } from "@/components/delish/DesignPhotoSection";
import { useLang } from "@/lib/i18n";

export { DesignPhotoSection };

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
  if (c.standardCandles) {
    ar.push(`شموع عادية: ${c.candleQty}`);
    en.push(`Standard candles: ${c.candleQty}`);
  }
  if (c.numberCandles && c.candleDigits.trim()) {
    ar.push(`شموع أرقام: ${c.candleDigits.trim()} × ${c.numberCandleQty}`);
    en.push(`Number candles: ${c.candleDigits.trim()} × ${c.numberCandleQty}`);
  }
  if (c.balloons) {
    if (c.balloonNotes.trim()) {
      ar.push(`بالونات إضافية: ${c.balloonNotes.trim()}`);
      en.push(`Extra balloons: ${c.balloonNotes.trim()}`);
    } else {
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
    <div className="inline-flex items-center rounded-full bg-[#8B4513] px-1 py-0.5 text-white shadow-xs">
      <button
        type="button"
        aria-label={`${label} −`}
        onClick={() => onChange(Math.max(1, value - 1))}
        className="grid h-11 w-11 cursor-pointer place-items-center rounded-full transition hover:text-amber-200 active:scale-90"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="px-2 text-xs font-bold">{value}</span>
      <button
        type="button"
        aria-label={`${label} +`}
        onClick={() => onChange(Math.min(99, value + 1))}
        className="grid h-11 w-11 cursor-pointer place-items-center rounded-full transition hover:text-amber-200 active:scale-90"
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

  // Derive active candle mode (null if not chosen yet)
  const candleMode =
    value.candleChoice !== undefined
      ? value.candleChoice
      : value.standardCandles && value.numberCandles
        ? "both"
        : value.standardCandles
          ? "standard"
          : value.numberCandles
            ? "number"
            : null;

  // Derive active balloon mode (null if not chosen yet)
  const balloonMode =
    value.balloonChoice !== undefined ? value.balloonChoice : value.balloons ? "yes" : null;

  // Derive active topper mode (null if not chosen yet)
  const topperMode =
    value.topperChoice !== undefined ? value.topperChoice : value.topper ? "yes" : null;

  const candleDone =
    candleMode === "none" ||
    candleMode === "standard" ||
    ((candleMode === "number" || candleMode === "both") && Boolean(value.candleDigits.trim()));

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
        <div className="mb-2 flex items-center justify-between">
          <span className="block text-xs font-bold text-[#3E2723]">
            {ar ? "شموع الاحتفال" : "Celebration Candles"}
          </span>
          {candleDone ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> {ar ? "تم التحديد" : "Selected"}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-[#8B4513]">
              {ar ? "إجباري *" : "Required *"}
            </span>
          )}
        </div>

        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                      candleChoice: "none",
                      standardCandles: false,
                      numberCandles: false,
                      candleDigits: "",
                    });
                  } else if (opt.id === "standard") {
                    onChange({
                      ...value,
                      candleChoice: "standard",
                      standardCandles: true,
                      numberCandles: false,
                      candleQty: value.candleQty || 1,
                    });
                  } else if (opt.id === "number") {
                    onChange({
                      ...value,
                      candleChoice: "number",
                      standardCandles: false,
                      numberCandles: true,
                      numberCandleQty: value.numberCandleQty || 1,
                    });
                  } else {
                    onChange({
                      ...value,
                      candleChoice: "both",
                      standardCandles: true,
                      numberCandles: true,
                      candleQty: value.candleQty || 1,
                      numberCandleQty: value.numberCandleQty || 1,
                    });
                  }
                  clear("candles");
                }}
                className={`min-h-11 cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
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
          <div className="my-2 flex items-center justify-between rounded-xl border border-slate-200 bg-[#F9FBFC] p-2.5">
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
          <div className="my-2 grid gap-2.5 rounded-xl border border-slate-200 bg-[#F9FBFC] p-2.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="field-input-candle-digits"
                className="mb-1 block text-xs font-bold text-[#3E2723]"
              >
                {ar ? "أرقام الشموع (العمر أو السنة):" : "Candle Numbers:"}
              </label>
              <input
                id="field-input-candle-digits"
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
              <span className="mb-1 block text-xs font-bold text-[#3E2723]">
                {ar ? "عدد الأطقم:" : "Sets Count:"}
              </span>
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
        <div className="mb-2 flex items-center justify-between">
          <span className="block text-xs font-bold text-[#3E2723]">
            {ar ? "بالونات هيليوم" : "Helium Balloons"}
          </span>
          {balloonMode === "none" || (balloonMode === "yes" && value.balloonNotes.trim()) ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> {ar ? "تم التحديد" : "Selected"}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-[#8B4513]">
              {ar ? "إجباري *" : "Required *"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onChange({
                ...value,
                balloonChoice: "none",
                balloons: false,
                balloonNotes: "",
              });
              clear("balloons");
            }}
            className={`min-h-11 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition ${
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
              onChange({
                ...value,
                balloonChoice: "yes",
                balloons: true,
              });
              clear("balloons");
            }}
            className={`min-h-11 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              balloonMode === "yes"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            {ar ? "🎈 إضافة بالونات" : "🎈 Add Balloons"}
          </button>
        </div>

        {balloonMode === "yes" && (
          <div className="mt-2 space-y-1">
            <input
              id="field-input-balloons"
              type="text"
              value={value.balloonNotes}
              onChange={(e) => {
                set("balloonNotes", e.target.value);
                if (e.target.value.trim()) clear("balloons");
              }}
              maxLength={120}
              placeholder={
                ar
                  ? "اكتب تفاصيل البالونات (الألوان، العدد، أو عبارة)..."
                  : "Type balloon details (colors, count, or note)..."
              }
              className={errors?.balloons ? errorInputClass : normalInputClass}
            />
          </div>
        )}

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
        <div className="mb-2 flex items-center justify-between">
          <span className="block text-xs font-bold text-[#3E2723]">
            {ar ? "توبر أكريليك احتفالي" : "Acrylic Cake Topper"}
          </span>
          {topperMode === "none" || (topperMode === "yes" && value.topperText.trim()) ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> {ar ? "تم التحديد" : "Selected"}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-[#8B4513]">
              {ar ? "إجباري *" : "Required *"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onChange({ ...value, topperChoice: "none", topper: false, topperText: "" });
              clear("topper");
            }}
            className={`min-h-11 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition ${
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
              onChange({ ...value, topperChoice: "yes", topper: true });
              clear("topper");
            }}
            className={`min-h-11 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              topperMode === "yes"
                ? "border-2 border-[#8B4513] bg-[#8B4513] text-white shadow-xs"
                : "border border-slate-200 bg-[#F9FBFC] text-[#5D2E17] hover:bg-amber-50"
            }`}
          >
            {ar ? "✨ إضافة توبر" : "✨ Add Topper"}
          </button>
        </div>

        {topperMode === "yes" && (
          <div className="mt-2 space-y-1">
            <input
              id="field-input-topper"
              type="text"
              value={value.topperText}
              onChange={(e) => {
                set("topperText", e.target.value);
                if (e.target.value.trim()) clear("topper");
              }}
              maxLength={60}
              placeholder={
                ar
                  ? "اكتب العبارة المطلوبة على التوبر (مثال: مبروك التخرج، Happy Birthday)…"
                  : "Type topper text (e.g. Happy Birthday)…"
              }
              className={errors?.topper ? errorInputClass : normalInputClass}
            />
          </div>
        )}

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
