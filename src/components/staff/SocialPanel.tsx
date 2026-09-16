import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ClipboardCopy, Loader2, LogOut, MessageCircle, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createSocialOrder,
  getSocialAccess,
  type SocialOrderInput,
} from "@/lib/social.functions";
import { DELIVERY_ZONES, OTHER_GOVERNORATES_AREA, feeForArea } from "@/lib/delivery-zones";
import { buildConfirmationMessage, remainingBalance } from "@/lib/confirmation-message";
import {
  CakeCustomizationPanel,
  customizationSummary,
  emptyCustomization,
  type Customization,
} from "@/components/delish/CakeCustomizationPanel";



const emptyForm = {
  customer_name: "",
  customer_phone: "",
  order_details: "",
  quantity: 1,
  /** Original agreed price per unit (السعر الأصلي). */
  unit_price: "",
  card_note: "",
  
  method: "pickup" as "pickup" | "delivery",
  area: "",
  address: "",
  payment_option: "cash" as "cash" | "cliq_full" | "cliq_deposit",
  deposit_paid: "",
  requested_date: "",
  requested_time: "",
  event_date: "",
  is_urgent: false,
  design_notes: "",
  staff_notes: "",
};

/** Official Delish store WhatsApp number (international format, no "+"). */
const WHATSAPP_NUMBER = "962779179995";
/** Universal share link — uses wa.me directly, no API endpoints or iframes. */
const whatsappUrl = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export function SocialPanel() {
  const navigate = useNavigate();
  const accessFn = useServerFn(getSocialAccess);
  const createFn = useServerFn(createSocialOrder);

  const [form, setForm] = useState(emptyForm);
  const [customization, setCustomization] = useState<Customization>(emptyCustomization);
  const [copied, setCopied] = useState<"summary" | "confirmation" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** Confirmation message returned with the created order (real order number). */
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const access = useQuery({ queryKey: ["social-access"], queryFn: () => accessFn({}) });

  const set = useCallback(<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setCopied(null);
  }, []);

  const extras = useMemo(() => customizationSummary(customization), [customization]);

  const areaFee = feeForArea(form.area);
  const deliveryFee = form.method === "delivery" ? areaFee ?? 0 : 0;
  const paymentLabel =
    form.payment_option === "cliq_full"
      ? `كليك دفع كامل: ${(Number(form.deposit_paid) || 0).toFixed(2)} د.أ`
      : form.payment_option === "cliq_deposit"
        ? `عربون عبر كليك: ${(Number(form.deposit_paid) || 0).toFixed(2)} د.أ`
        : "كاش عند الاستلام";

  /** Live financial calculator: original price → delivery → total → paid → remaining. */
  const unitPrice = Math.max(Number(form.unit_price) || 0, 0);
  const originalPrice = unitPrice * form.quantity;
  const paidAmount = form.payment_option === "cash" ? 0 : Math.max(Number(form.deposit_paid) || 0, 0);
  const grandTotal = originalPrice + deliveryFee;
  const remaining = remainingBalance(grandTotal, paidAmount);


  /** Customer-facing summary — internal staff notes are deliberately excluded. */
  const summary = useMemo(() => {
    const lines = [
      "طلب جديد · Delish Cake & Bake",
      `الاسم: ${form.customer_name || "—"}`,
      `الهاتف: ${form.customer_phone || "—"}`,
      `تفاصيل الطلب: ${form.order_details.trim() || "—"}`,
      `الكمية: ${form.quantity}`,
      `الاستلام: ${form.method === "delivery" ? "توصيل" : "استلام من المحل"}`,
      `طريقة الدفع: ${paymentLabel}`,
      `تاريخ ووقت التسليم: ${form.requested_date || "—"} ${form.requested_time || ""}`.trim(),
    ];
    if (form.method === "delivery" && form.area) {
      lines.push(`المنطقة: ${form.area}`);
      lines.push(
        form.area === OTHER_GOVERNORATES_AREA
          ? "أجرة التوصيل: ٥–٨ د.أ يحددها الفريق حسب العنوان"
          : `أجرة التوصيل: ${deliveryFee.toFixed(2)} د.أ`,
      );
    }
    if (form.method === "delivery" && form.address.trim()) lines.push(`العنوان: ${form.address.trim()}`);
    if (form.event_date) lines.push(`تاريخ المناسبة: ${form.event_date}`);
    if (form.is_urgent) lines.push("🚨 طلب مستعجل");
    if (extras.ar.length) lines.push(...extras.ar.map((line) => `• ${line}`));
    const extraNotes = customization.notes.trim();
    if (extraNotes) lines.push(`ملاحظات إضافية: ${extraNotes}`);
    if (form.design_notes.trim()) lines.push(`ملاحظات التصميم: ${form.design_notes.trim()}`);
    return lines.join("\n");
  }, [form, extras, customization.notes, paymentLabel, deliveryFee]);

  /** Official confirmation message. The order number is filled in on the server. */
  const confirmationTemplate = useMemo(
    () =>
      buildConfirmationMessage({
        orderNumber: "{{ORDER_NUMBER}}",
        customerName: form.customer_name,
        when: `${form.requested_date} ${form.requested_time}`.trim(),
        fulfilment:
          form.method === "delivery"
            ? `توصيل · ${form.area || "—"}${form.address.trim() ? ` — ${form.address.trim()}` : ""}`
            : "استلام من المحل",
        items: [`${form.quantity} × ${form.order_details.trim() || "—"}`, ...extras.ar],
        cakeWriting: form.design_notes || customization.topperText,
        cardWriting: form.card_note,
        extraNote: form.is_urgent ? "طلب مستعجل · Urgent" : "",
        notes: customization.notes,
        
        price: originalPrice,
        deliveryFee,
        total: grandTotal,
        paid: paidAmount,
        paymentMethod: paymentLabel,
        recipientPhone: customization.recipientPhone || form.customer_phone,
        senderPhone: customization.senderPhone,
      }),
    [form, extras.ar, customization, originalPrice, deliveryFee, grandTotal, paidAmount, paymentLabel],
  );

  /** What staff see and copy: the placeholder is only meaningful after saving. */
  const confirmationPreview = savedMessage
    ? savedMessage
    : confirmationTemplate.replace("{{ORDER_NUMBER}}", "(يُضاف تلقائياً عند الإرسال)");


  const submit = useMutation({
    mutationFn: (input: SocialOrderInput) => createFn({ data: input }),
    onSuccess: (order) => {
      setDone(order.order_number);
      setError(null);
      setSavedMessage(order.confirmation_message ?? null);
      setForm(emptyForm);
      setCustomization(emptyCustomization);
    },

    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const copy = useCallback(async (text: string, which: "summary" | "confirmation") => {
    // Primary: async Clipboard API. Fallback: hidden textarea + execCommand
    // for browsers/contexts where clipboard.writeText is blocked.
    const legacyCopy = () => {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.insetInlineStart = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      if (!ok) throw new Error("copy failed");
    };
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        legacyCopy();
      }
      setCopied(which);
      setError(null);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      try {
        legacyCopy();
        setCopied(which);
        setError(null);
        window.setTimeout(() => setCopied(null), 2500);
      } catch {
        setError("تعذّر النسخ · Copy failed — حدّد النص من المعاينة وانسخه يدوياً");
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/social-login", replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 6000);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (access.isPending) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="جار التحميل" />
      </main>
    );
  }

  if (!access.data?.allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-background px-4 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="font-display text-2xl font-bold text-foreground">لا تملك صلاحية السوشال</h1>
          <p className="text-sm text-muted-foreground">This account has no social portal access. Ask an admin to grant the social role.</p>
          <button type="button" onClick={signOut} className="min-h-12 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submit.mutate({
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      order_details: form.order_details,
      quantity: form.quantity,
      unit_price: Number(form.unit_price) || 0,
      card_note: form.card_note,
      
      confirmation_message: confirmationTemplate,
      method: form.method,
      area: form.method === "delivery" ? form.area : null,
      address: form.method === "delivery" ? form.address : null,
      payment_option: form.payment_option,
      deposit_paid: form.payment_option === "cash" ? 0 : Number(form.deposit_paid) || 0,
      requested_date: form.requested_date,
      requested_time: form.requested_time,
      event_date: form.event_date || null,
      is_urgent: form.is_urgent,
      design_notes: [form.design_notes.trim(), customization.notes.trim()].filter(Boolean).join(" — "),
      staff_notes: form.staff_notes,
      extras_ar: extras.ar,
      extras_en: extras.en,
      design_image_url: customization.designImageUrl,
    });

  };

  return (
    <main dir="rtl" className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#F9FBFC] text-[#3E2723] bg-delish-pattern pb-16">
      <header className="border-b border-[#F1F5F9] bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto grid max-w-3xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FDE2CF] text-[#7B3F00] shadow-sm">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-lg font-bold text-[#3E2723] sm:text-xl">بوابة السوشال ميديا</h1>
              <span className="-mt-1 hidden font-script text-2xl italic text-[#8B4513] sm:inline">Delish</span>
            </div>
            <p className="truncate text-xs font-bold text-[#7A6458]">
              إدخال الطلبات فوراً للمبيعات والمطبخ · Social Order Entry
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="تسجيل الخروج"
            className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50 shadow-xs"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {done ? (
          <p role="status" className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm font-bold text-amber-900 shadow-xs">
            تم إرسال الطلب {done} ويظهر الآن على شاشة المبيعات والمطبخ ✅
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm font-bold text-red-900 shadow-xs">
            {error}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="grid min-w-0 gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_-8px_rgba(62,39,35,0.06)] sm:p-6">
          <h2 className="font-serif text-lg font-bold text-[#3E2723]">طلب جديد · New order</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-[#3E2723]">
              اسم العميل · Customer name
              <input
                required
                value={form.customer_name}
                onChange={(event) => set("customer_name", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>
            <label className="block text-sm font-bold text-[#3E2723]">
              رقم الهاتف · Phone
              <input
                required
                dir="ltr"
                inputMode="tel"
                value={form.customer_phone}
                onChange={(event) => set("customer_phone", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>

            <label className="block text-sm font-bold text-[#3E2723] sm:col-span-2">
              تفاصيل طلب الزبون · Customer Order Details
              <textarea
                required
                rows={5}
                maxLength={2000}
                value={form.order_details}
                onChange={(event) => set("order_details", event.target.value)}
                placeholder="اكتب تفاصيل الطلب كاملة: التصميم، الألوان، الكتابة، المكونات…"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>
            <label className="block text-sm font-bold text-[#3E2723]">
              الكمية · Quantity
              <input
                type="number"
                min="1"
                step="1"
                required
                value={form.quantity}
                onChange={(event) => set("quantity", Math.max(1, Number(event.target.value) || 1))}
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>
            <label className="block text-sm font-bold text-[#3E2723]">
              السعر الأصلي للحبة (د.أ) · Original price
              <input
                type="number"
                min="0"
                step="0.25"
                value={form.unit_price}
                onChange={(event) => set("unit_price", event.target.value)}
                placeholder="0.00"
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>

            <fieldset className="text-sm font-bold text-[#3E2723]">
              <legend>طريقة التسليم · Fulfilment</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {(["pickup", "delivery"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => set("method", method)}
                    aria-pressed={form.method === method}
                    className={`min-h-11 flex-1 rounded-xl px-4 text-xs font-bold transition-all ${
                      form.method === method
                        ? "bg-[#8B4513] text-white shadow-sm"
                        : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                    }`}
                  >
                    {method === "pickup" ? "استلام من المحل" : "توصيل"}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="text-sm font-bold text-[#3E2723] sm:col-span-2">
              <legend>طريقة الدفع · Payment method</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {(
                  [
                    { value: "cash", label: "كاش عند الاستلام" },
                    { value: "cliq_full", label: "كليك دفع كامل" },
                    { value: "cliq_deposit", label: "عربون عبر كليك" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set("payment_option", option.value)}
                    aria-pressed={form.payment_option === option.value}
                    className={`min-h-11 flex-[1_1_9rem] rounded-xl px-4 text-xs font-bold transition-all ${
                      form.payment_option === option.value
                        ? "bg-[#8B4513] text-white shadow-sm"
                        : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {form.payment_option !== "cash" ? (
                <label className="mt-2 block text-xs font-bold text-[#3E2723]">
                  {form.payment_option === "cliq_full"
                    ? "المبلغ الكامل المدفوع عبر كليك (د.أ)"
                    : "قيمة العربون المدفوع عبر كليك (د.أ)"}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    dir="ltr"
                    value={form.deposit_paid}
                    onChange={(event) => set("deposit_paid", event.target.value)}
                    className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>
              ) : null}
            </fieldset>

            {form.method === "delivery" ? (
              <>
                <label className="block text-sm font-bold text-[#3E2723]">
                  منطقة التوصيل · Delivery area
                  <select
                    required
                    value={form.area}
                    onChange={(event) => set("area", event.target.value)}
                    className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  >
                    <option value="">اختر المنطقة</option>
                    {DELIVERY_ZONES.map((zone) => (
                      <optgroup key={zone.labelEn} label={`${zone.labelAr} · ${zone.labelEn}`}>
                        {zone.areas.map((area) => (
                          <option key={`${zone.labelEn}-${area}`} value={area}>
                            {area === OTHER_GOVERNORATES_AREA
                              ? `${area} (٥–٨ د.أ)`
                              : `${area} — ${zone.fee.toFixed(2)} د.أ`}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-[#7A6458]">
                    {form.area === OTHER_GOVERNORATES_AREA
                      ? "أجرة التوصيل للمحافظات الأخرى من ٥ إلى ٨ د.أ — يحددها الفريق عند تأكيد العنوان."
                      : areaFee !== null
                        ? `أجرة التوصيل لهذه المنطقة: ${areaFee.toFixed(2)} د.أ`
                        : "تُحسب الأجرة تلقائياً بعد اختيار المنطقة."}
                  </span>
                </label>

                <label className="block text-sm font-bold text-[#3E2723]">
                  العنوان التفصيلي (اختياري)
                  <input
                    value={form.address}
                    onChange={(event) => set("address", event.target.value)}
                    className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
                  />
                </label>
              </>
            ) : null}


            <label className="block text-sm font-bold text-[#3E2723]">
              تاريخ التسليم · Date
              <input
                type="date"
                required
                value={form.requested_date}
                onChange={(event) => set("requested_date", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>

            <label className="block text-sm font-bold text-[#3E2723]">
              وقت التسليم · Time
              <input
                type="time"
                required
                value={form.requested_time}
                onChange={(event) => set("requested_time", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>

            <label className="block text-sm font-bold text-[#3E2723]">
              تاريخ المناسبة (اختياري)
              <input
                type="date"
                value={form.event_date}
                onChange={(event) => set("event_date", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => set("is_urgent", !form.is_urgent)}
            aria-pressed={form.is_urgent}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-xs font-bold transition-all ${
              form.is_urgent ? "bg-red-600 text-white shadow-sm" : "border border-red-300 text-red-700 bg-red-50/50 hover:bg-red-50"
            }`}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> 🚨 مستعجل · Urgent
          </button>

          <label className="block text-sm font-bold text-[#3E2723]">
            ملاحظات التصميم الخاص · Special custom design notes
            <textarea
              rows={3}
              value={form.design_notes}
              onChange={(event) => set("design_notes", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
            />
          </label>

          <div className="min-w-0 rounded-2xl border border-[#FDE2CF] bg-[#FDE2CF]/20 p-3 sm:p-4">
            <CakeCustomizationPanel value={customization} onChange={setCustomization} />
            {extras.ar.length ? (
              <ul className="mt-3 space-y-1 rounded-xl bg-white/80 p-3 text-xs font-bold text-[#5D2E17]">
                {extras.ar.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            ) : null}
          </div>



          <label className="block text-sm font-bold text-[#3E2723]">
            الكتابة على الكرت · Card note
            <input
              type="text"
              maxLength={1000}
              value={form.card_note}
              onChange={(event) => set("card_note", event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
            />
          </label>


          {/* Financial calculator — updates live as staff type. */}
          <div className="rounded-2xl border border-[#B8860B]/40 bg-[#FFF8EE] p-4">
            <h3 className="text-sm font-bold text-[#5D2E17]">الحساب · السعر، العربون، المتبقي</h3>
            <dl className="mt-2 space-y-1 text-sm text-[#3E2723]">
              <div className="flex justify-between gap-2">
                <dt>المبلغ ({form.quantity} × {(Number(form.unit_price) || 0).toFixed(2)})</dt>
                <dd className="font-bold">{originalPrice.toFixed(2)} د.أ</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>التوصيل</dt>
                <dd className="font-bold">{deliveryFee.toFixed(2)} د.أ</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>الحساب كامل</dt>
                <dd className="font-bold">{grandTotal.toFixed(2)} د.أ</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>المبلغ المدفوع</dt>
                <dd className="font-bold">{paidAmount.toFixed(2)} د.أ</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-[#B8860B]/30 pt-1 text-[#8B4513]">
                <dt className="font-bold">المبلغ المتبقي</dt>
                <dd className="font-bold">{remaining.toFixed(2)} د.أ</dd>
              </div>
            </dl>
          </div>

          <label className="block text-sm font-bold text-[#3E2723]">
            ملاحظات داخلية للموظفين · Internal staff notes
            <textarea
              rows={3}
              value={form.staff_notes}
              onChange={(event) => set("staff_notes", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8860B]"
            />
            <span className="mt-1 block text-xs font-normal text-[#7A6458]">
              خاصة بالمبيعات والإدارة فقط — لا تظهر على شاشة المطبخ ولا في رسالة واتساب.
            </span>
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={submit.isPending}
              className="inline-flex min-h-12 min-w-0 flex-[1_1_12rem] items-center justify-center gap-2 rounded-full bg-[#8B4513] px-4 text-center text-sm font-bold text-white shadow-sm hover:bg-[#5D2E17] disabled:opacity-60 transition sm:px-6"
            >
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              إرسال فوري للطلب
            </button>
          </div>
        </form>

        {/* One ready-to-use confirmation message: copy it, or send it compactly. */}
        <section className="mt-5 rounded-3xl border border-[#B8860B]/40 bg-card p-5">
          <h2 className="font-display text-base font-bold text-foreground">👑 رسالة تأكيد الطلب (Delish Cake)</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copy(confirmationPreview, "confirmation")}
              className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-[#B8860B] bg-white px-4 text-sm font-bold text-[#8B4513] hover:bg-[#FDE2CF]/30 transition"
            >
              {copied === "confirmation" ? <Check className="h-4 w-4" aria-hidden="true" /> : <ClipboardCopy className="h-4 w-4" aria-hidden="true" />}
              {copied === "confirmation" ? "تم النسخ" : "نسخ رسالة التأكيد"}
            </button>
            <a
              href={whatsappUrl(confirmationPreview)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="إرسال رسالة التأكيد على واتساب"
              title="إرسال على واتساب"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm hover:brightness-95 transition"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
          <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-secondary/60 p-3 text-sm text-foreground">{confirmationPreview}</pre>
        </section>
        </>
        ) : (
          <OrdersWorkspace />
        )}
      </div>
    </main>
  );
}
