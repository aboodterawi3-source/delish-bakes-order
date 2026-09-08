import { useState } from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { DELIVERY_FEE, WHATSAPP } from "@/lib/menu";
import { useCart } from "@/lib/cart";
import { useLang } from "@/lib/i18n";

type Form = {
  name: string;
  phone: string;
  method: "delivery" | "pickup";
  area: string;
  address: string;
  date: string;
  time: string;
  notes: string;
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
};

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const { lines, setQty, remove, clear, subtotal, count } = useCart();
  const [stage, setStage] = useState<"cart" | "checkout">("cart");
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, boolean>>>({});

  const deliveryFee = form.method === "delivery" && count > 0 ? DELIVERY_FEE : 0;
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
    if (form.notes.trim()) {
      L.push("");
      L.push(`${ar ? "ملاحظات إضافية" : "Additional notes"}: ${form.notes.trim()}`);
    }
    return L.join("\n");
  };

  const send = () => {
    if (!validate()) return;
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(buildMessage())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-cocoa/50 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col bg-background shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-display text-lg font-semibold">
            {stage === "cart" ? t("cart") : t("checkout")}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({count} {t("itemsCount")})
            </span>
          </h3>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full border border-border">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {lines.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">{t("emptyCart")}</p>}

          {stage === "cart" &&
            lines.map((l) => (
              <div key={l.key} className="flex gap-3 rounded-2xl border border-border p-3">
                {l.image && (
                  <img
                    src={l.image}
                    alt={lang === "ar" ? l.ar : l.en}
                    loading="lazy"
                    width={80}
                    height={80}
                    className="h-20 w-20 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{lang === "ar" ? l.ar : l.en}</p>
                    <button onClick={() => remove(l.key)} aria-label="Remove" className="shrink-0 text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                    {(lang === "ar" ? l.detailsAr : l.detailsEn).map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                    {l.notes && <li>{l.notes}</li>}
                  </ul>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 rounded-full border border-border px-2 py-1">
                      <button onClick={() => setQty(l.key, l.qty - 1)} aria-label="minus">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-5 text-center text-xs font-semibold">{l.qty}</span>
                      <button onClick={() => setQty(l.key, l.qty + 1)} aria-label="plus">
                        <Plus className="h-3.5 w-3.5" />
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
                <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label={t("phone")} error={errors["phone"]} errText={t("required")}>
                <input
                  className={inputCls}
                  inputMode="tel"
                  dir="ltr"
                  placeholder="07 9999 9999"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>

              <div>
                <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{t("method")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["delivery", "pickup"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => set("method", m)}
                      className={`rounded-2xl border px-3 py-2.5 text-sm ${
                        form.method === m ? "border-gold bg-secondary font-semibold" : "border-border text-muted-foreground"
                      }`}
                    >
                      {m === "delivery" ? t("deliveryOpt") : t("pickup")}
                    </button>
                  ))}
                </div>
              </div>

              {form.method === "delivery" && (
                <>
                  <Field label={t("area")} error={errors["area"]} errText={t("required")}>
                    <input className={inputCls} value={form.area} onChange={(e) => set("area", e.target.value)} />
                  </Field>
                  <Field label={t("address")} error={errors["address"]} errText={t("required")}>
                    <textarea
                      rows={2}
                      className={inputCls}
                      value={form.address}
                      onChange={(e) => set("address", e.target.value)}
                    />
                  </Field>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label={t("date")} error={errors["date"]} errText={t("required")}>
                  <input type="date" className={inputCls} value={form.date} onChange={(e) => set("date", e.target.value)} />
                </Field>
                <Field label={t("time")} error={errors["time"]} errText={t("required")}>
                  <input type="time" className={inputCls} value={form.time} onChange={(e) => set("time", e.target.value)} />
                </Field>
              </div>

              <Field label={t("orderNotes")}>
                <textarea
                  rows={2}
                  className={inputCls}
                  placeholder={t("notesPh")}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="space-y-3 border-t border-border bg-card px-5 py-4">
            <Row label={t("subtotal")} value={`${subtotal.toFixed(2)} ${t("jod")}`} />
            <Row label={t("delivery")} value={`${deliveryFee.toFixed(2)} ${t("jod")}`} />
            <Row label={t("total")} value={`${total.toFixed(2)} ${t("jod")}`} strong />
            {stage === "cart" ? (
              <>
                <button
                  onClick={() => setStage("checkout")}
                  className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
                >
                  {t("checkout")}
                </button>
                <button onClick={clear} className="w-full text-center text-xs text-muted-foreground underline">
                  {t("clear")}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={send}
                  className="w-full rounded-full bg-[#25D366] py-3.5 text-sm font-bold text-cocoa transition-transform hover:scale-[1.01]"
                >
                  {t("sendWhats")}
                </button>
                <button onClick={() => setStage("cart")} className="w-full text-center text-xs text-muted-foreground underline">
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
  "w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold";

function Field({
  label,
  error,
  errText,
  children,
}: {
  label: string;
  error?: boolean | undefined;
  errText?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      {children}
      {error && <p className="mt-1 text-[11px] text-destructive">{errText}</p>}
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
