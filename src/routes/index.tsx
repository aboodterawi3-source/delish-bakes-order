import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useCallback, useMemo, useState } from "react";
import { Instagram, MapPin, Phone, ShieldCheck, Sparkles, Star, Truck, Wheat } from "lucide-react";
import { LangProvider, useLang } from "@/lib/i18n";
import { CartProvider, useCart } from "@/lib/cart";
import { categories, products, WHATSAPP, type Product } from "@/lib/menu";
import { heroImage, imageSets } from "@/lib/images";
import { Pic } from "@/components/delish/Pic";
import logo from "@/assets/delish-logo.jpg.asset.json";
import { Header } from "@/components/delish/Header";
import { ProductModal } from "@/components/delish/ProductModal";
import { CakeBuilder } from "@/components/delish/CakeBuilder";
import { CartDrawer } from "@/components/delish/CartDrawer";

const TITLE = "ديليش كيك آند بيك | كيك وحلويات فاخرة وتوصيل في عمّان، الأردن";
const DESCRIPTION =
  "اطلب كيك أعياد الميلاد والمناسبات، تشيز كيك، كب كيك، كنافة وبقلاوة من ديليش كيك آند بيك في عمّان. صمّم كيكتك الخاصة وأرسل طلبك عبر واتساب مع توصيل داخل عمّان.";
const KEYWORDS =
  "كيك عمان, حلويات عمان, كيك اعياد ميلاد الاردن, تورتة عمان, كيك مناسبات عمان, تشيز كيك عمان, كب كيك الاردن, كنافة نابلسية عمان, بقلاوة عمان, محل حلويات عمان, توصيل كيك عمان, ديليش كيك آند بيك, Delish Cake and Bake Amman";

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": ["Bakery", "LocalBusiness"],
  name: "Delish Cake & Bake",
  alternateName: "ديليش كيك آند بيك",
  description: DESCRIPTION,
  image: "/og-delish.jpg",
  telephone: "+962779179995",
  priceRange: "10-90 JOD",
  currenciesAccepted: "JOD",
  paymentAccepted: "Cash",
  servesCuisine: "Desserts",
  address: {
    "@type": "PostalAddress",
    addressLocality: "عمّان",
    addressRegion: "Amman Governorate",
    addressCountry: "JO",
  },
  areaServed: { "@type": "City", name: "عمّان" },
  sameAs: ["https://instagram.com/delish.jordan", "https://wa.me/962779179995"],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "10:00",
      closes: "23:00",
    },
  ],
  aggregateRating: { "@type": "AggregateRating", ratingValue: "5", reviewCount: "3", bestRating: "5" },
};

const productsSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "قائمة حلويات ديليش كيك آند بيك",
  itemListElement: products.slice(0, 10).map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Product",
      name: p.ar,
      alternateName: p.en,
      description: p.descAr,
      brand: { "@type": "Brand", name: "Delish Cake & Bake" },
      offers: {
        "@type": "Offer",
        price: p.price.toFixed(2),
        priceCurrency: "JOD",
        availability: "https://schema.org/InStock",
        areaServed: "عمّان، الأردن",
        url: "/#menu",
      },
    },
  })),
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "keywords", content: KEYWORDS },
      { name: "robots", content: "index, follow" },
      { name: "geo.region", content: "JO-AM" },
      { name: "geo.placename", content: "Amman" },
      { property: "og:site_name", content: "Delish Cake & Bake" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ar_JO" },
      { property: "og:locale:alternate", content: "en_US" },
      { property: "og:url", content: "/" },
      { property: "og:image", content: "/og-delish.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "كيكة شوكولاتة فاخرة وحلويات من ديليش كيك آند بيك في عمّان" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: "/og-delish.jpg" },
      { name: "twitter:image:alt", content: "كيكة شوكولاتة فاخرة وحلويات من ديليش كيك آند بيك في عمّان" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      // Preload the LCP hero (AVIF first; browsers without AVIF ignore this hint)
      {
        rel: "preload",
        as: "image",
        type: "image/avif",
        imageSrcSet: heroImage.avif,
        imageSizes: "100vw",
        fetchPriority: "high",
      },
    ],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(localBusinessSchema) },
      { type: "application/ld+json", children: JSON.stringify(productsSchema) },
    ],
  }),
  component: Page,
});


function Page() {
  return (
    <LangProvider>
      <CartProvider>
        <Delish />
      </CartProvider>
    </LangProvider>
  );
}

const reviews = [
  {
    ar: "أجمل كيكة ذوّقتها في عمّان، والتوصيل كان بالوقت بالضبط.",
    en: "The best cake I've had in Amman, and delivery was right on time.",
    nameAr: "رنا خ.",
    nameEn: "Rana K.",
  },
  {
    ar: "طلبت كيكة مصمّمة لعيد ميلاد بنتي وطلعت أحلى من الصورة.",
    en: "Ordered a custom cake for my daughter's birthday — even prettier than the photo.",
    nameAr: "أحمد م.",
    nameEn: "Ahmad M.",
  },
  {
    ar: "الكنافة والبقلاوة طازجة وطعمها بيتي أصيل. صاروا مخبزنا الثابت.",
    en: "Knafeh and baklava taste truly homemade. Our go-to bakery now.",
    nameAr: "لينا ع.",
    nameEn: "Lina A.",
  },
];

function Delish() {
  const { t, lang, dir } = useLang();
  const { count, subtotal } = useCart();
  const [cat, setCat] = useState<string>("all");
  const [active, setActive] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const list = useMemo(() => (cat === "all" ? products : products.filter((p) => p.category === cat)), [cat]);
  const openProduct = useCallback((p: Product) => setActive(p), []);
  const selectCat = useCallback((id: string) => setCat(id), []);
  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const closeProduct = useCallback(() => setActive(null), []);

  return (
    <div id="top" dir={dir} className="min-h-dvh bg-background pb-24 md:pb-0">
      <a
        href="#menu"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        {lang === "ar" ? "تخطَّ إلى القائمة" : "Skip to menu"}
      </a>
      <Header onCart={openCart} />
      <main>



      {/* Hero */}
      <section className="relative overflow-hidden">
        <Pic
          set={heroImage}
          alt={t("heroTitle")}
          priority
          sizes="100vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-cocoa/95 via-cocoa/70 to-cocoa/40" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1 text-[11px] font-semibold tracking-wide text-gold-light">
            <Sparkles className="h-3.5 w-3.5" /> {t("brandTag")}
          </span>
          <h1 className="mt-5 font-display text-4xl leading-tight font-bold text-primary-foreground sm:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-primary-foreground/85 sm:text-base">{t("heroSub")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#menu"
              className="rounded-full bg-gold px-7 py-3.5 text-sm font-bold text-cocoa shadow-[var(--shadow-gold)] transition-transform hover:scale-105"
            >
              {t("heroCta")}
            </a>
            <a
              href="#builder"
              className="rounded-full border border-primary-foreground/40 px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
            >
              {t("heroCta2")}
            </a>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-border px-4 py-4 text-center rtl:divide-x-reverse">
          {[
            { icon: Wheat, label: t("freshDaily") },
            { icon: Sparkles, label: t("premium") },
            { icon: Truck, label: t("amman") },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1 px-2">
              <Icon className="h-4.5 w-4.5 text-gold-deep" />
              <span className="text-[11px] font-semibold text-foreground sm:text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      <section id="menu" className="mx-auto max-w-6xl px-4 py-14">
        <SectionTitle kicker={t("navMenu")} title={t("categories")} />

        <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
          <CatChip id="all" active={cat === "all"} onSelect={selectCat} label={t("all")} />
          {categories.map((c) => (
            <CatChip
              key={c.id}
              id={c.id}
              active={cat === c.id}
              onSelect={selectCat}
              label={lang === "ar" ? c.ar : c.en}
            />
          ))}
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} lang={lang} t={t} onSelect={openProduct} />
          ))}
        </div>

      </section>

      {/* Builder */}
      <section id="builder" className="bg-secondary/60 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle kicker={t("navBuilder")} title={t("builderTitle")} sub={t("builderSub")} />
          <div className="mt-8">
            <CakeBuilder onDone={() => setCartOpen(true)} />
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <SectionTitle kicker="★★★★★" title={t("reviews")} />
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {reviews.map((r) => (
            <blockquote key={r.nameEn} className="surface-card rounded-3xl p-5">
              <div className="flex gap-0.5 text-gold">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground">{lang === "ar" ? r.ar : r.en}</p>
              <footer className="mt-3 text-xs font-semibold text-muted-foreground">
                — {lang === "ar" ? r.nameAr : r.nameEn}
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="bg-cocoa py-14 text-primary-foreground">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <img
            src={logo.url}
            alt="Delish"
            loading="lazy"
            width={72}
            height={72}
            className="mx-auto h-18 w-18 rounded-full border border-gold/40 object-cover"
          />
          <h2 className="mt-5 font-display text-3xl font-bold">{t("aboutTitle")}</h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/80">{t("aboutBody")}</p>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer id="contact" className="border-t border-border bg-card py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:grid-cols-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Delish Cake &amp; Bake</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("brandTag")}</p>
          </div>
          <div className="space-y-2 text-sm">
            <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{t("contactUs")}</h3>
            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-2 text-foreground hover:text-gold-deep"
            >
              <Phone className="h-4 w-4" aria-hidden="true" /> <span dir="ltr">+962 77 917 9995</span>
            </a>
            <a
              href="https://instagram.com/delish.jordan"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-2 text-foreground hover:text-gold-deep"
            >
              <Instagram className="h-4 w-4" aria-hidden="true" /> delish.jordan
            </a>
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" aria-hidden="true" /> {lang === "ar" ? "عمّان، الأردن" : "Amman, Jordan"}
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{t("hours")}</h3>
            <p className="text-muted-foreground">{t("hoursVal")}</p>
            <Link
              to="/admin"
              className="inline-flex min-h-11 items-center gap-2 text-foreground underline hover:text-gold-deep"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {lang === "ar" ? "لوحة الطلبات (للفريق)" : "Order dashboard (staff)"}
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Delish Cake &amp; Bake — {t("rights")}
        </p>
      </footer>

      {/* Sticky mobile cart bar */}
      {count > 0 && !cartOpen && (
        <button
          onClick={openCart}
          className="fixed bottom-4 inset-x-4 z-30 flex items-center justify-between rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] md:hidden"
        >
          <span>
            {t("cart")} · {count} {t("itemsCount")}
          </span>
          <span>
            {subtotal.toFixed(2)} {t("jod")}
          </span>
        </button>
      )}

      <ProductModal product={active} onClose={closeProduct} />
      <CartDrawer open={cartOpen} onClose={closeCart} />
    </div>
  );
}

function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold tracking-[0.2em] text-gold-deep uppercase">{kicker}</p>
      <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      {sub && <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

type ProductCardProps = {
  product: Product;
  lang: "ar" | "en";
  t: (k: string) => string;
  onSelect: (p: Product) => void;
};

const ProductCard = memo(function ProductCard({ product: p, lang, t, onSelect }: ProductCardProps) {
  const badge = lang === "ar" ? p.badgeAr : p.badgeEn;
  return (
    <article className="surface-card group flex flex-col overflow-hidden rounded-3xl transition-transform duration-300 will-change-transform hover:-translate-y-1">
      <div className="relative">
        <Pic
          set={imageSets[p.image]!}
          alt={lang === "ar" ? p.ar : p.en}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 92vw"
          className="aspect-4/3 w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {badge && (
          <span className="absolute top-3 start-3 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold text-cocoa">
            {badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-semibold">{lang === "ar" ? p.ar : p.en}</h3>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
          {lang === "ar" ? p.descAr : p.descEn}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="font-display text-lg font-semibold">
            {p.price.toFixed(2)} <span className="text-xs">{t("jod")}</span>
          </span>
          <button
            onClick={() => onSelect(p)}
            className="min-h-12 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-105"
          >
            {p.sizes || p.flavors ? t("customize") : t("addToCart")}
          </button>
        </div>
      </div>
    </article>
  );
});

const CatChip = memo(function CatChip({
  id,
  active,
  onSelect,
  label,
}: {
  id: string;
  active: boolean;
  onSelect: (id: string) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      aria-pressed={active}
      className={`min-h-12 shrink-0 rounded-full border px-4 text-sm whitespace-nowrap transition-colors ${

        active
          ? "border-gold bg-gold font-semibold text-cocoa"
          : "border-border bg-card text-foreground hover:border-gold/60"
      }`}
    >
      {label}
    </button>
  );
});

