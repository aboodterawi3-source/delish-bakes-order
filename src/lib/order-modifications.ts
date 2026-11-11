import type { OrderModification } from "@/lib/server-shared";

/**
 * Keywords for driver, delivery dispatch, and transfer/payment that should
 * NEVER clutter the kitchen screen or the consolidated modifications list.
 */
const IRRELEVANT_MODIFICATION_KEYWORDS = [
  // Driver & dispatch
  "سائق",
  "سائق التوصيل",
  "السائق",
  "شركة التوصيل",
  "شركة توصيل",
  "توصيل_fee",
  "أجرة التوصيل",
  "رسوم التوصيل",
  "driver",
  // Money, transfers, payments, CliQ
  "عربون",
  "العربون",
  "مبلغ",
  "المبلغ",
  "إجمالي",
  "الاجمالي",
  "دفع",
  "الدفع",
  "كليك",
  "حوالة",
  "تحويل",
  "سعر",
  "رسوم",
  "total",
  "deposit",
  "payment",
  "price",
  "fee",
  "cliq",
  "transfer",
  "receipt",
  "ايصال",
  "إيصال",
  // Channel, phone, social & internal metadata
  "مصدر",
  "المصدر",
  "واتساب",
  "انستغرام",
  "هاتف",
  "موبايل",
  "تواصل",
  "source",
  "phone",
  "mobile",
  "الطلب الأساسي",
  "النسخة الأصلية",
  "حالة الطلب",
  "موظفين",
  "staff_notes",
];

/**
 * Checks if a modification is relevant to kitchen / cake preparation staff.
 * Strictly filters out driver assignments, transfers, CliQ, financial, billing, and channel changes.
 */
export function isKitchenRelevantModification(
  mod: Pick<OrderModification, "field"> & Partial<OrderModification>,
): boolean {
  const f = (mod.field || "").toLowerCase();
  if (!f) return false;

  // Filter out generic boilerplate / noise
  const isGenericNoise =
    (mod.newValue ?? "").includes("تم حفظ وتحديث") ||
    (mod.newValue ?? "").includes("تم إجراء أول تعديل") ||
    (mod.oldValue ?? "").includes("البيانات السابقة للطلب");
  if (isGenericNoise) return false;

  return !IRRELEVANT_MODIFICATION_KEYWORDS.some((kw) => f.includes(kw));
}

/**
 * Consolidates modifications by field name so only the latest approved choice is displayed,
 * stripping out redundant intermediate steps, driver assignments, and transfer notices.
 */
export function consolidateModifications(
  modifications?: OrderModification[] | null | undefined,
  options?: { isKitchen?: boolean | undefined } | undefined,
): OrderModification[] {
  if (!modifications || modifications.length === 0) return [];

  const isKitchen = options?.isKitchen ?? false;

  // 1. Filter out irrelevant / unneeded modifications
  const filtered = modifications.filter((mod) => {
    if (!mod || !mod.field) return false;
    // Always strip driver, transfers, payments, and noise
    if (!isKitchenRelevantModification(mod)) {
      // If kitchen mode, strictly omit
      if (isKitchen) return false;
      // In general view, still omit driver and transfer noise per user specification
      const f = mod.field.toLowerCase();
      const isDriverOrTransfer = [
        "سائق",
        "السائق",
        "شركة التوصيل",
        "driver",
        "حوالة",
        "تحويل",
        "كليك",
        "cliq",
        "transfer",
      ].some((kw) => f.includes(kw));
      if (isDriverOrTransfer) return false;
    }
    // Omit entries with no real new value
    if (!mod.newValue || mod.newValue === "—" || mod.newValue.trim() === "") return false;
    return true;
  });

  // 2. Group by field to keep only the newest modification for each field
  const map = new Map<string, OrderModification>();
  for (const mod of filtered) {
    const key = mod.field.trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, mod);
    } else {
      // Pick the more recent one
      const existingTime = new Date(existing.updatedAt || 0).getTime();
      const currentTime = new Date(mod.updatedAt || 0).getTime();
      if (currentTime >= existingTime) {
        map.set(key, mod);
      }
    }
  }

  return Array.from(map.values());
}
