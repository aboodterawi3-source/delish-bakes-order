import { useRef, useState } from "react";
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
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";
import { DelishLogo } from "./DelishLogo";
import { submitCustomerMessage } from "@/lib/customer-messages.functions";

interface StorefrontMenuDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function StorefrontMenuDrawer({ open, onClose }: StorefrontMenuDrawerProps) {
  const [activeTab, setActiveTab] = useState<"story" | "location" | "policy" | "feedback">("story");
  const submitMessageFn = useServerFn(submitCustomerMessage);

  // Feedback form state
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackPhone, setFeedbackPhone] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("suggestion");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackHoneypot, setFeedbackHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (!open) return null;

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submittingRef.current) return;

    const name = feedbackName.trim();
    const phone = feedbackPhone.trim();
    const rawMsg = feedbackMessage.trim();

    if (!name || !phone || !rawMsg) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const catLabel =
      feedbackCategory === "complaint"
        ? "شكوى / ملاحظة"
        : feedbackCategory === "inquiry"
          ? "استفسار خاص"
          : "اقتراح وتحسين";

    const fullMessage = `[${catLabel}] ${rawMsg}`;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await submitMessageFn({
        data: {
          name,
          phone,
          message: fullMessage,
          honeypot: feedbackHoneypot.trim(),
        },
      });
      toast.success("شكراً لاهتمامك! تم إرسال رسالتك بنجاح وسيتواصل معك فريقنا في أقرب وقت 🌸");
      setFeedbackName("");
      setFeedbackPhone("");
      setFeedbackMessage("");
      setFeedbackHoneypot("");
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "تعذّر إرسال الرسالة، يرجى إعادة المحاولة أو التواصل معنا عبر واتساب.";
      toast.error(errorMsg);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const whatsappSupportUrl = getWhatsAppChatUrl(
    undefined,
    "مرحباً فريق ديليش! أرغب في الاستفسار عن الطلبات والخدمات.",
  );

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 transition-opacity duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="القائمة الرئيسية للمتجر"
    >
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Drawer Panel */}
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-background text-foreground shadow-2xl transition-transform duration-300 will-change-transform">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <DelishLogo size="sm" />
            <span className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-xs font-bold text-primary">
              مخبز ديليش · DELISH Bakes
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-border bg-background text-foreground hover:bg-secondary/40 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Tab Navigation */}
        <nav
          aria-label="أقسام القائمة"
          className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border bg-muted/40 p-1.5"
        >
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
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab Contents */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* TAB 1: OUR STORY */}
          {activeTab === "story" && (
            <div className="animate-in space-y-4 duration-200 fade-in">
              <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
                <Sparkles className="mx-auto h-7 w-7 text-primary" />
                <h3 className="font-display text-lg font-bold text-foreground">
                  صنِع بحب في عمّان 🤍
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  في مخبز ديليش، نؤمن بأن كل كيكة تحمل قصة احتفال دافئة. نستخدم أجود أنواع
                  الشوكولاتة البلجيكية، الفواكه الطازجة يومياً، والزبدة النيرلاندية الفاخرة لنقدم
                  لكم تجربة تذوّق ممتعة لا تُنسى.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 rounded-xl border border-border bg-card p-3 text-center">
                  <span className="text-xl">🎂</span>
                  <p className="text-xs font-bold text-foreground">طازج يومياً</p>
                  <p className="text-[10px] text-muted-foreground">خَبز فور الطلب</p>
                </div>
                <div className="space-y-1 rounded-xl border border-border bg-card p-3 text-center">
                  <span className="text-xl">✨</span>
                  <p className="text-xs font-bold text-foreground">تصاميم مخصصة</p>
                  <p className="text-[10px] text-muted-foreground">تنفيذ أدق التفاصيل</p>
                </div>
                <div className="space-y-1 rounded-xl border border-border bg-card p-3 text-center">
                  <span className="text-xl">🛵</span>
                  <p className="text-xs font-bold text-foreground">توصيل مبرّد</p>
                  <p className="text-[10px] text-muted-foreground">محافظة على الجودة</p>
                </div>
                <div className="space-y-1 rounded-xl border border-border bg-card p-3 text-center">
                  <span className="text-xl">⚡</span>
                  <p className="text-xs font-bold text-foreground">دفع آمن عبر كليك</p>
                  <p className="text-[10px] text-muted-foreground">CliQ &amp; Cash</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOCATION & HOURS */}
          {activeTab === "location" && (
            <div className="animate-in space-y-4 duration-200 fade-in">
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center gap-2 text-sm font-bold text-primary">
                  <MapPin className="h-4 w-4" />
                  <span>موقعنا في عمّان (الفرع الرئيسي)</span>
                </div>
                <p className="text-xs leading-relaxed font-medium text-foreground">
                  عمّان - شارع الشميساني الرئيسي، مقابل مجمع بنك الاتحاد
                </p>
                <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="flex items-center gap-1 font-bold text-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" /> ساعات العمل:
                  </span>
                  <span className="font-bold text-primary">9:00 صباحاً - 11:00 مساءً (يومياً)</span>
                </div>
              </div>

              <div className="space-y-1 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-xs font-bold text-foreground">
                  📞 للطلب المباشر أو المساعدة عبر الهاتف:
                </p>
                <a
                  href="tel:0790000000"
                  dir="ltr"
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-extrabold text-primary hover:underline"
                >
                  <PhoneCall className="h-4 w-4" /> +962 7 9000 0000
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: ORDERING & DELIVERY POLICY */}
          {activeTab === "policy" && (
            <div className="animate-in space-y-4 text-xs duration-200 fade-in">
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-xs">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Clock className="h-4 w-4 text-primary" /> مبيعات اليوم والكيك السريع
                </h4>
                <p className="leading-relaxed text-muted-foreground">
                  الطلب متاح طوال اليوم. يتم تجهيز كيك المبيعات والحلويات اليومية خلال 60 إلى 90
                  دقيقة للتوصيل في عمّان.
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-xs">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" /> الكيك المخصص والتصاميم الخاصة
                </h4>
                <p className="leading-relaxed text-muted-foreground">
                  يُنصح بالحجز قبل 24 ساعة على الأقل لضمان إتقان التفاصيل المطلوبة.
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-xs">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" /> الحفاظ على جودة الكيك
                </h4>
                <p className="leading-relaxed text-muted-foreground">
                  يتم نقل الطلبات في سيارات التوصيل المبردة. يُحفظ الكيك في الثلاجة مباشرة عند
                  الاستلام ويُخرج قبل التقديم بـ 15 دقيقة لضمان القوام المثالي.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: COMPLAINTS & FEEDBACK FORM */}
          {activeTab === "feedback" && (
            <form
              onSubmit={handleFeedbackSubmit}
              className="animate-in space-y-3 duration-200 fade-in"
            >
              {/* Honeypot field for anti-bot protection */}
              <div
                className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
                aria-hidden="true"
                tabIndex={-1}
              >
                <label htmlFor="drawer_website_hp">Website</label>
                <input
                  id="drawer_website_hp"
                  type="text"
                  name="website_url"
                  value={feedbackHoneypot}
                  onChange={(e) => setFeedbackHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <MessageSquare className="h-4 w-4 text-primary" /> خدمة العملاء والآراء
                </h4>
                <p className="text-xs text-muted-foreground">
                  يسعدنا استقبال اقتراحاتكم واستفساراتكم لضمان تقديم أرقى خدمة.
                </p>

                <label className="block text-xs font-bold text-foreground">
                  اسمك الكريم *
                  <input
                    type="text"
                    required
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
                  />
                </label>

                <label className="block text-xs font-bold text-foreground">
                  رقم الهاتف *
                  <input
                    dir="ltr"
                    type="tel"
                    required
                    value={feedbackPhone}
                    onChange={(e) => setFeedbackPhone(e.target.value)}
                    placeholder="079XXXXXXX"
                    className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
                  />
                </label>

                <label className="block text-xs font-bold text-foreground">
                  نوع الرسالة
                  <select
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground"
                  >
                    <option value="suggestion">اقتراح وتحسين</option>
                    <option value="complaint">شكوى أو ملاحظة على طلب</option>
                    <option value="inquiry">استفسار عن طلب خاص</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-foreground">
                  تفاصيل الرسالة *
                  <textarea
                    rows={3}
                    required
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="اكتب ملاحظاتك هنا..."
                    className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-xs text-foreground outline-none focus:border-primary"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting || submittingRef.current}
                  className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground shadow-xs hover:bg-primary/90 active:scale-95 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitting ? "جارٍ الإرسال…" : "إرسال الرسالة"}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Quick Support Action */}
        <footer className="space-y-2 border-t border-border bg-card p-4">
          <a
            href={whatsappSupportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 text-xs font-bold text-whatsapp-foreground shadow-xs hover:bg-whatsapp/90 active:scale-95"
          >
            <MessageSquare className="h-4 w-4" />
            <span>تواصل مباشرة عبر واتساب الدعم</span>
          </a>
          <p className="text-center text-[10px] text-muted-foreground">
            DELISH Bakes · Amman, Jordan
          </p>
        </footer>
      </aside>
    </div>
  );
}
