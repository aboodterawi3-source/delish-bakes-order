export type OrderModification = {
  id?: string;
  field: string;
  oldValue: string;
  newValue: string;
  updatedAt: string;
  acknowledgedAt?: string | null;
};

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

/**
 * Computes a deterministic key representing the unacknowledged kitchen-relevant modifications
 * of an order. Used identically on initial KDS load and on subsequent polling/realtime updates
 * so pre-existing unacknowledged modifications do not falsely re-trigger the audio alarm.
 */
export function computeUnackModKey(order: {
  version?: number | null | undefined;
  modifications?: OrderModification[] | null | undefined;
}): string | null {
  const unack = (order.modifications || [])
    .filter(isKitchenRelevantModification)
    .filter((m) => !m.acknowledgedAt);
  if (unack.length === 0) return null;
  const latestUnackTime = unack.reduce(
    (latest, m) => (m.updatedAt > latest ? m.updatedAt : latest),
    "",
  );
  return `${order.version || 1}_${unack.map((m) => (m as { id?: string }).id || m.updatedAt).join(",")}_${latestUnackTime}`;
}

/**
 * Applies a server-confirmed discount payload to a cached order row while advancing
 * its OCC `version` so consecutive edits do not fail with a stale-version conflict.
 */
export function applyDiscountToCachedOrder<
  T extends {
    id: string;
    subtotal: number;
    delivery_fee: number;
    method: string;
    version?: number;
  },
>(
  order: T,
  updated: {
    discount_amount: number;
    discount_percent: number;
    version?: number | null | undefined;
  },
): T & { discount_amount: number; discount_percent: number; total: number; version: number } {
  const nextTotal = Math.max(
    order.subtotal +
      (order.method === "delivery" ? order.delivery_fee : 0) -
      updated.discount_amount,
    0,
  );
  return {
    ...order,
    discount_amount: updated.discount_amount,
    discount_percent: updated.discount_percent,
    total: Number(nextTotal.toFixed(2)),
    version:
      typeof updated.version === "number" && Number.isFinite(updated.version)
        ? updated.version
        : (order.version ?? 1) + 1,
  };
}

/**
 * Produces a stable fingerprint of the storefront cart and checkout fields so
 * retries after an error keep the same idempotency key only when the order is unchanged.
 */
export function computeCartSubmissionFingerprint(input: {
  lines: ReadonlyArray<{ key: string; qty: number }>;
  method: string;
  area: string;
  date: string;
  time: string;
  pay: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
}): string {
  return JSON.stringify({
    lines: input.lines.map((l) => [l.key, l.qty]),
    method: input.method,
    area: input.area.trim(),
    date: input.date.trim(),
    time: input.time.trim(),
    pay: input.pay,
    name: input.name.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    notes: input.notes.trim(),
  });
}

export type DrawerOrderSnapshot = {
  id: string;
  deposit_paid: number;
  driver_name: string | null;
  driver_phone: string | null;
  discount_percent: number;
  address: string | null;
};

export type DrawerLocalFields = {
  deposit: string;
  driverName: string;
  driverPhone: string;
  discountPercent: string;
  discountReason: string;
  address: string;
};

/**
 * Reconciles OrderPanelDrawer local form fields when `order` updates.
 * - Switching to a different order ID resets every field to the new server values.
 * - Updating the same order ID (payments, discounts, realtime sync) refreshes any field
 *   whose server value changed AND wasn't locally dirtied by the staff member.
 */
export function reconcileOrderDrawerFields(
  prevServer: DrawerOrderSnapshot,
  nextServer: DrawerOrderSnapshot,
  local: DrawerLocalFields,
): DrawerLocalFields {
  const toSnapshotStrings = (s: DrawerOrderSnapshot) => ({
    deposit: String(s.deposit_paid),
    driverName: s.driver_name ?? "",
    driverPhone: s.driver_phone ?? "",
    discountPercent: String(s.discount_percent || ""),
    address: s.address ?? "",
  });

  const nextStr = toSnapshotStrings(nextServer);
  if (prevServer.id !== nextServer.id) {
    return { ...nextStr, discountReason: "" };
  }

  const prevStr = toSnapshotStrings(prevServer);
  const pick = <K extends keyof typeof nextStr>(key: K): string => {
    if (prevStr[key] !== nextStr[key] && local[key] === prevStr[key]) {
      return nextStr[key];
    }
    return local[key];
  };

  return {
    deposit: pick("deposit"),
    driverName: pick("driverName"),
    driverPhone: pick("driverPhone"),
    discountPercent: pick("discountPercent"),
    discountReason: local.discountReason,
    address: pick("address"),
  };
}
