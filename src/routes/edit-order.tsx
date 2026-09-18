// Full revised edit-order page – see implementation plan above (components inlined for simplicity)
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

import { DelishLogo } from "@/components/delish/DelishLogo";
import { getOrderByEditToken, submitOrderEdit } from "@/lib/authorization.functions";
import { formatApiError } from "@/lib/formatApiError";
import { orderLabel } from "@/lib/order-label";

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

  // get token from URL once
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
  }, []);

  const orderQuery = useQuery({
    queryKey: ["edit-order", token],
    queryFn: () => loadFn({ data: { token: token ?? "" } }),
    enabled: Boolean(token),
    retry: false,
  });

  // fill fields when data arrives
  useEffect(() => {
    const row = orderQuery.data?.order;
    if (!row) return;
    setDate(row.requested_date ?? "");
    setTime(String(row.requested_time ?? "").slice(0, 5));
  }, [orderQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => submitFn({ data: { token: token ?? "", requested_date: date, requested_time: time } }),
  });

  // expiration handling
  const expiresAt = orderQuery.data?.expires_at ? new Date(orderQuery.data.expires_at).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const expired = expiresAt !== null && expiresAt <= now;
  const minutesLeft = expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 60_000));

  // UI flags
  const booting = token === null || (Boolean(token) && orderQuery.isPending);
  const missingToken = !token && !booting;
  const apiError = orderQuery.isError ? formatApiError(orderQuery.error) : null;
  const linkExpired = expired && !saveMutation.isSuccess;
  const success = saveMutation.isSuccess;

  // stepper UI (simple text) – could be replaced with a full stepper component later
  const Stepper = () => (
    <ol className="flex gap-2 text-sm mb-4 justify-center">
      <li className="font-bold text-[#B8860B]">1️⃣ اختيار التاريخ</li>
      <li className="font-bold text-[#B8860B]">2️⃣ اختيار الوقت</li>
      <li className="font-bold text-[#B8860B]">3️⃣ حفظ</li>
    </ol>
  );

  return (
    <main dir="rtl" lang="ar" className="min-h-dvh w-full bg-[#F9FBFC] px-4 py-10 text-[#3E2723]">
      <div className="mx-auto w-full max-w-md">
        {/* Header with logo and optional greeting */}
        <div className="flex flex-col items-center mb-6">
          <DelishLogo size="lg" showSubtitle />
          {orderQuery.data?.order && (
            <header className="text-center mt-4">
              <h1 className="font-display text-xl font-bold text-[#3E2723]">
                طلب <span dir="ltr">{orderLabel(orderQuery.data.order.order_number, orderQuery.data.order.staff_code)}</span>
              </h1>
              <p className="mt-1 text-sm text-[#7A6458]">أهلاً {orderQuery.data.order.customer_name}</p>
            </header>
          )}
        </div>
        <section className="mt-8 rounded-3xl border border-[#B8860B]/25 bg-white p-6 shadow-sm">
          {/* Status handling */}
          {booting && (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-[#7A6458]">
              <Loader2 className="h-4 w-4 animate-spin text-[#B8860B]" aria-hidden="true" />
              جارٍ تحميل تفاصيل طلبك…
            </p>
          )}
          {missingToken && (
            <p className="rounded-2xl bg-[#FDE2CF]/60 p-4 text-sm font-bold text-[#7B3F00]">
              الرابط غير مكتمل. تواصل مع فريق ديليش للحصول على رابط جديد.
            </p>
          )}
          {apiError && (
            <p className="rounded-2xl bg-red-100 p-4 text-sm font-bold text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {apiError}
            </p>
          )}
          {linkExpired && (
            <p className="rounded-2xl bg-amber-100 p-4 text-sm font-bold text-amber-800">
              انتهت صلاحية هذا الرابط (صالح لمدة ساعة واحدة فقط). تواصل مع فريق ديليش للحصول على رابط جديد.
            </p>
          )}
          {success && (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#B8860B]" aria-hidden="true" />
              <p className="text-base font-bold text-[#3E2723]">تم حفظ الموعد الجديد بنجاح</p>
              <p className="text-sm text-[#7A6458]">
                موعد طلبك الآن {date} الساعة {time}. شكراً لاختيارك مخبز ديليش 🌸
              </p>
            </div>
          )}

          {/* Editing form */}
          {!booting && !missingToken && !apiError && !linkExpired && !success && (
            <>
              <Stepper />
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#B8860B]/20 bg-[#F9FBFC] p-4">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-[#8B4513]">
                    <CalendarClock className="h-4 w-4 text-[#B8860B]" aria-hidden="true" />
                    تعديل موعد الاستلام أو التوصيل
                  </h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-bold text-[#3E2723]">
                      التاريخ
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="mt-1 min-h-12 w-full rounded-xl border border-[#B8860B]/30 bg-white px-3 text-sm text-[#3E2723] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]"
                        aria-label="اختر التاريخ"
                      />
                    </label>
                    <label className="block text-sm font-bold text-[#3E2723]">
                      الوقت
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="mt-1 min-h-12 w-full rounded-xl border border-[#B8860B]/30 bg-white px-3 text-sm text-[#3E2723] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]"
                        aria-label="اختر الوقت"
                      />
                    </label>
                  </div>
                </div>
                {saveMutation.isError && (
                  <p className="rounded-2xl bg-red-100 p-3 text-xs font-bold text-red-800">
                    {formatApiError(saveMutation.error)}
                  </p>
                )}
                <button
                  type="button"
                  disabled={saveMutation.isPending || expired || !date || !time}
                  onClick={() => saveMutation.mutate()}
                  className="min-h-12 w-full rounded-full bg-[#8B4513] px-6 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                >
                  {saveMutation.isPending ? (
                    <> <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> جارٍ الحفظ…</>
                  ) : (
                    "حفظ التعديلات"
                  )}
                </button>
                <p className="text-center text-[11px] text-[#7A6458]">
                  هذا الرابط يعمل لمرة واحدة وتنتهي صلاحيته بعد ساعة{minutesLeft > 0 ? ` — يتبقّى ${minutesLeft} دقيقة` : ""}.
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
