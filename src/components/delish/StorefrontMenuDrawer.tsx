import { useState } from "react";
import {
  X,
  Heart,
  MapPin,
  Clock,
  Truck,
  MessageSquare,
  Send,
  PhoneCall,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { WHATSAPP } from "@/lib/menu";
import { DelishLogo } from "./DelishLogo";

interface StorefrontMenuDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function StorefrontMenuDrawer({ open, onClose }: StorefrontMenuDrawerProps) {
  const [activeTab, setActiveTab] = useState<"story" | "location" | "policy" | "feedback">("story");

  // Feedback form state
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackPhone, setFeedbackPhone] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("suggestion");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackName.trim() || !feedbackPhone.trim() || !feedbackMessage.trim()) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      toast.success("شكراً لاهتمامك! تم استلام رسالتك وسيتم التواصل معك خلال وقت قصير 🌸");
      setFeedbackName("");
      setFeedbackPhone("");
      setFeedbackMessage("");
      setSubmitting(false);
    }, 600);
  };

  const whatsappSupportUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
    "مرحباً فريق ديليش! أرغب في الاستفسار عن الطلبات والخدمات.",
  )}`;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="القائمة الرئيسية للمتجر"
    >
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Drawer Panel */}
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-[#FDFBF7] text-[#4A3B32] shadow-2xl transition-transform duration-300">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#EFE8DC] bg-white p-4">
          <div className="flex items-center gap-3">
            <DelishLogo size="sm" />
            <span className="rounded-full bg-[#FEF7EB] px-2.5 py-0.5 text-xs font-bold text-[#B8801C]">
              مخبز ديليش · DELISH Bakes
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="grid h-9 w-9 place-items-center rounded-full border border-[#EFE8DC] bg-[#FDFBF7] text-[#4A3B32] hover:bg-[#FEF7EB] hover:text-[#B8801C] active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Tab Navigation */}
        <nav aria-label="أقسام القائمة" className="no-scrollbar flex overflow-x-auto border-b border-[#EFE8DC] bg-[#FAF5EB] p-1.5 gap-1">
          {[
            { id: "story", label: "قصتنا 🌸", icon: Heart },
            { id: "location", label: "موقعنا وساعات العمل 📍", icon: MapPin },
            { id: "policy", label: "السياسات 🚚", icon: Truck },
            { id: "feedback", label: "الشكاوى والآراء 💬", icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                  active
                    ? "bg-[#B8801C] text-white shadow-xs scale-[1.02]"
                    : "text-[#4A3B32]/70 hover:bg-white/80 hover:text-[#26160F]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: OUR STORY */}
          {activeTab === "story" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[#B8801C]/20 bg-[#FEF7EB] p-4 text-center space-y-2">
                <Sparkles className="mx-auto h-8 w-8 text-[#B8801C] animate-pulse" />
                <h3 className="font-display text-lg font-bold text-[#26160F]">
                  صنِع بحب في عمّان 🤍
                </h3>
                <p className="text-xs leading-relaxed text-[#4A3B32]/80">
                  في مخبز ديليش، نؤمن بأن كل كيكة تحمل قصة احتفال دافئة. نستخدم أجود أنواع الشوكولاتة البلجيكية، الفواكه الطازجة يومياً، والزبدة النيرلاندية الفاخرة لنقدم لكم تجربة تذوّق ممتعة لا تُنسى.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#EFE8DC] bg-white p-3 text-center space-y-1">
                  <span className="text-xl">🎂</span>
                  <p className="text-xs font-bold text-[#26160F]">طازج يومياً</p>
                  <p className="text-[10px] text-[#4A3B32]/60">خَبز فور الطلب</p>
                </div>
                <div className="rounded-xl border border-[#EFE8DC] bg-white p-3 text-center space-y-1">
                  <span className="text-xl">✨</span>
                  <p className="text-xs font-bold text-[#26160F]">تصاميم مخصصة</p>
                  <p className="text-[10px] text-[#4A3B32]/60">تنفيذ أدق التفاصيل</p>
                </div>
                <div className="rounded-xl border border-[#EFE8DC] bg-white p-3 text-center space-y-1">
                  <span className="text-xl">🛵</span>
                  <p className="text-xs font-bold text-[#26160F]">توصيل مبرّد</p>
                  <p className="text-[10px] text-[#4A3B32]/60">محافظة على الجودة</p>
                </div>
                <div className="rounded-xl border border-[#EFE8DC] bg-white p-3 text-center space-y-1">
                  <span className="text-xl">⚡</span>
                  <p className="text-xs font-bold text-[#26160F]">دفع آمن عبر كليك</p>
                  <p className="text-[10px] text-[#4A3B32]/60">CliQ & Cash</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOCATION & HOURS (Single physical branch) */}
          {activeTab === "location" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[#EFE8DC] bg-white p-4 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-[#B8801C] font-bold text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>موقعنا في عمّان (الفرع الرئيسي)</span>
                </div>
                <p className="text-xs text-[#4A3B32] font-medium leading-relaxed">
                  عمّان - شارع الشميساني الرئيسي، مقابل مجمع بنك الاتحاد
                </p>
                <div className="flex items-center justify-between text-xs pt-3 border-t border-[#EFE8DC]">
                  <span className="flex items-center gap-1 font-bold text-[#26160F]">
                    <Clock className="h-3.5 w-3.5 text-[#B8801C]" /> ساعات العمل:
                  </span>
                  <span className="text-[#6E3917] font-bold">9:00 صباحاً - 11:00 مساءً (يومياً)</span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#B8801C]/20 bg-[#FEF7EB] p-4 text-center space-y-1">
                <p className="text-xs font-bold text-[#26160F]">📞 للطلب المباشر أو المساعدة عبر الهاتف:</p>
                <a
                  href="tel:0790000000"
                  dir="ltr"
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#B8801C] hover:text-[#9E6C14] hover:underline"
                >
                  <PhoneCall className="h-4 w-4" /> +962 7 9000 0000
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: ORDERING & DELIVERY POLICY */}
          {activeTab === "policy" && (
            <div className="space-y-4 text-xs animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[#EFE8DC] bg-white p-4 space-y-2 shadow-xs">
                <h4 className="font-bold text-[#26160F] text-sm flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-[#B8801C]" /> مبيعات اليوم والكيك السريع
                </h4>
                <p className="text-[#4A3B32]/80 leading-relaxed">
                  الطلب متاح طوال اليوم. يتم تجهيز كيك المبيعات والحلويات اليومية خلال 60 إلى 90 دقيقة للتوصيل في عمّان.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EFE8DC] bg-white p-4 space-y-2 shadow-xs">
                <h4 className="font-bold text-[#26160F] text-sm flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#B8801C]" /> الكيك المخصص والتصاميم الخاصة
                </h4>
                <p className="text-[#4A3B32]/80 leading-relaxed">
                  يُنصح بالحجز قبل 24 ساعة على الأقل لضمان إتقان التفاصيل المطلوبة.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EFE8DC] bg-white p-4 space-y-2 shadow-xs">
                <h4 className="font-bold text-[#26160F] text-sm flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#B8801C]" /> الحفاظ على جودة الكيك
                </h4>
                <p className="text-[#4A3B32]/80 leading-relaxed">
                  يتم نقل الطلبات في سيارات التوصيل المبردة. يُحفظ الكيك في الثلاجة مباشرة عند الاستلام ويُخرج قبل التقديم بـ 15 دقيقة لضمان القوام المثالي.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: COMPLAINTS & FEEDBACK FORM */}
          {activeTab === "feedback" && (
            <form onSubmit={handleFeedbackSubmit} className="space-y-3 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[#EFE8DC] bg-white p-4 space-y-3 shadow-xs">
                <h4 className="font-bold text-[#26160F] text-sm flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-[#B8801C]" /> خدمة العملاء والآراء
                </h4>
                <p className="text-xs text-[#4A3B32]/70">
                  يسعدنا استقبال اقتراحاتكم واستفساراتكم لضمان تقديم أرقى خدمة.
                </p>

                <label className="block text-xs font-bold text-[#26160F]">
                  اسمك الكريم *
                  <input
                    type="text"
                    required
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="mt-1 min-h-10 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs text-[#26160F] outline-none focus:border-[#B8801C]"
                  />
                </label>

                <label className="block text-xs font-bold text-[#26160F]">
                  رقم الهاتف *
                  <input
                    dir="ltr"
                    type="tel"
                    required
                    value={feedbackPhone}
                    onChange={(e) => setFeedbackPhone(e.target.value)}
                    placeholder="079XXXXXXX"
                    className="mt-1 min-h-10 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs text-[#26160F] outline-none focus:border-[#B8801C]"
                  />
                </label>

                <label className="block text-xs font-bold text-[#26160F]">
                  نوع الرسالة
                  <select
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value)}
                    className="mt-1 min-h-10 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] px-3 text-xs text-[#26160F]"
                  >
                    <option value="suggestion">اقتراح وتحسين</option>
                    <option value="complaint">شكوى أو ملاحظة على طلب</option>
                    <option value="inquiry">استفسار عن طلب خاص</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-[#26160F]">
                  تفاصيل الرسالة *
                  <textarea
                    rows={3}
                    required
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="اكتب ملاحظاتك هنا..."
                    className="mt-1 w-full rounded-xl border border-[#EFE8DC] bg-[#FDFBF7] p-3 text-xs text-[#26160F] outline-none focus:border-[#B8801C]"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#B8801C] px-4 text-xs font-extrabold text-white shadow-xs hover:bg-[#9E6C14] active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitting ? "جارٍ الإرسال…" : "إرسال الرسالة"}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Quick Support Action */}
        <footer className="border-t border-[#EFE8DC] bg-white p-4 space-y-2">
          <a
            href={whatsappSupportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#20ba59] active:scale-95"
          >
            <MessageSquare className="h-4 w-4" />
            <span>تواصل مباشرة عبر واتساب الدعم</span>
          </a>
          <p className="text-center text-[10px] text-[#4A3B32]/60">
            DELISH Bakes · Amman, Jordan
          </p>
        </footer>
      </aside>
    </div>
  );
}

