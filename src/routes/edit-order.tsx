import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";

import { DelishLogo } from "@/components/delish/DelishLogo";
import { getOrderByEditToken, submitOrderEdit } from "@/lib/authorization.functions";

export const Route = createFileRoute("/edit-order")({
  head: () => ({
    meta: [
      { title: "تعديل موعد طلبك | مخبز ديليش" },
      { name: "description", content: "عدّل موعد استلام أو توصيل طلبك من مخبز ديليش عبر رابط آمن لمرة واحدة." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "تعديل موعد طلبك | مخبز ديليش" },
      { property: "og:description", content: "رابط آمن لتعديل موعد طلبك من مخبز ديليش." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditOrderPage,
});

function EditOrderPage() {
  const [token, setToken] = useState<string | null>(null);
  const loadFn = useServerFn(getOrderByEditToken);
  const submitFn = useServerFn(submitOrderEdit);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
  }, []);

  const order = useQuery({
    queryKey: ["edit-order", token],
    queryFn: () => loadFn({ data: { token: token ?? "" } }),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    const row = order.data?.order;
    if (!row) return;
    setDate(row.requested_date ?? "");
    setTime(String(row.requested_time ?? "").slice(0, 5));
  }, [order.data]);

  const save = useMutation({
    mutationFn: () =>
      submitFn({ data: { token: token ?? "", requested_date: date, requested_time: time } }),
  });

  /** The link is still being read from the URL — show nothing but the brand, never an error. */
  const booting = token === null || (Boolean(token) && order.isPending);

  /** The link dies exactly one hour after the sales team created it. */
  const expiresAt = order.data?.expires_at ? new Date(order.data.expires_at).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const expired = expiresAt !== null && expiresAt <= now;
  const minutesLeft = expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 60_000));

  return (
    <main dir="rtl" lang="ar" className="min-h-dvh w-full bg-[#F9FBFC] px-4 py-10 text-[#3E2723]">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center">
          <DelishLogo size="lg" showSubtitle />
        </div>

        <section className="mt-8 rounded-3xl border border-[#B8860B]/25 bg-white p-6 shadow-sm">
          {booting ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-[#7A6458]">
              <Loader2 className="h-4 w-4 animate-spin text-[#B8860B]" aria-hidden="true" />
              جارٍ تحميل تفاصيل طلبك…
            </p>
          ) : !token ? (
            <p className="rounded-2xl bg-[#FDE2CF]/60 p-4 text-sm font-bold text-[#7B3F00]">
              الرابط غير مكتمل. تواصل مع فريق ديليش للحصول على رابط جديد.
            </p>
          ) : order.isError ? (
            <p className="rounded-2xl bg-[#FDE2CF]/60 p-4 text-sm font-bold text-[#7B3F00]">
              {(order.error as Error).message.split("·")[0]?.trim() || "رابط غير صالح"}
            </p>
          ) : expired && !save.isSuccess ? (
            <p className="rounded-2xl bg-[#FDE2CF]/60 p-4 text-sm font-bold text-[#7B3F00]">
              انتهت صلاحية هذا الرابط (صالح لمدة ساعة واحدة فقط). تواصل مع فريق ديليش للحصول على
              رابط جديد.
            </p>
          ) : save.isSuccess ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#B8860B]" aria-hidden="true" />
              <p className="text-base font-bold text-[#3E2723]">تم حفظ الموعد الجديد بنجاح</p>
              <p className="text-sm text-[#7A6458]">
                موعد طلبك الآن {date} الساعة {time}. شكراً لاختيارك مخبز ديليش 🌸
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <header className="text-center">
                <h1 className="font-display text-xl font-bold text-[#3E2723]">
                  طلب رقم <span dir="ltr">{order.data?.order.order_number}</span>
                </h1>
                <p className="mt-1 text-sm text-[#7A6458]">أهلاً {order.data?.order.customer_name}</p>
              </header>

              <div className="rounded-2xl border border-[#B8860B]/20 bg-[#F9FBFC] p-4">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#8B4513]">
                  <CalendarClock className="h-4 w-4 text-[#B8860B]" aria-hidden="true" />
                  تعديل موعد الاستلام أو التوصيل
                </h2>
                <div className="mt-3 grid gap-3">
                  <label className="block text-sm font-bold text-[#3E2723]">
                    التاريخ
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="mt-1 min-h-12 w-full rounded-xl border border-[#B8860B]/30 bg-white px-3 text-sm text-[#3E2723] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]"
                    />
                  </label>
                  <label className="block text-sm font-bold text-[#3E2723]">
                    الوقت
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                      className="mt-1 min-h-12 w-full rounded-xl border border-[#B8860B]/30 bg-white px-3 text-sm text-[#3E2723] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]"
                    />
                  </label>
                </div>
              </div>

              {save.isError ? (
                <p className="rounded-2xl bg-[#FDE2CF]/60 p-3 text-xs font-bold text-[#7B3F00]">
                  {(save.error as Error).message.split("·")[0]?.trim() || "تعذّر الحفظ"}
                </p>
              ) : null}

              <button
                type="button"
                disabled={save.isPending || expired || !date || !time}
                onClick={() => save.mutate()}
                className="min-h-12 w-full rounded-full bg-[#8B4513] px-6 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
              >
                {save.isPending ? "جارٍ الحفظ…" : "حفظ التعديلات"}
              </button>

              <p className="text-center text-[11px] text-[#7A6458]">
                هذا الرابط يعمل لمرة واحدة وتنتهي صلاحيته بعد ساعة.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
