import { useId } from "react";
import { DeliveryZoneSelect } from "@/components/delish/DeliveryZoneSelect";
import { TimeSlotPicker } from "@/components/delish/TimeSlotPicker";
import { todayIso } from "@/lib/date-filter";
import type { BrandPalette } from "@/lib/brand-palette";
import type { Lang } from "@/lib/i18n";

export type CartCheckoutForm = {
  name: string;
  phone: string;
  method: "delivery" | "pickup";
  area: string;
  address: string;
  date: string;
  time: string;
  notes: string;
  pay: "cash" | "cliq";
};

interface CartCheckoutStageProps {
  form: CartCheckoutForm;
  errors: Partial<Record<keyof CartCheckoutForm, boolean>>;
  lang: Lang;
  palette: BrandPalette;
  t: (key: string) => string;
  onSet: (key: keyof CartCheckoutForm, value: string) => void;
}

const inputCls =
  "w-full min-h-12 rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold";

/** Storefront customer checkout fields inside CartDrawer. */
export function CartCheckoutStage({
  form,
  errors,
  lang,
  palette,
  t,
  onSet,
}: CartCheckoutStageProps) {
  return (
    <div className="space-y-4">
      <Field label={t("name")} error={errors["name"]} errText={t("required")}>
        {(p) => (
          <input
            className={inputCls}
            autoComplete="name"
            value={form.name}
            onChange={(e) => onSet("name", e.target.value)}
            {...p}
          />
        )}
      </Field>
      <Field label={t("phone")} error={errors["phone"]} errText={t("required")}>
        {(p) => (
          <input
            className={inputCls}
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="07 9999 9999"
            value={form.phone}
            onChange={(e) => onSet("phone", e.target.value)}
            {...p}
          />
        )}
      </Field>

      <fieldset>
        <legend className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {t("method")}
        </legend>
        <div className="grid gap-2 min-[360px]:grid-cols-2">
          {(["delivery", "pickup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={form.method === m}
              onClick={() => onSet("method", m)}
              style={{
                borderColor: form.method === m ? palette.main : undefined,
                backgroundColor: form.method === m ? palette.cardBg : undefined,
              }}
              className={`min-h-12 cursor-pointer rounded-2xl border px-3 py-2.5 text-sm transition-all ${
                form.method === m
                  ? "font-semibold shadow-xs"
                  : "border-border text-foreground hover:bg-secondary/20"
              }`}
            >
              {m === "delivery" ? t("deliveryOpt") : t("pickup")}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {lang === "ar" ? "طريقة الدفع" : "Payment method"}
        </legend>
        <div className="grid gap-2 min-[360px]:grid-cols-2">
          {(["cash", "cliq"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={form.pay === option}
              onClick={() => onSet("pay", option)}
              style={{
                borderColor: form.pay === option ? palette.main : undefined,
                backgroundColor: form.pay === option ? palette.cardBg : undefined,
              }}
              className={`min-h-12 cursor-pointer rounded-2xl border px-3 py-2.5 text-sm transition-all ${
                form.pay === option
                  ? "font-semibold shadow-xs"
                  : "border-border text-foreground hover:bg-secondary/20"
              }`}
            >
              {option === "cash"
                ? lang === "ar"
                  ? "نقداً عند التسليم"
                  : "Cash on delivery"
                : lang === "ar"
                  ? "كليك CliQ"
                  : "CliQ transfer"}
            </button>
          ))}
        </div>
        {form.pay === "cliq" && (
          <div
            style={{ borderColor: palette.border, backgroundColor: palette.cardBg }}
            className="mt-2 space-y-2 rounded-2xl border p-3.5 text-xs transition-colors"
          >
            <p className="leading-relaxed text-muted-foreground">
              {lang === "ar"
                ? "الدفع عبر كليك · يرجى إرسال صورة إشعار التحويل عبر الواتساب بعد إتمام العملية لتأكيد طلبك."
                : "CliQ transfer · Please share your transfer receipt on WhatsApp after completing the payment."}
            </p>
          </div>
        )}
      </fieldset>

      {form.method === "delivery" && (
        <>
          <Field label={t("area")} error={errors["area"]} errText={t("required")}>
            {() => (
              <DeliveryZoneSelect
                className={inputCls}
                value={form.area}
                onChange={(area) => onSet("area", area)}
                lang={lang}
                placeholder={lang === "ar" ? "اختر المنطقة" : "Select your area"}
              />
            )}
          </Field>
          <Field label={t("address")} error={errors["address"]} errText={t("required")}>
            {(p) => (
              <textarea
                rows={2}
                className={inputCls}
                value={form.address}
                onChange={(e) => onSet("address", e.target.value)}
                {...p}
              />
            )}
          </Field>
        </>
      )}

      <TimeSlotPicker
        date={form.date || todayIso()}
        time={form.time}
        method={form.method}
        onDateChange={(d) => onSet("date", d)}
        onTimeChange={(tm) => {
          onSet("time", tm);
          if (!form.date) onSet("date", todayIso());
        }}
        lang={lang}
        error={Boolean(errors["time"] || errors["date"])}
      />

      <Field label={t("orderNotes")}>
        {(p) => (
          <textarea
            rows={2}
            className={inputCls}
            placeholder={t("notesPh")}
            value={form.notes}
            onChange={(e) => onSet("notes", e.target.value)}
            {...p}
          />
        )}
      </Field>
    </div>
  );
}

type FieldProps = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

function Field({
  label,
  error,
  errText,
  children,
}: {
  label: string;
  error?: boolean | undefined;
  errText?: string;
  children: (props: FieldProps) => React.ReactNode;
}) {
  const id = useId();
  const errId = `${id}-error`;
  const props: FieldProps = {
    id,
    ...(error ? { "aria-invalid": true as const, "aria-describedby": errId } : {}),
  };
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-bold tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </label>
      {children(props)}
      {error && (
        <p id={errId} className="mt-1 text-xs font-semibold text-destructive">
          {errText}
        </p>
      )}
    </div>
  );
}
