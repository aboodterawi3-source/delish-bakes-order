import { useId, useRef, useState } from "react";
import { CheckCircle2, Minus, Plus, Trash2, X } from "lucide-react";
import { WHATSAPP } from "@/lib/menu";
import { DELIVERY_ZONES, OTHER_GOVERNORATES_AREA, feeForArea } from "@/lib/delivery-zones";
import { useCart } from "@/lib/cart";
import { useLang } from "@/lib/i18n";
import { useDismissable } from "@/lib/a11y";
import { useServerFn } from "@tanstack/react-start";
import { submitStorefrontOrder } from "@/lib/storefront-order.functions";


type Form = {
  name: string;
  phone: string;
  method: "delivery" | "pickup";
  area: string;
  address: string;
  date: string;
  time: string;
  notes: string;
  /** How the customer will pay: cash on delivery or a CliQ transfer. */
  pay: "cash" | "cliq";
};

const empty: Form = {
  name: "",
  phone: "",
  method: "delivery",
  area: "",
  address: "",
  date: "",
  time: "",
  notes: "",
  pay: "cash",
};

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const { lines, setQty, remove, clear, subtotal, count } = useCart();
  const [stage, setStage] = useState<"cart" | "checkout" | "done">("cart");
  const [waUrl, setWaUrl] = useState("");
  const [orderNumber, setOrderNumber] = useState<string | number | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [sending, setSending] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const submitOrder = useServerFn(submitStorefrontOrder);

  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useDismissable(open, onClose);

  const areaFee = feeForArea(form.area);
  const deliveryFee = form.method === "delivery" && count > 0 ? (areaFee ?? 0) : 0;
  const total = subtotal + deliveryFee;

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Partial<Record<keyof Form, boolean>> = {};
    if (!form.name.trim()) e["name"] = true;
    if (!/^[0-9+\s-]{7,}$/.test(form.phone.trim())) e["phone"] = true;
    if (form.method === "delivery") {
      if (!form.area.trim()) e["area"] = true;
      if (!form.address.trim()) e["address"] = true;
    }
    if (!form.date) e["date"] = true;
    if (!form.time) e["time"] = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildMessage = () => {
    const ar = lang === "ar";
    const L: string[] = [];
    L.push(ar ? "🧾 *طلب جديد – Delish Cake & Bake*" : "🧾 *New Order – Delish Cake & Bake*");
    L.push("");
    L.push(ar ? "*بيانات العميل*" : "*Customer details*");
    L.push(`${ar ? "الاسم" : "Name"}: ${form.name.trim()}`);
    L.push(`${ar ? "الهاتف" : "Phone"}: ${form.phone.trim()}`);
    L.push(
      `${ar ? "طريقة الاستلام" : "Order type"}: ${
        form.method === "delivery" ? (ar ? "توصيل" : "Delivery") : ar ? "استلام من الفرع" : "Pickup"
      }`,
    );
    if (form.method === "delivery") {
      L.push(`${ar ? "المنطقة" : "Area"}: ${form.area.trim()}`);
      L.push(`${ar ? "العنوان" : "Address"}: ${form.address.trim()}`);
    }
    L.push(`${ar ? "التاريخ" : "Date"}: ${form.date}`);
    L.push(`${ar ? "الوقت" : "Time"}: ${form.time}`);
    L.push("");
    L.push(ar ? "*تفاصيل الطلب*" : "*Order items*");
    lines.forEach((l, i) => {
      L.push(`${i + 1}. ${ar ? l.ar : l.en} × ${l.qty} — ${(l.unit * l.qty).toFixed(2)} ${ar ? "د.أ" : "JOD"}`);
      (ar ? l.detailsAr : l.detailsEn).forEach((d) => L.push(`   • ${d}`));
      if (l.notes) L.push(`   • ${ar ? "ملاحظة" : "Note"}: ${l.notes}`);
    });
    L.push("");
    L.push(`${ar ? "المجموع" : "Subtotal"}: ${subtotal.toFixed(2)} ${ar ? "د.أ" : "JOD"}`);
    L.push(`${ar ? "التوصيل" : "Delivery"}: ${deliveryFee.toFixed(2)} ${ar ? "د.أ" : "JOD"}`);
    L.push(`*${ar ? "الإجمالي" : "Total"}: ${total.toFixed(2)} ${ar ? "د.أ" : "JOD"}*`);
    L.push(
      `${ar ? "طريقة الدفع" : "Payment"}: ${
        form.pay === "cash" ? (ar ? "نقداً عند التسليم" : "Cash on delivery") : ar ? "كليك CliQ" : "CliQ transfer"
      }`,
    );
    if (form.notes.trim()) {
      L.push("");
      L.push(`${ar ? "ملاحظات إضافية" : "Additional notes"}: ${form.notes.trim()}`);
    }
    return L.join("\n");
  };

  /**
   * Opens WhatsApp in a brand-new tab through a synthetic anchor click.
   * This never touches the storefront tab's history, so "back" always
   * returns to this success screen instead of a WhatsApp bridge page.
   */
  const openWhatsApp = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const send = async () => {
    if (!validate()) return;
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(buildMessage())}`;
    setWaUrl(url);

    setSending(true);
    setSaveError(false);
    try {
      const saved = await submitOrder({
        data: {
          customer_name: form.name.trim(),
          customer_phone: form.phone.trim(),
          method: form.method,
          area: form.area.trim() || null,
          address: form.address.trim() || null,
          requested_date: form.date,
          requested_time: form.time,
          notes: form.notes.trim() || null,
          payment_method: form.pay,
          design_image: lines.find((l) => l.designImage)?.designImage ?? null,
          // Prices are never sent: the server re-prices each line from the catalogue.
          lines: lines.flatMap((l) =>
            l.spec
              ? [
                  {
                    spec: l.spec,
                    quantity: l.qty,
                    notes: l.notes ?? null,
                    extras_ar: l.extrasAr ?? null,
                    extras_en: l.extrasEn ?? null,
                  },
                ]
              : [],
          ),
        },
      });
      setOrderNumber(saved?.order_number ?? null);
    } catch {
      setSaveError(true);
    } finally {
      setSending(false);
    }

    setStage("done");
    clear();
    openWhatsApp(url);
  };


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex max-w-full justify-end overflow-x-hidden bg-primary/75">
      <button
        type="button"
        aria-label={lang === "ar" ? "إغلاق السلة" : "Close cart"}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md min-w-0 flex-col overflow-x-hidden bg-background shadow-[var(--shadow-soft)]"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-4 py-4 sm:px-5">
          <h2 id={titleId} className="min-w-0 break-words font-display text-lg font-semibold">
            {stage === "done"
              ? lang === "ar"
                ? "تم إرسال الطلب"
                : "Order sent"
              : stage === "cart"
                ? t("cart")
                : t("checkout")}{" "}
            {stage !== "done" && (
              <span className="text-sm font-normal text-muted-foreground">
                ({count} {t("itemsCount")})
              </span>
            )}
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={lang === "ar" ? "إغلاق" : "Close"}
            className="grid h-12 w-12 place-items-center rounded-full border border-border text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-5">
          {stage === "done" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle2 className="h-14 w-14 text-whatsapp" aria-hidden="true" />
              <h3 className="font-display text-xl font-semibold">
                {lang === "ar" ? "تم تسجيل طلبك بنجاح" : "Your order was received"}
              </h3>
              {orderNumber != null && (
                <p className="text-sm font-semibold">
                  {lang === "ar" ? "رقم الطلب" : "Order number"}: <span dir="ltr">{orderNumber}</span>
                </p>
              )}
              <p className="max-w-xs text-sm text-muted-foreground">
                {lang === "ar"
                  ? "فتحنا واتساب في نافذة جديدة لإرسال تفاصيل الطلب. إذا لم تُفتح، استخدم الزر أدناه."
                  : "WhatsApp opened in a new tab with your order details. If it did not open, use the button below."}
              </p>
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid min-h-12 w-full max-w-xs place-items-center rounded-full bg-whatsapp px-6 text-sm font-bold text-whatsapp-foreground"
                >
                  {lang === "ar" ? "فتح واتساب مرة أخرى" : "Open WhatsApp again"}
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setStage("cart");
                  setForm(empty);
                  setWaUrl("");
                  setOrderNumber(null);
                  onClose();
                }}
                className="min-h-11 text-xs text-foreground underline"
              >
                {lang === "ar" ? "متابعة التسوّق" : "Back to the shop"}
              </button>
            </div>
          )}

          {stage !== "done" && lines.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">{t("emptyCart")}</p>
          )}

          {stage === "cart" &&
            lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-border p-3">
                {l.image && (
                  <img
                    src={l.image}
                    alt={lang === "ar" ? l.ar : l.en}
                    loading="lazy"
                    width={80}
                    height={80}
                    className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{lang === "ar" ? l.ar : l.en}</p>
                    <button
                      onClick={() => remove(l.key)}
                      aria-label={`${lang === "ar" ? "إزالة" : "Remove"} ${lang === "ar" ? l.ar : l.en}`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {(lang === "ar" ? l.detailsAr : l.detailsEn).map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                    {l.notes && <li>{l.notes}</li>}
                  </ul>
                   <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-full border border-border px-1">
                      <button
                        onClick={() => setQty(l.key, l.qty - 1)}
                        aria-label={`${lang === "ar" ? "تقليل الكمية" : "Decrease quantity"} — ${lang === "ar" ? l.ar : l.en}`}
                        className="grid h-11 w-11 place-items-center rounded-full"
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <span className="min-w-6 text-center text-sm font-semibold" aria-live="polite">
                        {l.qty}
                      </span>
                      <button
                        onClick={() => setQty(l.key, l.qty + 1)}
                        aria-label={`${lang === "ar" ? "زيادة الكمية" : "Increase quantity"} — ${lang === "ar" ? l.ar : l.en}`}
                        className="grid h-11 w-11 place-items-center rounded-full"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold">
                      {(l.unit * l.qty).toFixed(2)} {t("jod")}
                    </span>
                  </div>
                </div>
              </div>
            ))}

          {stage === "checkout" && (
            <div className="space-y-4">
              <Field label={t("name")} error={errors["name"]} errText={t("required")}>
                {(p) => <input className={inputCls} autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} {...p} />}
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
                    onChange={(e) => set("phone", e.target.value)}
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
                      onClick={() => set("method", m)}
                      className={`min-h-12 rounded-2xl border px-3 py-2.5 text-sm ${
                        form.method === m ? "border-gold bg-secondary font-semibold" : "border-border text-foreground"
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
                      onClick={() => set("pay", option)}
                      className={`min-h-12 rounded-2xl border px-3 py-2.5 text-sm ${
                        form.pay === option ? "border-gold bg-secondary font-semibold" : "border-border text-foreground"
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
                  <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                      <span className="font-extrabold text-foreground">
                        {lang === "ar" ? "اسم الحساب (CliQ Alias):" : "CliQ Alias:"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span dir="ltr" className="font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md text-sm">
                          DELISHBAKES
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText("DELISHBAKES");
                            alert(lang === "ar" ? "تم نسخ اسم مستعار كليك (DELISHBAKES)!" : "CliQ Alias copied!");
                          }}
                          className="rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground shadow-xs active:scale-95"
                        >
                          {lang === "ar" ? "نسخ 📋" : "Copy"}
                        </button>
                      </div>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {lang === "ar"
                        ? "اسم المستفيد: مخبز ديليش للحلويات (Bank Etihad). بعد التحويل، يرجى إرسال صورة الإشعار عبر الواتساب لتأكيد الطلب."
                        : "Beneficiary: Delish Bakes Patisserie (Bank Etihad). After transferring, please share receipt on WhatsApp."}
                    </p>
                  </div>
                )}
              </fieldset>

              {form.method === "delivery" && (
                <>
                  <Field label={t("area")} error={errors["area"]} errText={t("required")}>
                    {(p) => (
                      <select
                        className={inputCls}
                        value={form.area}
                        onChange={(e) => set("area", e.target.value)}
                        {...p}
                      >
                        <option value="">{lang === "ar" ? "اختر المنطقة" : "Select your area"}</option>
                        {DELIVERY_ZONES.map((zone) => (
                          <optgroup key={zone.labelEn} label={lang === "ar" ? zone.labelAr : zone.labelEn}>
                            {zone.areas.map((area) => (
                              <option key={`${zone.labelEn}-${area}`} value={area}>
                                {area === OTHER_GOVERNORATES_AREA
                                  ? lang === "ar"
                                    ? `${area} (٥–٨ د.أ)`
                                    : `Other governorates (5–8 JOD)`
                                  : `${area} — ${zone.fee.toFixed(2)} ${t("jod")}`}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </Field>
                  {form.area.trim() === OTHER_GOVERNORATES_AREA ? (
                    <p className="-mt-2 text-xs font-semibold text-muted-foreground">
                      {lang === "ar"
                        ? "أجرة التوصيل للمحافظات الأخرى من ٥ إلى ٨ د.أ — يحددها فريقنا عند تأكيد الطلب حسب العنوان."
                        : "Delivery to other governorates is 5–8 JOD — our team confirms the exact fee based on your address."}
                    </p>
                  ) : (
                    areaFee !== null && (
                      <p className="-mt-2 text-xs font-semibold text-muted-foreground">
                        {lang === "ar"
                          ? `أجرة التوصيل لهذه المنطقة: ${areaFee.toFixed(2)} د.أ`
                          : `Delivery fee for this area: ${areaFee.toFixed(2)} JOD`}
                      </p>
                    )
                  )}
                  <Field label={t("address")} error={errors["address"]} errText={t("required")}>
                    {(p) => (
                      <textarea
                        rows={2}
                        className={inputCls}
                        value={form.address}
                        onChange={(e) => set("address", e.target.value)}
                        {...p}
                      />
                    )}
                  </Field>
                </>
              )}

              <div className="grid gap-3 min-[360px]:grid-cols-2">
                <Field label={t("date")} error={errors["date"]} errText={t("required")}>
                  {(p) => (
                    <input type="date" className={inputCls} value={form.date} onChange={(e) => set("date", e.target.value)} {...p} />
                  )}
                </Field>
                <Field label={t("time")} error={errors["time"]} errText={t("required")}>
                  {(p) => (
                    <input type="time" className={inputCls} value={form.time} onChange={(e) => set("time", e.target.value)} {...p} />
                  )}
                </Field>
              </div>

              <Field label={t("orderNotes")}>
                {(p) => (
                  <textarea
                    rows={2}
                    className={inputCls}
                    placeholder={t("notesPh")}
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    {...p}
                  />
                )}
              </Field>
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="space-y-3 border-t border-border bg-card px-4 py-4 sm:px-5">
            <Row label={t("subtotal")} value={`${subtotal.toFixed(2)} ${t("jod")}`} />
            <Row label={t("delivery")} value={`${deliveryFee.toFixed(2)} ${t("jod")}`} />
            <Row label={t("total")} value={`${total.toFixed(2)} ${t("jod")}`} strong />
            {stage === "cart" ? (
              <>
                <button
                  onClick={() => setStage("checkout")}
                  className="min-h-12 w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
                >
                  {t("checkout")}
                </button>
                <button onClick={clear} className="min-h-11 w-full text-center text-xs text-foreground underline">
                  {t("clear")}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => void send()}
                  disabled={sending}
                  className="min-h-12 w-full rounded-full bg-whatsapp py-3.5 text-sm font-bold text-whatsapp-foreground transition-transform hover:scale-[1.01] disabled:opacity-70"
                >
                  {sending ? (lang === "ar" ? "جارٍ تسجيل الطلب…" : "Saving order…") : t("sendWhats")}
                </button>
                {saveError && (
                  <p className="text-center text-xs font-semibold text-destructive">
                    {lang === "ar"
                      ? "تعذّر تسجيل الطلب في النظام، لكن رسالة واتساب جاهزة للإرسال."
                      : "Could not save the order to the system, but your WhatsApp message is ready."}
                  </p>
                )}

                <button
                  onClick={() => setStage("cart")}
                  className="min-h-11 w-full text-center text-xs text-foreground underline"
                >
                  {t("back")}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full min-h-12 rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold";

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
  const props: FieldProps = { id, ...(error ? { "aria-invalid": true as const, "aria-describedby": errId } : {}) };
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-bold tracking-wide text-muted-foreground uppercase">
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? "font-display text-base font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-display text-base font-semibold" : ""}>{value}</span>
    </div>
  );
}
