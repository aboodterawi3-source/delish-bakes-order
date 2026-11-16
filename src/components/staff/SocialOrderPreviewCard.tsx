import { Check, ClipboardCopy, MessageCircle, Sparkles } from "lucide-react";

interface SocialOrderPreviewCardProps {
  previewTab: "confirmation" | "modification";
  onChangeTab: (tab: "confirmation" | "modification") => void;
  activePreviewText: string;
  isCopied: boolean;
  onCopy: () => void;
  whatsappHref: string;
}

/** Live WhatsApp message preview supporting customer confirmation and staff modification formats. */
export function SocialOrderPreviewCard({
  previewTab,
  onChangeTab,
  activePreviewText,
  isCopied,
  onCopy,
  whatsappHref,
}: SocialOrderPreviewCardProps) {
  return (
    <section className="rounded-3xl border border-[#B8860B]/40 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#B8860B]" />
          <h2 className="font-display text-base font-bold text-foreground">
            معاينة رسائل الواتساب والتثبيت
          </h2>
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-border bg-secondary/70 p-1">
          <button
            type="button"
            onClick={() => onChangeTab("confirmation")}
            className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-black transition-all ${
              previewTab === "confirmation"
                ? "bg-[#8B4513] text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📌 مسج تثبيت الأوردر (للزبون)
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("modification")}
            className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-black transition-all ${
              previewTab === "modification"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🛑 مسج تثبيت التعديل (🛑 تعديل)
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-12 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-[#B8860B] bg-white px-4 text-sm font-bold text-[#8B4513] shadow-2xs transition hover:bg-[#FDE2CF]/30"
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
          )}
          {isCopied
            ? "تم النسخ بنجاح ✅"
            : previewTab === "confirmation"
              ? "نسخ مسج تثبيت الأوردر للزبون"
              : "نسخ مسج التعديل (🛑🛑🛑تعديل)"}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="إرسال على واتساب"
          title="إرسال على واتساب"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm transition hover:brightness-95"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        </a>
      </div>

      <pre
        dir="rtl"
        className="mt-3.5 max-h-96 overflow-y-auto rounded-2xl border border-border/80 bg-secondary/40 p-4 text-right font-sans text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground sm:text-sm"
      >
        {activePreviewText}
      </pre>
    </section>
  );
}
