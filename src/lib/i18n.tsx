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
import { arabicNum, t_, type Lang } from "@/lib/i18n-dict";

export { arabicNum, t_, type Lang };

const STORAGE_KEY = "delish-lang";

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
