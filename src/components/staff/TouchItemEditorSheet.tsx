import { useMemo, useState, useEffect } from "react";
import {
  Cake,
  Check,
  ChevronDown,
  Minus,
  PenTool,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { StorefrontProduct } from "@/lib/storefront-content";
import type { SalesItem } from "@/lib/sales.functions";

const jd = (val: number) => `${val.toFixed(2)} د.أ`;

// Predefined Bakery Attributes & Extras
const PREDEFINED_SIZES = [
  { label: "صغير (6 أشخاص)", extraFee: 0 },
  { label: "وسط (10 أشخاص)", extraFee: 3 },
  { label: "كبير (15 شخص)", extraFee: 6 },
  { label: "عائلي (20+ شخص)", extraFee: 10 },
];

const PREDEFINED_FILLINGS = [
  "لوتس",
  "نوتيلا",
  "بستاشيو",
  "كيندر",
  "فراولة",
  "فانيلا وتوت",
  "شوكلاتة داكنة",
  "كراميل ممجوح",
];

export type BakeryExtraItem = {
  id: string;
  name: string;
  price: number;
  icon: string;
  qty: number;
};

const DEFAULT_EXTRAS: Omit<BakeryExtraItem, "qty">[] = [
  { id: "candles", name: "شموع أرقام", price: 0.5, icon: "🕯️" },
  { id: "balloons", name: "بالونات هيليوم", price: 1.0, icon: "🎈" },
  { id: "topper", name: "توبير أكريليك / مجسم", price: 3.0, icon: "🎂" },
  { id: "cutlery", name: "طقم صحون وشوك", price: 0.5, icon: "🍽️" },
  { id: "flowers", name: "ورد طبيعي للتزيين", price: 2.5, icon: "🌸" },
];

export type TouchItemSavePayload = {
  productId?: string | null | undefined;
  name: string;
  quantity: number;
  unitPrice: number;
  options: string[];
  notes?: string | null | undefined;
};

interface TouchItemEditorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  item?: SalesItem | null | undefined;
  products: StorefrontProduct[];
  onSave: (payload: TouchItemSavePayload) => void;
}

export function TouchItemEditorSheet({
  isOpen,
  onClose,
  item,
  products,
  onSave,
}: TouchItemEditorSheetProps) {
  // Mode Tab: Website Product vs Custom Item
  const [tab, setTab] = useState<"catalog" | "custom">("catalog");

  // Website Catalog Selection State
  const [selectedProduct, setSelectedProduct] = useState<StorefrontProduct | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedFilling, setSelectedFilling] = useState<string>("");
  const [cakeInscription, setCakeInscription] = useState<string>("");

  // Extras Steppers State
  const [extras, setExtras] = useState<BakeryExtraItem[]>(() =>
    DEFAULT_EXTRAS.map((e) => ({ ...e, qty: 0 })),
  );

  // Custom Extra Input
  const [customExtraName, setCustomExtraName] = useState("");
  const [customExtraPrice, setCustomExtraPrice] = useState("");

  // Quantity & Base Price State
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);

  // Custom Item Fields
  const [customName, setCustomName] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  // Initialize state when item changes or opens
  useEffect(() => {
    if (!isOpen) return;

    if (item) {
      // Editing existing item
      if (item.product_id) {
        const prod = products.find((p) => p.id === item.product_id);
        if (prod) {
          setSelectedProduct(prod);
          setTab("catalog");
        } else {
          setTab("custom");
        }
      } else {
        setTab("custom");
      }

      setCustomName(item.name_ar);
      setQuantity(item.quantity);
      setUnitPrice(item.unit_price);
      setItemNotes(item.notes || "");

      // Parse options array (size, filling, inscription, extras)
      const opts = item.options_ar || [];
      const sizeOpt = opts.find((o) => o.startsWith("الحجم:"));
      if (sizeOpt) setSelectedSize(sizeOpt.replace("الحجم:", "").trim());

      const fillingOpt = opts.find((o) => o.startsWith("الحشوة:"));
      if (fillingOpt) setSelectedFilling(fillingOpt.replace("الحشوة:", "").trim());

      const writingOpt = opts.find((o) => o.startsWith("الكتابة:"));
      if (writingOpt) setCakeInscription(writingOpt.replace("الكتابة:", "").trim());

      // Parse extras quantities from options string
      const updatedExtras = DEFAULT_EXTRAS.map((def) => {
        const match = opts.find((o) => o.includes(def.name));
        if (match) {
          const qtyMatch = match.match(/(\d+)/);
          return { ...def, qty: qtyMatch?.[1] ? parseInt(qtyMatch[1], 10) : 1 };
        }
        return { ...def, qty: 0 };
      });
      setExtras(updatedExtras);
    } else {
      // Adding new item - reset defaults
      setTab("catalog");
      setSelectedProduct(null);
      setCatalogSearch("");
      setSelectedSize("");
      setSelectedFilling("");
      setCakeInscription("");
      setQuantity(1);
      setUnitPrice(0);
      setCustomName("");
      setItemNotes("");
      setExtras(DEFAULT_EXTRAS.map((e) => ({ ...e, qty: 0 })));
    }
  }, [isOpen, item, products]);

  // Catalog filtered products
  const filteredProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 15);
    return products.filter(
      (p) => p.name_ar.toLowerCase().includes(q) || p.name_en.toLowerCase().includes(q),
    );
  }, [products, catalogSearch]);

  // Update unit price when product or size changes
  const handleSelectProduct = (prod: StorefrontProduct) => {
    setSelectedProduct(prod);
    setUnitPrice(prod.price || 0);
    if (prod.filling_ar?.trim()) {
      setSelectedFilling(prod.filling_ar.trim());
    }
  };

  const handleSelectSize = (sizeLabel: string, extraFee: number) => {
    setSelectedSize(sizeLabel);
    if (selectedProduct) {
      // If product has defined sizes
      const sizeObj = selectedProduct.sizes?.find((s) => s.label === sizeLabel);
      if (sizeObj && sizeObj.price) {
        setUnitPrice(sizeObj.price);
      } else {
        setUnitPrice((selectedProduct.price || 0) + extraFee);
      }
    }
  };

  // Update extras stepper
  const updateExtraQty = (id: string, delta: number) => {
    setExtras((prev) =>
      prev.map((e) => (e.id === id ? { ...e, qty: Math.max(e.qty + delta, 0) } : e)),
    );
  };

  // Add custom extra
  const addCustomExtra = () => {
    if (!customExtraName.trim()) return;
    const price = Number(customExtraPrice) || 0;
    const newExtra: BakeryExtraItem = {
      id: `custom-extra-${Date.now()}`,
      name: customExtraName.trim(),
      price,
      icon: "✨",
      qty: 1,
    };
    setExtras((prev) => [...prev, newExtra]);
    setCustomExtraName("");
    setCustomExtraPrice("");
    toast.success(`تمت إضافة ${newExtra.name}`);
  };

  // Calculate live total for CTA
  const extrasTotal = useMemo(
    () => extras.reduce((sum, e) => sum + e.price * e.qty, 0),
    [extras],
  );
  const liveLineTotal = useMemo(
    () => (unitPrice + extrasTotal) * quantity,
    [unitPrice, extrasTotal, quantity],
  );

  const handleSave = () => {
    const name = tab === "catalog" ? selectedProduct?.name_ar || customName : customName;
    if (!name.trim()) {
      toast.error("يرجى اختيار منتج أو كتابة اسم الصنف");
      return;
    }

    // Compile options array
    const compiledOptions: string[] = [];
    if (selectedSize) compiledOptions.push(`الحجم: ${selectedSize}`);
    if (selectedFilling) compiledOptions.push(`الحشوة: ${selectedFilling}`);
    if (cakeInscription.trim()) compiledOptions.push(`الكتابة: ${cakeInscription.trim()}`);

    extras.forEach((e) => {
      if (e.qty > 0) {
        compiledOptions.push(`${e.icon} ${e.name} (${e.qty} × ${jd(e.price)})`);
      }
    });

    const finalUnitPrice = unitPrice + extrasTotal;

    onSave({
      productId: tab === "catalog" ? selectedProduct?.id : null,
      name: name.trim(),
      quantity,
      unitPrice: finalUnitPrice,
      options: compiledOptions,
      notes: itemNotes.trim() || null,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 sm:items-center sm:p-4 animate-in fade-in duration-200"
    >
      {/* Overlay Backdrop Click Dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Touch Sheet / Centered Modal Container */}
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl animate-in slide-in-from-bottom-6 duration-200">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-border px-5 py-4 bg-card">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Cake className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                {item ? "تعديل الصنف والمواصفات" : "إضافة صنف جديد للطلب"}
              </h3>
              <p className="text-xs text-muted-foreground">خيارات لمسية سريعة بدون كتابة يدوية</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full border border-border text-foreground hover:bg-secondary cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Segmented Mode Tabs */}
        <div className="px-5 pt-3 bg-card">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/50 p-1">
            <button
              type="button"
              onClick={() => setTab("catalog")}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "catalog"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-background/50"
              }`}
            >
              <Cake className="h-4 w-4" />
              كيكات الموقع 🎂
            </button>

            <button
              type="button"
              onClick={() => setTab("custom")}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "custom"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-background/50"
              }`}
            >
              <PenTool className="h-4 w-4" />
              صنف مخصص ✍️
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === "catalog" ? (
            <>
              {/* Product Search & Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-foreground">
                  اختر المنتج من الكتالوج
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="ابحث عن اسم الكيكة..."
                    className="min-h-12 w-full rounded-2xl border border-input bg-background px-4 text-xs font-bold text-foreground outline-none focus:border-primary"
                  />
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>

                {/* Filtered Product Selection Cards */}
                <div className="no-scrollbar flex gap-2 overflow-x-auto py-1">
                  {filteredProducts.map((p) => {
                    const isPicked = selectedProduct?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className={`flex shrink-0 min-h-14 items-center gap-2.5 rounded-2xl border px-3.5 py-2 text-start transition-all cursor-pointer ${
                          isPicked
                            ? "border-primary bg-primary/10 font-bold text-primary ring-2 ring-primary/20"
                            : "border-border bg-background text-foreground hover:border-primary/50"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">{p.name_ar}</p>
                          <p className="text-[11px] text-primary">{jd(p.price)}</p>
                        </div>
                        {isPicked && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Attributes as Selection Chips */}
              <div className="space-y-4 rounded-2xl border border-border bg-secondary/20 p-4">
                {/* Size Chips */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-2">
                    الحجم (Size Chips)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_SIZES.map((sz) => {
                      const active = selectedSize === sz.label;
                      return (
                        <button
                          key={sz.label}
                          type="button"
                          onClick={() => handleSelectSize(sz.label, sz.extraFee)}
                          className={`min-h-11 rounded-full px-4 text-xs font-bold transition-all cursor-pointer ${
                            active
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "border border-border bg-background text-foreground hover:bg-secondary"
                          }`}
                        >
                          {sz.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Flavor & Filling Chips */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-2">
                    نوع الحشوة (Filling Flavor)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_FILLINGS.map((fil) => {
                      const active = selectedFilling === fil;
                      return (
                        <button
                          key={fil}
                          type="button"
                          onClick={() => setSelectedFilling(active ? "" : fil)}
                          className={`min-h-11 rounded-full px-3.5 text-xs font-bold transition-all cursor-pointer ${
                            active
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "border border-border bg-background text-foreground hover:bg-secondary"
                          }`}
                        >
                          {fil}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cake Writing */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    الكتابة على الكيكة (Cake Writing)
                  </label>
                  <input
                    type="text"
                    value={cakeInscription}
                    onChange={(e) => setCakeInscription(e.target.value)}
                    placeholder="مثال: مبروك التخرج يا أحمد 🎓"
                    className="min-h-12 w-full rounded-2xl border border-input bg-background px-4 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Predefined Bakery Extras with Quick Touch Steppers */}
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <h4 className="text-xs font-bold text-foreground">
                  الإضافات السريعة (Bakery Extras &amp; Add-ons)
                </h4>

                <div className="grid gap-2 sm:grid-cols-2">
                  {extras.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-background p-2.5"
                    >
                      <span className="text-xs font-bold text-foreground">
                        {ex.icon} {ex.name} <span className="text-muted-foreground">({jd(ex.price)})</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateExtraQty(ex.id, -1)}
                          className="grid h-10 w-10 place-items-center rounded-lg border border-input bg-secondary text-foreground hover:bg-secondary/80 cursor-pointer"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-6 text-center text-xs font-extrabold text-foreground">
                          {ex.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateExtraQty(ex.id, 1)}
                          className="grid h-10 w-10 place-items-center rounded-lg border border-input bg-secondary text-foreground hover:bg-secondary/80 cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Extra Input Option */}
                <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                  <input
                    type="text"
                    value={customExtraName}
                    onChange={(e) => setCustomExtraName(e.target.value)}
                    placeholder="إضافة مخصصة أخرى..."
                    className="min-h-11 flex-1 rounded-xl border border-input bg-background px-3 text-xs text-foreground"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={customExtraPrice}
                    onChange={(e) => setCustomExtraPrice(e.target.value)}
                    placeholder="السعر"
                    className="min-h-11 w-20 rounded-xl border border-input bg-background px-2 text-center text-xs font-bold text-foreground"
                  />
                  <button
                    type="button"
                    onClick={addCustomExtra}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Custom Manual Item Tab */
            <div className="space-y-4">
              <label className="block text-xs font-bold text-foreground">
                اسم الصنف المخصص *
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="مثال: كيكة تصميم خاص حسب الطلب"
                  className="mt-1 min-h-12 w-full rounded-2xl border border-input bg-background px-4 text-xs font-bold text-foreground outline-none focus:border-primary"
                />
              </label>

              <label className="block text-xs font-bold text-foreground">
                سعر الوحدة (د.أ) *
                <input
                  type="number"
                  step="0.25"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Math.max(Number(e.target.value) || 0, 0))}
                  className="mt-1 min-h-12 w-full rounded-2xl border border-input bg-background px-4 text-xs font-extrabold text-primary outline-none focus:border-primary"
                />
              </label>

              <label className="block text-xs font-bold text-foreground">
                ملاحظات أو مواصفات الصنف
                <textarea
                  rows={3}
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="اكتب مواصفات وتفاصيل هذا الصنف..."
                  className="mt-1 w-full rounded-2xl border border-input bg-background p-3 text-xs text-foreground outline-none focus:border-primary"
                />
              </label>
            </div>
          )}

          {/* Quantity Stepper */}
          <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/30 p-4">
            <span className="text-xs font-bold text-foreground">الكمية المطلوبة:</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(q - 1, 1))}
                className="grid h-12 w-12 place-items-center rounded-xl border border-input bg-background text-foreground shadow-xs hover:bg-secondary cursor-pointer"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="min-w-8 text-center font-display text-base font-extrabold text-foreground">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="grid h-12 w-12 place-items-center rounded-xl border border-input bg-background text-foreground shadow-xs hover:bg-secondary cursor-pointer"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Footer CTA */}
        <footer className="flex items-center justify-between gap-3 border-t border-border bg-card p-4">
          <div>
            <span className="block text-[11px] text-muted-foreground">مجموع الصنف:</span>
            <span className="font-display text-lg font-extrabold text-primary">
              {jd(liveLineTotal)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-extrabold text-primary-foreground shadow-sm transition-all hover:bg-primary/95 cursor-pointer"
          >
            <Check className="h-5 w-5" />
            <span>حفظ وتطبيق الصنف</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Responsive, Touch-Friendly Item Summary Card Component */
export function TouchItemSummaryCard({
  item,
  onEdit,
  onDelete,
  onQtyChange,
}: {
  item: SalesItem;
  onEdit: () => void;
  onDelete: () => void;
  onQtyChange: (newQty: number) => void;
}) {
  const lineTotal = item.unit_price * item.quantity;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:border-primary/40">
      {/* Title & Line Total */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h5 className="font-display text-base font-extrabold text-foreground break-words">
            {item.name_ar}
          </h5>
          <p className="text-xs text-muted-foreground">
            سعر الحبة: {jd(item.unit_price)}
          </p>
        </div>

        <div className="text-end shrink-0">
          <span className="block font-display text-base font-extrabold text-primary">
            {jd(lineTotal)}
          </span>
        </div>
      </div>

      {/* Attribute Sub-badges (Size, Filling, Writing, Extras) */}
      {(item.options_ar.length > 0 || item.notes) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {item.options_ar.map((opt, i) => (
            <span
              key={`${i}-${opt}`}
              className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground"
            >
              {opt}
            </span>
          ))}
          {item.notes && (
            <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              ملاحظة: {item.notes}
            </span>
          )}
        </div>
      )}

      {/* Touch-Friendly Action Bar: Quantity Stepper & Edit/Delete Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
        {/* Quantity Stepper (Large Touch Targets >= 44px) */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => onQtyChange(Math.max(item.quantity - 1, 1))}
            disabled={item.quantity <= 1}
            className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-40 cursor-pointer"
            aria-label="إنقاص الكمية"
          >
            <Minus className="h-4 w-4" />
          </button>

          <span className="min-w-8 text-center font-display text-sm font-extrabold text-foreground">
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={() => onQtyChange(item.quantity + 1)}
            className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-foreground hover:bg-secondary/80 cursor-pointer"
            aria-label="زيادة الكمية"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Edit & Delete Action Buttons (Min 44px height) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-4 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground cursor-pointer"
          >
            <PenTool className="h-4 w-4" />
            <span>تعديل</span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="grid h-11 w-11 place-items-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
            aria-label="حذف الصنف"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

