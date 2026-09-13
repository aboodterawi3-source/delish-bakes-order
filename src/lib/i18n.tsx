import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Languages } from "lucide-react";

export type Lang = "ar" | "en";

type Dict = Record<string, { ar: string; en: string }>;

const STORAGE_KEY = "delish-lang";

export const t_: Dict = {
  brandTag: { ar: "حلويات فاخرة · عمّان، الأردن", en: "Luxury Patisserie · Amman, Jordan" },
  navMenu: { ar: "القائمة", en: "Menu" },
  navBuilder: { ar: "صمّم كيكتك", en: "Cake Builder" },
  navAbout: { ar: "من نحن", en: "About" },
  navContact: { ar: "تواصل", en: "Contact" },
  heroTitle: { ar: "كل قطعة… لحظة فرح", en: "Every bite, a little celebration" },
  heroSub: {
    ar: "كيك وحلويات تُخبز طازجة يومياً بمكوّنات فاخرة، وتوصيل داخل عمّان.",
    en: "Cakes and desserts baked fresh daily with premium ingredients, delivered across Amman.",
  },
  heroCta: { ar: "اطلب الآن", en: "Order now" },
  heroCta2: { ar: "صمّم كيكتك", en: "Build your cake" },
  categories: { ar: "تصفّح الأقسام", en: "Browse categories" },
  all: { ar: "الكل", en: "All" },
  addToCart: { ar: "أضف إلى السلة", en: "Add to cart" },
  customize: { ar: "تخصيص", en: "Customize" },
  size: { ar: "الحجم", en: "Size" },
  flavor: { ar: "النكهة", en: "Flavor" },
  qty: { ar: "الكمية", en: "Quantity" },
  notes: { ar: "ملاحظات", en: "Notes" },
  notesPh: { ar: "مثال: بدون مكسّرات، كتابة اسم على الكيك…", en: "e.g. no nuts, write a name on top…" },
  cart: { ar: "السلة", en: "Cart" },
  emptyCart: { ar: "سلتك فارغة حتى الآن", en: "Your cart is empty" },
  subtotal: { ar: "المجموع", en: "Subtotal" },
  delivery: { ar: "التوصيل", en: "Delivery" },
  total: { ar: "الإجمالي", en: "Total" },
  checkout: { ar: "إتمام الطلب", en: "Checkout" },
  jod: { ar: "د.أ", en: "JOD" },
  description: { ar: "الوصف", en: "Description" },
  from: { ar: "يبدأ من", en: "From" },
  search: { ar: "ابحث عن كيك أو حلويات…", en: "Search cakes, pastries, croissants..." },
  discoverByCategory: { ar: "تصفّح حسب القسم", en: "Discover By Category" },
  showAll: { ar: "إظهار الكل", en: "Show all" },
  popular: { ar: "الأكثر طلباً", en: "Popular Cake" },
  loadingMenu: { ar: "جار تحميل القائمة…", en: "Loading the menu…" },
  emptyMenu: { ar: "لا يوجد شيء هنا بعد — عُد قريباً.", en: "Nothing here yet — check back soon." },
  celebrationCakes: { ar: "كيك المناسبات", en: "Celebration Cakes" },
  builderTitle: { ar: "صمّم كيكتك الخاصة", en: "Design your own cake" },
  builderSub: { ar: "أربع خطوات بسيطة، ونحن نتولّى الباقي.", en: "Four simple steps, we handle the rest." },
  step: { ar: "خطوة", en: "Step" },
  of: { ar: "من", en: "of" },
  next: { ar: "التالي", en: "Next" },
  back: { ar: "السابق", en: "Back" },
  filling: { ar: "الحشوة", en: "Filling" },
  frosting: { ar: "التغليف", en: "Frosting" },
  message: { ar: "الكتابة على الكيك", en: "Message on cake" },
  messagePh: { ar: "عيد ميلاد سعيد…", en: "Happy Birthday…" },
  addBuilder: { ar: "أضف الكيكة إلى السلة", en: "Add cake to cart" },
  yourInfo: { ar: "بياناتك", en: "Your details" },
  name: { ar: "الاسم", en: "Full name" },
  phone: { ar: "رقم الهاتف", en: "Phone number" },
  method: { ar: "طريقة الاستلام", en: "Order type" },
  deliveryOpt: { ar: "توصيل", en: "Delivery" },
  pickup: { ar: "استلام من الفرع", en: "Pickup" },
  address: { ar: "العنوان", en: "Address" },
  area: { ar: "المنطقة", en: "Area" },
  date: { ar: "التاريخ المطلوب", en: "Preferred date" },
  time: { ar: "الوقت المطلوب", en: "Preferred time" },
  orderNotes: { ar: "ملاحظات الطلب", en: "Order notes" },
  sendWhats: { ar: "إرسال الطلب عبر واتساب", en: "Send order on WhatsApp" },
  required: { ar: "هذا الحقل مطلوب", en: "This field is required" },
  reviews: { ar: "قالوا عنّا", en: "Loved by our customers" },
  followUs: { ar: "تابعنا", en: "Follow us" },
  hours: { ar: "أوقات العمل", en: "Opening hours" },
  hoursVal: { ar: "يومياً ١٠:٠٠ ص – ١١:٠٠ م", en: "Daily 10:00 AM – 11:00 PM" },
  rights: { ar: "جميع الحقوق محفوظة", en: "All rights reserved" },
  aboutTitle: { ar: "من مطبخنا إلى مناسباتكم", en: "From our kitchen to your celebrations" },
  aboutBody: {
    ar: "ديليش مخبز عائلي في عمّان، نخبز الكيك والحلويات على دفعات صغيرة باستخدام زبدة وشوكولاتة فاخرة، لأن الطعم الحقيقي لا يُستعجل.",
    en: "Delish is a family bakery in Amman. We bake in small batches with real butter and fine chocolate, because true flavour is never rushed.",
  },
  freshDaily: { ar: "طازج يومياً", en: "Fresh daily" },
  premium: { ar: "مكوّنات فاخرة", en: "Premium ingredients" },
  amman: { ar: "توصيل عمّان", en: "Amman delivery" },
  itemsCount: { ar: "عناصر", en: "items" },
  clear: { ar: "تفريغ السلة", en: "Clear cart" },
  contactUs: { ar: "اتصل بنا", en: "Contact us" },
  whatsapp: { ar: "واتساب", en: "WhatsApp" },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (k: keyof typeof t_ | string) => string;
  dir: "rtl" | "ltr";
};

const LangContext = createContext<Ctx>({
  lang: "ar",
  setLang: () => {},
  toggle: () => {},
  t: (k) => String(k),
  dir: "rtl",
});

export function LangProvider({ children }: { children: ReactNode }) {
  // Arabic is the default everywhere; a saved choice is restored after hydration.
  const [lang, setLang] = useState<Lang>("ar");
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ar") setLang(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, dir]);

  const toggle = useCallback(() => setLang((current) => (current === "ar" ? "en" : "ar")), []);
  const t = useCallback((k: string) => (t_[k] ? t_[k]![lang] : k), [lang]);

  const value = useMemo(() => ({ lang, setLang, toggle, t, dir }), [lang, toggle, t, dir]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** AR | EN pill toggle for public headers. */
export function LangToggle({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "peach";
}) {
  const { lang, toggle } = useLang();

  if (variant === "peach") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={lang === "ar" ? "التبديل إلى الإنجليزية" : "Switch to Arabic"}
        title={lang === "ar" ? "English" : "العربية"}
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#FDE2CF] px-3 py-1 text-xs font-semibold text-[#7B3F00] shadow-sm transition-transform hover:scale-105 active:scale-95 ${className}`}
      >
        <span className={lang === "ar" ? "opacity-100" : "opacity-60"}>عربي</span>
        <span className="opacity-60">|</span>
        <span className={lang === "en" ? "opacity-100" : "opacity-60"}>EN</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={lang === "ar" ? "التبديل إلى الإنجليزية" : "Switch to Arabic"}
      title={lang === "ar" ? "English" : "العربية"}
      className={`inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card/90 px-2.5 text-[11px] font-extrabold text-primary shadow-sm transition-transform hover:scale-[1.04] active:scale-95 ${className}`}
    >
      <Languages className="h-3.5 w-3.5" aria-hidden="true" />
      <span className={lang === "ar" ? "text-primary" : "text-muted-foreground"}>AR</span>
      <span className="text-muted-foreground/60">|</span>
      <span className={lang === "en" ? "text-primary" : "text-muted-foreground"}>EN</span>
    </button>
  );
}

export const arabicNum = (n: number | string, lang: Lang) =>
  lang === "ar" ? String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!) : String(n);
