import { memo } from "react";
import { Facebook, Instagram, MessageCircle } from "lucide-react";
import { WHATSAPP } from "@/lib/menu";
import { useLang } from "@/lib/i18n";

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/delishcakejo",
  instagram: "https://www.instagram.com/delishcakejo",
  whatsapp: `https://wa.me/${WHATSAPP}`,
};

/** Shared storefront footer: social icons plus the Delish Bakes copyright. */
export const SiteFooter = memo(function SiteFooter() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const year = new Date().getFullYear();

  const items = [
    { href: SOCIAL_LINKS.facebook, Icon: Facebook, label: "Facebook" },
    { href: SOCIAL_LINKS.instagram, Icon: Instagram, label: "Instagram" },
    { href: SOCIAL_LINKS.whatsapp, Icon: MessageCircle, label: "WhatsApp" },
  ];

  return (
    <footer className="mt-4 space-y-3 border-t border-border pt-6 pb-10 text-center">
      <p className="text-xs font-bold text-foreground">
        {ar ? "تابعونا · تواصلوا معنا" : "Follow us · Talk to us"}
      </p>
      <div className="flex items-center justify-center gap-3">
        {items.map(({ href, Icon, label }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-border bg-card text-primary shadow-xs transition hover:bg-secondary/40 active:scale-95"
          >
            <Icon className="h-4 w-4" aria-hidden />
          </a>
        ))}
      </div>
      <p className="text-xs font-medium text-muted-foreground">
        © {year} DELISH Bakes — {ar ? "جميع الحقوق محفوظة" : "All rights reserved"}
      </p>
    </footer>
  );
});
