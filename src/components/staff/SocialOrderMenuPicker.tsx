import { useMemo, useState } from "react";
import { Loader2, PlusCircle, Search, Store, Utensils } from "lucide-react";
import { jd } from "@/lib/currency";
import type { SizePrice, StorefrontProduct } from "@/lib/storefront-content";

interface SocialOrderMenuPickerProps {
  products: StorefrontProduct[];
  isLoading: boolean;
  onSelect: (product: StorefrontProduct, size?: SizePrice) => void;
}

/** Collapsible storefront catalog browser for 1-tap order entry in Sales and Social screens. */
export function SocialOrderMenuPicker({
  products,
  isLoading,
  onSelect,
}: SocialOrderMenuPickerProps) {
  const [showMenuPicker, setShowMenuPicker] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState("all");

  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category?.trim()) set.add(p.category.trim());
    return ["all", ...Array.from(set)];
  }, [products]);

  const filteredMenuProducts = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = menuCategory === "all" || p.category === menuCategory;
      const matchQuery =
        !q ||
        p.name_ar.toLowerCase().includes(q) ||
        p.name_en.toLowerCase().includes(q) ||
        Boolean(p.filling_ar && p.filling_ar.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [products, menuSearch, menuCategory]);

  return (
    <div className="space-y-3 rounded-2xl border border-[#B8860B]/30 bg-[#FFFDF8] p-3.5 shadow-2xs">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${
          showMenuPicker ? "border-b border-[#B8860B]/20 pb-2" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#8B4513] text-white">
            <Store className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#3E2723]">
              منيو أصناف الموقع · Storefront Menu
            </h3>
            <p className="text-[11px] text-[#7A6458]">
              اختر أي منتج/حجم من قائمة الموقع لإضافته بضغطة واحدة
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={showMenuPicker}
          onClick={() => setShowMenuPicker((v) => !v)}
          className="cursor-pointer rounded-full border border-[#B8860B]/40 bg-white px-3.5 py-1.5 text-xs font-bold text-[#8B4513] shadow-2xs transition hover:bg-[#FDE2CF]/30"
        >
          {showMenuPicker ? "إخفاء المنيو ▲" : "عرض منيو المنتجات ▼"}
        </button>
      </div>

      {showMenuPicker && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute top-2.5 right-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="بحث بالاسم أو الحشوة في المنيو…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-3 text-xs font-semibold text-[#3E2723] focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </div>

            <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto py-1">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setMenuCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition-all ${
                    menuCategory === cat
                      ? "bg-[#8B4513] text-white shadow-xs"
                      : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-100"
                  }`}
                >
                  {cat === "all" ? "الكل" : cat}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-xs text-[#7A6458]">
              <Loader2 className="ml-2 h-4 w-4 animate-spin text-[#8B4513]" />
              جاري تحميل المنيو…
            </div>
          ) : filteredMenuProducts.length === 0 ? (
            <div className="py-4 text-center text-xs font-bold text-[#7A6458]">
              لا توجد نتائج مطابقة في المنيو
            </div>
          ) : (
            <div className="grid max-h-72 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMenuProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs transition-all hover:border-[#B8860B]"
                >
                  <div className="flex items-start gap-2">
                    {prod.image_url ? (
                      <img
                        src={prod.image_url}
                        alt={prod.name_ar}
                        className="h-12 w-12 shrink-0 rounded-lg border border-slate-100 object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#FDE2CF]/40 text-[#8B4513]">
                        <Utensils className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-xs leading-snug font-bold text-[#3E2723]">
                        {prod.name_ar}
                      </h4>
                      <p className="mt-0.5 text-[11px] font-extrabold text-[#8B4513]">
                        {prod.price_on_request ? "حسب الطلب" : jd(prod.price)}
                      </p>
                      {prod.filling_ar && (
                        <span className="mt-1 inline-block rounded bg-[#FDE2CF]/50 px-1.5 py-0.5 text-[10px] font-bold text-[#7B3F00]">
                          حشوة: {prod.filling_ar}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-1">
                    {prod.sizes && prod.sizes.length > 0 ? (
                      prod.sizes.map((sz) => (
                        <button
                          key={sz.label}
                          type="button"
                          onClick={() => onSelect(prod, sz)}
                          className="min-w-[60px] flex-1 rounded-lg border border-slate-200 bg-[#F9FBFC] px-1.5 py-1 text-center text-[10px] font-bold transition-all hover:bg-[#8B4513] hover:text-white"
                        >
                          {sz.label} ({sz.price} د.أ)
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(prod)}
                        className="flex w-full items-center justify-center gap-1 rounded-lg bg-[#8B4513] px-2 py-1 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#5D2E17]"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        اختيار المنتج
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
