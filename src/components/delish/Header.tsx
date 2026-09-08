import { ShoppingBag, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/delish-logo.jpg.asset.json";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/cart";

export function Header({ onCart }: { onCart: () => void }) {
  const { t, lang, setLang } = useLang();
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);


  const links = [
    { href: "#menu", label: t("navMenu") },
    { href: "#builder", label: t("navBuilder") },
    { href: "#about", label: t("navAbout") },
    { href: "#contact", label: t("navContact") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-lg">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <a href="#top" className="flex min-w-0 items-center gap-3">
          <img
            src={logo.url}
            alt="Delish Cake & Bake"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full border border-gold/40 object-cover shadow-[var(--shadow-gold)]"
          />
          <span className="min-w-0">
            <span className="block truncate font-display text-lg leading-tight font-semibold text-foreground">
              Delish
            </span>
            <span className="block truncate text-[11px] tracking-wide text-muted-foreground">{t("brandTag")}</span>
          </span>
        </a>

        <div className="flex shrink-0 items-center gap-1.5">
          <nav className="hidden items-center gap-5 md:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="rounded-full border border-gold/50 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
            aria-label="Switch language"
          >
            {lang === "ar" ? "EN" : "عربي"}
          </button>

          <button
            onClick={onCart}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
            aria-label={t("cart")}
          >
            <ShoppingBag className="h-4.5 w-4.5" />
            {count > 0 && (
              <span className="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-cocoa">
                {count}
              </span>
            )}
          </button>

          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border md:hidden"
            aria-label="Menu"
          >
            {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-4 py-2 md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-border/60 py-3 text-sm font-medium text-foreground last:border-0"
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
