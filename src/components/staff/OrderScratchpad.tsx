import { useEffect, useState } from "react";
import { Check, ClipboardCopy, FileText, Trash2 } from "lucide-react";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";

const STORAGE_KEY = "delish_staff_order_scratchpad";

/**
 * Local-only order draft box displayed at the top of Sales and Social screens.
 * Intentionally isolated from the order submission form, React Query cache, and Supabase.
 */
export function OrderScratchpad() {
  const [text, setText] = useState("");
  const { copied, copy, clear } = useCopyFeedback<"draft">(2000);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setText(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const updateText = (next: string) => {
    setText(next);
    clear();
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  };

  const handleCopy = async () => {
    if (!text.trim()) return;
    await copy(text, "draft");
  };

  return (
    <section
      aria-label="مسودة الطلب المؤقتة"
      className="mb-5 rounded-3xl border border-amber-300/70 bg-amber-50/50 p-4 shadow-2xs dark:border-amber-800/50 dark:bg-amber-950/20"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <label
            htmlFor="staff-order-scratchpad"
            className="text-xs font-black text-foreground sm:text-sm"
          >
            مسودة الطلب · Order Scratchpad
          </label>
          <span className="rounded-full border border-amber-400/50 bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-card dark:text-amber-200">
            مسودة مؤقتة — غير مربوطة بالنظام
          </span>
        </div>

        {text.trim().length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-xl border border-border bg-card px-2.5 text-[11px] font-bold text-foreground transition hover:bg-secondary"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span>{copied ? "تم النسخ" : "نسخ"}</span>
            </button>
            <button
              type="button"
              onClick={() => updateText("")}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>مسح</span>
            </button>
          </div>
        )}
      </div>

      <textarea
        id="staff-order-scratchpad"
        rows={3}
        value={text}
        onChange={(e) => updateText(e.target.value)}
        placeholder="اكتب أو الصق هنا تفاصيل المحادثة أو مسودة الطلب مؤقتاً قبل أو أثناء الإدخال (لا تُحفظ في الطلبات ولا تظهر للمطبخ)..."
        className="w-full rounded-2xl border border-amber-200/90 bg-card p-3 text-sm text-foreground transition outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </section>
  );
}
