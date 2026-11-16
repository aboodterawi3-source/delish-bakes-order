import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  CakeCustomizationPanel,
  customizationSummary,
  emptyCustomization,
  type Customization,
} from "@/components/delish/CakeCustomizationPanel";
import { jd } from "@/lib/currency";
import type { OrderItemPatch, SalesOrder } from "@/lib/sales.functions";
import type { StorefrontProduct } from "@/lib/storefront-content";

/** Replaces (or removes) a labelled extra such as «الحشوة: نوتيلا» in the list. */
const withLabel = (list: string[], label: string, value: string) => {
  const rest = list.filter((entry) => !entry.startsWith(`${label}:`));
  return value ? [...rest, `${label}: ${value}`] : rest;
};

const QUICK_ACCESSORIES = [
  { label: "🕯️ شموع أرقام", value: "شموع أرقام" },
  { label: "✨ شمعة سحرية", value: "شمعة سحرية مضيئة" },
  { label: "🎈 بالونات هيليوم", value: "بالونات هيليوم" },
  { label: "🎂 توبير أكريليك", value: "توبير أكريليك مخصص" },
  { label: "🍫 حشوة نوتيلا", value: "الحشوة: نوتيلا" },
  { label: "🌾 حشوة لوتس", value: "الحشوة: لوتس" },
  { label: "🥜 حشوة بستاشيو", value: "الحشوة: بستاشيو" },
  { label: "🍓 فراولة وتوت", value: "الحشوة: فراولة وتوت" },
] as const;

export const editorInputClass =
  "min-h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition";

interface InteractiveItemEditorCardProps {
  item: SalesOrder["items"][number];
  products: StorefrontProduct[];
  onItemPatch: (patch: Omit<OrderItemPatch, "orderId">) => void;
  onOpenSheet: () => void;
  onDelete: () => void;
}

export function InteractiveItemEditorCard({
  item,
  products,
  onItemPatch,
  onOpenSheet,
  onDelete,
}: InteractiveItemEditorCardProps) {
  const [options, setOptions] = useState<string[]>(item.options_ar);
  const [draft, setDraft] = useState("");
  const [showWebsiteOptions, setShowWebsiteOptions] = useState(false);
  const [custom, setCustom] = useState<Customization>(emptyCustomization);
  const [productId, setProductId] = useState(item.product_id ?? "");
  const [sizeLabel, setSizeLabel] = useState("");
  const [filling, setFilling] = useState("");

  const product = products.find((row) => row.id === productId) ?? null;
  const fillings = useMemo(() => {
    const set = new Set<string>();
    for (const row of products) if (row.filling_ar?.trim()) set.add(row.filling_ar.trim());
    return [...set].sort();
  }, [products]);

  useEffect(() => {
    setOptions(item.options_ar);
  }, [item.options_ar]);

  const commitOptions = (next: string[]) => {
    setOptions(next);
    onItemPatch({ itemId: item.id, options: next });
  };

  const addOptionPill = (text: string) => {
    if (options.includes(text)) return;
    commitOptions([...options, text]);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <input
            defaultValue={item.name_ar}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && val !== item.name_ar) onItemPatch({ itemId: item.id, name: val });
            }}
            placeholder="اسم الصنف أو الكيكة..."
            className="w-full border-b border-dashed border-border/70 bg-transparent pb-1 font-display text-sm font-black text-foreground transition outline-none focus:border-primary"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => {
                if (item.quantity > 1) {
                  onItemPatch({ itemId: item.id, quantity: item.quantity - 1 });
                }
              }}
              disabled={item.quantity <= 1}
              className="grid h-8 w-8 cursor-pointer place-items-center text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              −
            </button>
            <span className="w-8 text-center text-xs font-bold text-foreground">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => {
                onItemPatch({ itemId: item.id, quantity: item.quantity + 1 });
              }}
              className="grid h-8 w-8 cursor-pointer place-items-center text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.25"
              defaultValue={item.unit_price}
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                if (!Number.isNaN(val) && val !== item.unit_price) {
                  onItemPatch({ itemId: item.id, newUnitPrice: val });
                }
              }}
              className="h-8 w-20 rounded-xl border border-input bg-card px-2 text-center text-xs font-bold text-foreground"
            />
            <span className="text-[11px] text-muted-foreground">د.أ</span>
          </div>

          <span className="rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
            {jd(item.unit_price * item.quantity)}
          </span>

          <button
            type="button"
            onClick={onDelete}
            title="حذف الصنف"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <input
        defaultValue={item.notes ?? ""}
        onBlur={(e) => {
          const val = e.target.value.trim();
          if (val !== (item.notes ?? "")) {
            onItemPatch({ itemId: item.id, notes: val || null });
          }
        }}
        placeholder="ملاحظة خاصة على هذا الصنف (مثل: كتابة خاصة، بدون مكسرات...)"
        className="w-full rounded-xl border border-transparent bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground transition outline-none focus:border-border"
      />

      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {options.map((opt, idx) => (
            <span
              key={`${idx}-${opt}`}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-[11px] font-bold text-primary"
            >
              <span>{opt}</span>
              <button
                type="button"
                onClick={() => commitOptions(options.filter((_, i) => i !== idx))}
                className="cursor-pointer text-primary/70 hover:text-rose-600"
                title="إزالة الإضافة"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="border-t border-border/50 pt-1">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
          <span>إضافات سريعة ونكهات (بنقرة واحدة):</span>
          <button
            type="button"
            onClick={onOpenSheet}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <Pencil className="h-3 w-3" />
            <span>تخصيص متقدم</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACCESSORIES.map((acc) => (
            <button
              key={acc.value}
              type="button"
              onClick={() => addOptionPill(acc.value)}
              className="cursor-pointer rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground transition hover:bg-primary hover:text-primary-foreground"
            >
              + {acc.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="إضافة طلب خاص مخصص لهذا الصنف..."
          className="min-h-9 flex-1 rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-primary"
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              commitOptions([...options, draft.trim()]);
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (!draft.trim()) return;
            commitOptions([...options, draft.trim()]);
            setDraft("");
          }}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowWebsiteOptions((prev) => !prev)}
          className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-primary hover:underline"
        >
          <span>
            {showWebsiteOptions
              ? "▲ إخفاء خيارات كتالوج الموقع"
              : "▼ خيارات كتالوج الموقع (أحجام، حشوات متقدمة)"}
          </span>
        </button>

        {showWebsiteOptions && (
          <div className="animate-fadeIn mt-2 space-y-3 rounded-2xl border border-primary/20 bg-secondary/20 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-bold text-foreground">
                المنتج من الموقع · Website Product
                <select
                  value={productId}
                  onChange={(event) => {
                    setProductId(event.target.value);
                    setSizeLabel("");
                    const picked = products.find((row) => row.id === event.target.value);
                    if (picked) {
                      const patch: Parameters<typeof onItemPatch>[0] = {
                        itemId: item.id,
                        name: picked.name_ar,
                      };
                      if (!picked.price_on_request && picked.price > 0) {
                        patch.newUnitPrice = picked.price;
                      }
                      onItemPatch(patch);
                      if (picked.filling_ar?.trim()) setFilling(picked.filling_ar.trim());
                    }
                  }}
                  className={editorInputClass}
                >
                  <option value="">— اختر منتجاً من الموقع —</option>
                  {products.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name_ar}{" "}
                      {row.price_on_request ? "(السعر عند الطلب)" : `— ${jd(row.price)}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-foreground">
                الحجم · Size
                <select
                  value={sizeLabel}
                  onChange={(event) => {
                    const label = event.target.value;
                    setSizeLabel(label);
                    const size = product?.sizes.find((entry) => entry.label === label);
                    if (!size) return;
                    const nextOptions = withLabel(options, "الحجم", size.label);
                    setOptions(nextOptions);
                    onItemPatch({
                      itemId: item.id,
                      newUnitPrice: size.price,
                      options: nextOptions,
                    });
                  }}
                  disabled={!product || product.sizes.length === 0}
                  className={editorInputClass}
                >
                  <option value="">— اختر الحجم —</option>
                  {(product?.sizes ?? []).map((size) => (
                    <option key={size.label} value={size.label}>
                      {size.label} — {jd(size.price)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-foreground sm:col-span-2">
                الحشوة · Filling
                <input
                  list={`fillings-${item.id}`}
                  value={filling}
                  onChange={(event) => setFilling(event.target.value)}
                  onBlur={() => commitOptions(withLabel(options, "الحشوة", filling.trim()))}
                  placeholder="مثال: نوتيلا · لوتس · بستاشيو"
                  className={editorInputClass}
                />
                <datalist id={`fillings-${item.id}`}>
                  {fillings.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </label>
            </div>

            <div dir="rtl" className="rounded-2xl border border-border/50 bg-white p-2">
              <CakeCustomizationPanel value={custom} onChange={setCustom} />
            </div>

            <button
              type="button"
              onClick={() => {
                const lines = customizationSummary(custom).ar;
                if (lines.length === 0) {
                  toast.error("لم يتم اختيار أي إضافة");
                  return;
                }
                let merged = options;
                for (const line of lines) {
                  const [key, ...rest] = line.split(":");
                  merged = rest.length
                    ? withLabel(merged, key ?? line, rest.join(":").trim())
                    : merged.includes(line)
                      ? merged
                      : [...merged, line];
                }
                commitOptions(merged);
                setCustom(emptyCustomization);
                toast.success("تم تطبيق الخيارات على الصنف ✅");
              }}
              className="min-h-10 w-full cursor-pointer rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              تطبيق خيارات الكستمايزيشن على الصنف ✅
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
