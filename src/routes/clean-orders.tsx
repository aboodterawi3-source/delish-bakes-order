import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Sparkles, Trash2, ArrowRight, ShieldAlert, ShoppingBag, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { clearAllSalesOrders } from "@/lib/sales.functions";
import { DelishLogo } from "@/components/delish/DelishLogo";
import { BackgroundCurves } from "@/components/delish/BackgroundCurves";

export const Route = createFileRoute("/clean-orders")({
  validateSearch: (search) => {
    const raw = (search as { auto?: unknown }).auto;
    return { auto: raw === "true" || raw === true };
  },
  head: () => ({
    meta: [
      { title: "تنظيف كافة الطلبات | Delish Bakes" },
      { name: "description", content: "مسح وتنظيف كافة الطلبات من قاعدة البيانات للبدء من جديد." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CleanOrdersPage,
});

function CleanOrdersPage() {
  const search = Route.useSearch();
  const clearFn = useServerFn(clearAllSalesOrders);

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWipe = async () => {
    setBusy(true);
    setError(null);
    try {
      await clearFn();
      setDone(true);
      toast.success("تم مسح وتنظيف كافة الطلبات بنجاح ✅");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء تنظيف الطلبات";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (search.auto && !done && !busy) {
      void handleWipe();
    }
  }, [search.auto]);

  return (
    <main dir="rtl" className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#FDFBF7] px-4 py-10">
      <BackgroundCurves />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl text-center space-y-5">
        <div className="flex flex-col items-center">
          <DelishLogo size="md" />
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-800">
            <Trash2 className="h-3.5 w-3.5" />
            <span>صيانة قاعدة بيانات الطلبات</span>
          </div>
        </div>

        <div>
          <h1 className="font-display text-xl font-black text-foreground">
            تنظيف ومسح كافة الطلبات من الموقع
          </h1>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            تقوم هذه الأداة بمسح جميع الطلبات التجريبية والسابقة وبنودها من قاعدة البيانات
            بشكل كامل ونهائي، لتفريغ شاشات المبيعات، المطبخ، والجدول لتبدأ من جديد.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3.5 text-xs font-bold text-rose-800 text-start">
            ⚠️ {error}
          </div>
        )}

        {done ? (
          <div className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-5 text-center animate-fadeIn">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-base font-black text-emerald-950">
                تم تنظيف كافة الطلبات بنجاح!
              </h3>
              <p className="text-xs text-emerald-800 mt-1">
                قاعدة بيانات الطلبات فارغة تماماً الآن (0 طلبات). شاشات المطبخ، الكاشير وجدول الطلبات أصبحت جاهزة ونظيفة للطلبات الحقيقية.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Link
                to="/staff"
                search={{ tab: "orders" }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 transition"
              >
                <ClipboardList className="h-4 w-4" />
                <span>الذهاب إلى جدول الطلبات</span>
              </Link>
              <Link
                to="/staff"
                search={{ tab: "sales" }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-5 text-xs font-bold text-foreground hover:bg-secondary transition"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>شاشة المبيعات POS</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 text-start space-y-1">
              <div className="flex items-center gap-1.5 font-black text-amber-950">
                <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
                <span>تنبيه هام:</span>
              </div>
              <p>
                هذا الإجراء سيقوم بحذف جميع الطلبات وعناصرها وسجل التعديلات نهائياً من قاعدة البيانات.
              </p>
            </div>

            <button
              type="button"
              onClick={handleWipe}
              disabled={busy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 text-sm font-black text-white shadow-lg hover:bg-rose-700 active:scale-98 disabled:opacity-50 transition cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>جار مسح وتنظيف الطلبات من السيرفر...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-5 w-5" />
                  <span>نعم، امسح كافة الطلبات فوراً · Clear All Orders</span>
                </>
              )}
            </button>

            <div>
              <Link
                to="/staff"
                search={{ tab: "orders" }}
                className="text-xs text-muted-foreground hover:text-foreground font-bold underline"
              >
                ← إلغاء والعودة لجدول الطلبات
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
