import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { getOrderByEditToken, submitOrderEdit } from "@/lib/authorization.functions";

export const Route = createFileRoute("/order-edit")({
  head: () => ({
    meta: [
      { title: "تعديل طلبك | Delish Jordan" },
      { name: "description", content: "عدّل ملاحظات طلبك والكتابة على الكيك عبر رابط آمن لمرة واحدة." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "تعديل طلبك | Delish Jordan" },
      { property: "og:description", content: "رابط آمن لتعديل تفاصيل طلبك من Delish Jordan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderEditPage,
});

function OrderEditPage() {
  const [token, setToken] = useState("");
  const loadFn = useServerFn(getOrderByEditToken);
  const submitFn = useServerFn(submitOrderEdit);

  const [notes, setNotes] = useState("");
  const [inscription, setInscription] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
  }, []);

  const order = useQuery({
    queryKey: ["order-edit", token],
    queryFn: () => loadFn({ data: { token } }),
    enabled: token.length > 0,
    retry: false,
  });

  useEffect(() => {
    const row = order.data?.order;
    if (!row) return;
    setNotes(row.notes ?? "");
    setInscription(row.inscription ?? "");
    setPhone(row.customer_phone ?? "");
  }, [order.data]);

  const save = useMutation({
    mutationFn: () =>
      submitFn({ data: { token, notes, inscription, customer_phone: phone } }),
  });

  return (
    <main dir="rtl" className="min-h-dvh w-full bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold">تعديل طلبك · Edit your order</h1>

        {!token ? (
          <p className="mt-4 text-sm text-muted-foreground">الرابط غير مكتمل. اطلب رابطاً جديداً من فريق المبيعات.</p>
        ) : order.isPending ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> جارٍ التحميل…
          </p>
        ) : order.isError ? (
          <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">
            {(order.error as Error).message}
          </p>
        ) : save.isSuccess ? (
          <p className="mt-4 rounded-xl bg-primary/10 p-4 text-sm font-bold text-primary">
            تم حفظ التعديلات، شكراً لك. هذا الرابط أصبح مغلقاً.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              طلب رقم <span dir="ltr" className="font-bold text-foreground">{order.data?.order.order_number}</span>
            </p>

            <label className="block text-sm font-bold">
              رقم الهاتف · Phone
              <input
                dir="ltr"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </label>

            <label className="block text-sm font-bold">
              الكتابة على الكيك · Message on cake
              <input
                value={inscription}
                onChange={(event) => setInscription(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </label>

            <label className="block text-sm font-bold">
              ملاحظات · Notes
              <textarea
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm"
              />
            </label>

            {save.isError ? (
              <p className="rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">
                {(save.error as Error).message}
              </p>
            ) : null}

            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="min-h-12 w-full rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              {save.isPending ? "جارٍ الحفظ…" : "حفظ التعديلات · Save changes"}
            </button>
            <p className="text-[11px] text-muted-foreground">
              يمكن استخدام هذا الرابط مرة واحدة فقط وتنتهي صلاحيته بعد ساعة.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
