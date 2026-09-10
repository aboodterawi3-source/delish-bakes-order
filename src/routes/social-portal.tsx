import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ClipboardCopy, Loader2, LogOut, MessageCircle, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createSocialOrder,
  getSocialAccess,
  getSocialProducts,
  type SocialOrderInput,
} from "@/lib/social.functions";

export const Route = createFileRoute("/social-portal")({
  head: () => ({
    meta: [
      { title: "بوابة السوشال ميديا | Delish Social Portal" },
      { name: "description", content: "إدخال طلبات ديليش من فريق السوشال ميديا فوراً إلى المبيعات والمطبخ." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "بوابة السوشال ميديا | Delish Social Portal" },
      { property: "og:description", content: "Social media order entry portal for Delish Cake & Bake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/social-login" });
  },
  component: SocialPortalPage,
});

const emptyForm = {
  customer_name: "",
  customer_phone: "",
  product_id: "",
  quantity: 1,
  method: "pickup" as "pickup" | "delivery",
  requested_date: "",
  requested_time: "",
  event_date: "",
  is_urgent: false,
  design_notes: "",
  staff_notes: "",
};

const jd = (value: number) => `${value.toFixed(2)} د.أ`;

/** Official Delish store WhatsApp number (international format, no "+"). */
const WHATSAPP_NUMBER = "962779179995";
/** Universal share link — uses wa.me directly, no API endpoints or iframes. */
const whatsappUrl = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

function SocialPortalPage() {
  const navigate = useNavigate();
  const accessFn = useServerFn(getSocialAccess);
  const productsFn = useServerFn(getSocialProducts);
  const createFn = useServerFn(createSocialOrder);

  const [form, setForm] = useState(emptyForm);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const access = useQuery({ queryKey: ["social-access"], queryFn: () => accessFn({}) });
  const products = useQuery({
    queryKey: ["social-products"],
    queryFn: () => productsFn({}),
    enabled: access.data?.allowed === true,
  });

  const set = useCallback(<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setCopied(false);
  }, []);

  const product = useMemo(
    () => (products.data ?? []).find((row) => row.id === form.product_id) ?? null,
    [products.data, form.product_id],
  );
  const total = (product?.price ?? 0) * form.quantity;

  /** Customer-facing summary — internal staff notes are deliberately excluded. */
  const summary = useMemo(() => {
    const lines = [
      "طلب جديد · Delish Cake & Bake",
      `الاسم: ${form.customer_name || "—"}`,
      `الهاتف: ${form.customer_phone || "—"}`,
      `المنتج: ${product ? `${product.name_ar} × ${form.quantity}` : "—"}`,
      `الاستلام: ${form.method === "delivery" ? "توصيل" : "استلام من المحل"}`,
      `تاريخ ووقت التسليم: ${form.requested_date || "—"} ${form.requested_time || ""}`.trim(),
    ];
    if (form.event_date) lines.push(`تاريخ المناسبة: ${form.event_date}`);
    if (form.is_urgent) lines.push("🚨 طلب مستعجل");
    if (form.design_notes.trim()) lines.push(`ملاحظات التصميم: ${form.design_notes.trim()}`);
    if (product) lines.push(`الإجمالي: ${jd(total)}`);
    return lines.join("\n");
  }, [form, product, total]);

  const submit = useMutation({
    mutationFn: (input: SocialOrderInput) => createFn({ data: input }),
    onSuccess: (order) => {
      setDone(order.order_number);
      setError(null);
      setForm(emptyForm);
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("تعذّر النسخ · Copy failed");
    }
  }, [summary]);

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
      product_id: form.product_id,
      quantity: form.quantity,
      method: form.method,
      requested_date: form.requested_date,
      requested_time: form.requested_time,
      event_date: form.event_date || null,
      is_urgent: form.is_urgent,
      design_notes: form.design_notes,
      staff_notes: form.staff_notes,
    });
  };

  return (
    <main dir="rtl" className="min-h-dvh bg-background pb-16">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="me-auto">
            <h1 className="font-display text-xl font-bold text-foreground">بوابة السوشال ميديا</h1>
            <p className="text-xs text-muted-foreground">
              <span className="delish-wordmark">Delish</span> · إدخال الطلبات فوراً للمبيعات والمطبخ
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="تسجيل الخروج"
            className="grid h-12 w-12 place-items-center rounded-full border border-border text-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {done ? (
          <p role="status" className="mb-4 rounded-2xl bg-[oklch(0.62_0.13_150)]/15 p-4 text-sm font-bold text-foreground">
            تم إرسال الطلب {done} ويظهر الآن على شاشة المبيعات والمطبخ ✅
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mb-4 rounded-2xl bg-destructive/10 p-4 text-sm font-bold text-destructive">
            {error}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="grid gap-4 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold text-foreground">طلب جديد · New order</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-foreground">
              اسم العميل · Customer name
              <input
                required
                value={form.customer_name}
                onChange={(event) => set("customer_name", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-bold text-foreground">
              رقم الهاتف · Phone
              <input
                required
                dir="ltr"
                inputMode="tel"
                value={form.customer_phone}
                onChange={(event) => set("customer_phone", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </label>

            <label className="block text-sm font-bold text-foreground">
              المنتج · Product
              <select
                required
                value={form.product_id}
                onChange={(event) => set("product_id", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">اختر المنتج…</option>
                {(products.data ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name_ar} — {jd(row.price)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-foreground">
              الكمية · Quantity
              <input
                type="number"
                min="1"
                step="1"
                required
                value={form.quantity}
                onChange={(event) => set("quantity", Math.max(1, Number(event.target.value) || 1))}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </label>

            <fieldset className="text-sm font-bold text-foreground">
              <legend>طريقة التسليم · Fulfilment</legend>
              <div className="mt-1 flex gap-2">
                {(["pickup", "delivery"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => set("method", method)}
                    aria-pressed={form.method === method}
                    className={`min-h-12 flex-1 rounded-full px-3 text-sm font-bold ${form.method === method ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}
                  >
                    {method === "pickup" ? "استلام من المحل" : "توصيل"}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm font-bold text-foreground">
              تاريخ المناسبة · Event date
              <input
                type="date"
                value={form.event_date}
                onChange={(event) => set("event_date", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </label>

            <label className="block text-sm font-bold text-foreground">
              تاريخ التسليم/الاستلام · Pickup/Delivery date
              <input
                type="date"
                required
                value={form.requested_date}
                onChange={(event) => set("requested_date", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-bold text-foreground">
              وقت التسليم/الاستلام · Time
              <input
                type="time"
                required
                value={form.requested_time}
                onChange={(event) => set("requested_time", event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => set("is_urgent", !form.is_urgent)}
            aria-pressed={form.is_urgent}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold ${form.is_urgent ? "bg-destructive text-destructive-foreground" : "border border-destructive text-destructive"}`}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> 🚨 مستعجل · Urgent
          </button>

          <label className="block text-sm font-bold text-foreground">
            ملاحظات التصميم الخاص · Special custom design notes
            <textarea
              rows={3}
              value={form.design_notes}
              onChange={(event) => set("design_notes", event.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"
            />
          </label>

          <label className="block text-sm font-bold text-foreground">
            ملاحظات داخلية للموظفين · Internal staff notes
            <textarea
              rows={3}
              value={form.staff_notes}
              onChange={(event) => set("staff_notes", event.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"
            />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              خاصة بالمبيعات والإدارة فقط — لا تظهر على شاشة المطبخ ولا في رسالة واتساب.
            </span>
          </label>

          {product ? (
            <p className="text-sm font-bold text-foreground">الإجمالي التقديري: {jd(total)}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submit.isPending}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              إرسال فوري للطلب
            </button>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-primary px-5 text-sm font-bold text-primary"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <ClipboardCopy className="h-4 w-4" aria-hidden="true" />}
              {copied ? "تم النسخ" : "نسخ رسالة واتساب"}
            </button>
          </div>
        </form>

        <section className="mt-5 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-bold text-foreground">معاينة رسالة واتساب</h2>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-secondary/60 p-3 text-sm text-foreground">{summary}</pre>
        </section>
      </div>
    </main>
  );
}
