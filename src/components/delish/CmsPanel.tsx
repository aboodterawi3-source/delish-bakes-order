import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { CmsBannerEditor } from "@/components/delish/CmsBannerEditor";
import { CmsCategoriesEditor } from "@/components/delish/CmsCategoriesEditor";
import { CmsProductsEditor } from "@/components/delish/CmsProductsEditor";
import { CMS_KEY } from "@/components/delish/CmsSharedControls";
import { getCmsContent } from "@/lib/cms.functions";

type Tab = "banner" | "categories" | "products";

const tabs: { value: Tab; ar: string; en: string }[] = [
  { value: "banner", ar: "البانر", en: "Banner" },
  { value: "categories", ar: "الأقسام", en: "Categories" },
  { value: "products", ar: "المنتجات", en: "Products" },
];

/** Website controller: the sales desk owns the customer app's content. */
export function CmsPanel() {
  const [tab, setTab] = useState<Tab>("banner");
  const content = useQuery({ queryKey: CMS_KEY, queryFn: () => getCmsContent() });

  if (content.isPending) {
    return (
      <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> جار تحميل المحتوى…
      </p>
    );
  }

  if (content.isError) {
    return (
      <p className="py-12 text-center text-sm text-destructive">
        {(content.error as Error).message}
      </p>
    );
  }

  return (
    <section className="min-w-0 space-y-5 overflow-x-hidden">
      <div
        className="no-scrollbar flex max-w-full gap-2 overflow-x-auto"
        role="tablist"
        aria-label="إدارة الموقع"
      >
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`min-h-11 shrink-0 rounded-full px-5 text-xs font-bold whitespace-nowrap transition ${
              tab === item.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-foreground hover:bg-secondary/40"
            }`}
          >
            {item.ar} · {item.en}
          </button>
        ))}
      </div>

      {tab === "banner" && <CmsBannerEditor banner={content.data.banner} />}
      {tab === "categories" && <CmsCategoriesEditor categories={content.data.categories} />}
      {tab === "products" && (
        <CmsProductsEditor products={content.data.products} categories={content.data.categories} />
      )}
    </section>
  );
}
