import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { builderFillings, builderFlavors, builderFrostings, builderSizes, type Option } from "@/lib/menu";
import { builderImage } from "@/lib/images";
import { Pic } from "@/components/delish/Pic";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { Chip } from "./ProductModal";

export function CakeBuilder({ onDone }: { onDone: () => void }) {
  const { t, lang, dir } = useLang();
  const { add } = useCart();
  const [step, setStep] = useState(0);
  const [size, setSize] = useState<Option>(builderSizes[0]!);
  const [flavor, setFlavor] = useState<Option>(builderFlavors[0]!);
  const [filling, setFilling] = useState<Option>(builderFillings[0]!);
  const [frosting, setFrosting] = useState<Option>(builderFrostings[0]!);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState(false);

  const total = useMemo(
    () => size.price + flavor.price + filling.price + frosting.price,
    [size, flavor, filling, frosting],
  );

  const label = (o: Option) => (lang === "ar" ? o.ar : o.en);

  const steps = [
    { title: t("size"), options: builderSizes, value: size, set: setSize },
    { title: t("flavor"), options: builderFlavors, value: flavor, set: setFlavor },
    { title: t("filling"), options: builderFillings, value: filling, set: setFilling },
    { title: t("frosting"), options: builderFrostings, value: frosting, set: setFrosting },
  ];

  const current = steps[step]!;
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;

  const submit = () => {
    add({
      ar: "كيكة مصمّمة خاصة",
      en: "Custom designed cake",
      unit: total,
      qty: 1,
      image: builderImage.src,
      detailsAr: [
        `الحجم: ${size.ar}`,
        `النكهة: ${flavor.ar}`,
        `الحشوة: ${filling.ar}`,
        `التغليف: ${frosting.ar}`,
        ...(message.trim() ? [`الكتابة: ${message.trim()}`] : []),
      ],
      detailsEn: [
        `Size: ${size.en}`,
        `Flavor: ${flavor.en}`,
        `Filling: ${filling.en}`,
        `Frosting: ${frosting.en}`,
        ...(message.trim() ? [`Message: ${message.trim()}`] : []),
      ],
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
    onDone();
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 md:items-center">
      <div className="relative overflow-hidden rounded-3xl border border-gold/30 shadow-[var(--shadow-gold)]">
        <Pic
          set={builderImage}
          alt={t("builderTitle")}
          sizes="(min-width: 768px) 460px, 92vw"
          className="aspect-square w-full object-cover"
        />
        <div className="absolute bottom-0 start-0 end-0 bg-gradient-to-t from-cocoa/85 to-transparent p-4">
          <p className="font-display text-lg text-primary-foreground">{label(size)}</p>
          <p className="text-xs text-primary-foreground/80">
            {label(flavor)} · {label(filling)} · {label(frosting)}
          </p>
        </div>
      </div>

      <div className="surface-card rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" aria-live="polite">
            {t("step")} {step + 1} {t("of")} 4
          </p>
          <ol className="flex gap-1.5" aria-label={t("builderTitle")}>
            {steps.map((s, i) => (
              <li
                key={s.title}
                aria-current={i === step ? "step" : undefined}
                className={`h-1.5 w-6 rounded-full transition-colors ${i <= step ? "bg-gold-deep" : "bg-border"}`}
              >
                <span className="sr-only">{s.title}</span>
              </li>
            ))}
          </ol>
        </div>

        <h3 className="mt-4 font-display text-xl font-semibold">{current.title}</h3>


        <div className="mt-3 flex flex-wrap gap-2">
          {current.options.map((o) => (
            <Chip key={o.id} active={current.value.id === o.id} onClick={() => current.set(o)}>
              {label(o)}
              {o.price > 0 && step === 0 && <span className="ms-1 text-gold-deep">{o.price}</span>}
              {o.price > 0 && step > 0 && <span className="ms-1 text-gold-deep">+{o.price}</span>}
            </Chip>
          ))}
        </div>

        {step === 3 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{t("message")}</p>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePh")}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            <Prev className="h-4 w-4" /> {t("back")}
          </button>

          <span className="font-display text-lg font-semibold">
            {total.toFixed(2)} <span className="text-sm">{t("jod")}</span>
          </span>

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {t("next")} <Next className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {added ? <Check className="h-4 w-4" /> : null} {t("addBuilder")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
