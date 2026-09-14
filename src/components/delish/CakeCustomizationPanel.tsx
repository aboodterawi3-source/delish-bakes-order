import { useId, useRef, useState } from "react";
import { ChevronDown, ImageUp, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { convertToWebp, formatBytes } from "@/lib/image-webp";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import { uploadDesignImage } from "@/lib/design-upload.functions";

/** One balloon colour with its own count; several may be combined. */
export type BalloonPick = { id: string; label: string; qty: number };

export type Customization = {
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

/** Bilingual lines describing the picked extras; shown to staff on the order. */
export function customizationSummary(c: Customization) {
  const ar: string[] = [];
  const en: string[] = [];

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

function Section({
  title,
  subtitle,
  children,
  active,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-[#7B3F00]">{title}</span>
          <span className="text-[11px] text-[#5A4A42]">{subtitle}</span>
        </span>
        <span className="flex items-center gap-2">
          {active && <span className="h-2 w-2 rounded-full bg-[#B8860B]" aria-hidden />}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180 text-[#8B4513]" : "text-slate-400"}`}
          />
        </span>
      </button>
      {open && (
        <div id={panelId} className="space-y-3 border-t border-slate-100 px-4 py-3.5">
          {children}
        </div>
      )}
    </div>
  );
}

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

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-xs font-semibold text-[#3E2723]"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-[#8B4513]" : "bg-slate-300"}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            checked ? "left-[1.15rem]" : "left-0.5"
          }`}
        />
      </span>
      {label}
    </button>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#3E2723] shadow-sm placeholder:font-normal placeholder:text-slate-400 focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#B8860B]/20";

export function CakeCustomizationPanel({
  value,
  onChange,
}: {
  value: Customization;
  onChange: (next: Customization) => void;
}) {
  const set = <K extends keyof Customization>(key: K, next: Customization[K]) =>
    onChange({ ...value, [key]: next });

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedSize, setSavedSize] = useState<{ before: number; after: number } | null>(null);
  const upload = useServerFn(uploadDesignImage);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const converted = await convertToWebp(file);
      const saved = await upload({ data: { data_url: converted.dataUrl } });
      onChange({ ...value, designImageUrl: saved.url });
      setSavedSize({ before: converted.originalBytes, after: converted.bytes });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "تعذّر رفع الصورة · Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="space-y-2.5">
      <h2 className="text-xs font-bold uppercase tracking-wider text-[#5D2E17]">
        Customize your cake · تخصيص الكيكة
      </h2>

      <Section
        title="Candles · الشموع"
        subtitle="Standard candles or number candles"
        active={value.candleMode !== "none"}
      >
        <div className="flex min-w-0 flex-wrap gap-2">
          {(
            [
              ["none", "None · بدون"],
              ["standard", "Standard candle · شمعة عادية"],
              ["number", "Number candles · شموع أرقام"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => set("candleMode", mode)}
              aria-pressed={value.candleMode === mode}
              className={`rounded-full px-3.5 py-2 text-[11px] font-bold transition ${
                value.candleMode === mode
                  ? "bg-[#8B4513] text-white shadow-sm"
                  : "bg-[#FDE2CF]/60 text-[#7B3F00] hover:bg-[#FDE2CF]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {value.candleMode === "standard" && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#3E2723]">Quantity · العدد</span>
            <Counter value={value.candleQty} onChange={(n) => set("candleQty", n)} label="Candles" />
          </div>
        )}

        {value.candleMode === "number" && (
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#3E2723]">Digits · الأرقام</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={value.candleDigits}
              onChange={(e) => set("candleDigits", e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="18"
              className={inputClass}
            />
          </label>
        )}
      </Section>

      <Section title="Balloons · البالونات" subtitle="Pick a colour and quantity" active={value.balloons}>
        <Toggle
          checked={value.balloons}
          onChange={(next) => set("balloons", next)}
          label="Add balloons · أضف بالونات"
        />
        {value.balloons && (
          <>
            <div className="flex flex-wrap gap-2">
              {BALLOON_COLORS.map((color) => {
                const selected = value.balloonColor === `${color.en} / ${color.ar}`;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => set("balloonColor", `${color.en} / ${color.ar}`)}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                      selected ? "border-[#8B4513] bg-[#FDE2CF] text-[#7B3F00]" : "border-slate-200 bg-white text-[#5A4A42]"
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: color.swatch }}
                      aria-hidden
                    />
                    {color.en} · {color.ar}
                  </button>
                );
              })}
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#3E2723]">Other colour · لون آخر</span>
              <input
                value={value.balloonColor}
                onChange={(e) => set("balloonColor", e.target.value)}
                maxLength={60}
                placeholder="Pastel lilac"
                className={inputClass}
              />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#3E2723]">Quantity · العدد</span>
              <Counter value={value.balloonQty} onChange={(n) => set("balloonQty", n)} label="Balloons" />
            </div>
          </>
        )}
      </Section>

      <Section title="Acrylic topper · الأكريلك" subtitle="Custom name or message" active={value.topper}>
        <Toggle
          checked={value.topper}
          onChange={(next) => set("topper", next)}
          label="Add acrylic topper · أضف توبر أكريليك"
        />
        {value.topper && (
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#3E2723]">Text on topper · النص المطلوب</span>
            <input
              value={value.topperText}
              onChange={(e) => set("topperText", e.target.value)}
              maxLength={60}
              placeholder="Happy Birthday Lana"
              className={inputClass}
            />
          </label>
        )}
      </Section>

      <Section title="Gift · خيار هدية" subtitle="Sender and recipient numbers" active={value.gift}>
        <Toggle checked={value.gift} onChange={(next) => set("gift", next)} label="Is this a gift? · هل هذه هدية؟" />
        {value.gift && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#3E2723]">Sender phone · هاتف المُرسل</span>
              <input
                inputMode="tel"
                value={value.senderPhone}
                onChange={(e) => set("senderPhone", e.target.value.replace(/[^0-9+\s-]/g, ""))}
                maxLength={25}
                placeholder="07 9xxx xxxx"
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#3E2723]">Recipient phone · هاتف المُستلم</span>
              <input
                inputMode="tel"
                value={value.recipientPhone}
                onChange={(e) => set("recipientPhone", e.target.value.replace(/[^0-9+\s-]/g, ""))}
                maxLength={25}
                placeholder="07 9xxx xxxx"
                className={inputClass}
              />
            </label>
          </div>
        )}
      </Section>

      <Section
        title="Reference photo · صورة مرجعية"
        subtitle="Upload the design you have in mind"
        active={Boolean(value.designImageUrl)}
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
              alt="Reference photo you uploaded"
              className="max-h-56 w-full rounded-xl object-cover"
              loading="lazy"
            />
            {savedSize && (
              <p className="text-[11px] text-[#5A4A42]">
                Optimised {formatBytes(savedSize.before)} → {formatBytes(savedSize.after)} WebP
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                onChange({ ...value, designImageUrl: null });
                setSavedSize(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-[#8B4513]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove · إزالة
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-[#B8860B]/50 bg-[#FDE2CF]/25 px-4 py-6 text-[#7B3F00] transition hover:bg-[#FDE2CF]/50 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageUp className="h-5 w-5" />}
            <span className="text-xs font-bold">
              {uploading ? "Optimising… · جاري المعالجة" : "Upload reference photo · ارفع صورة"}
            </span>
            <span className="text-[10px]">Converted to WebP automatically · تُحوّل تلقائياً</span>
          </button>
        )}
        {uploadError && <p className="text-[11px] font-semibold text-red-600">{uploadError}</p>}
      </Section>

      <Section title="Special notes · ملاحظات" subtitle="Anything else we should know" active={Boolean(value.notes.trim())}>
        <textarea
          rows={4}
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={400}
          placeholder="Less sugar, no nuts, deliver before 5pm…"
          className={`${inputClass} resize-y leading-relaxed`}
        />
        <p className="text-[10px] text-slate-400">{value.notes.length}/400</p>
      </Section>
    </section>
  );
}
