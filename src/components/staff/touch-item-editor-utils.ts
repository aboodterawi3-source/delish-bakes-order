import { roundJod } from "../../lib/currency.ts";

export type BakeryExtraItem = {
  id: string;
  name: string;
  price: number;
  icon: string;
  qty: number;
};

export const DEFAULT_EXTRAS: Omit<BakeryExtraItem, "qty">[] = [
  { id: "candles", name: "شموع أرقام", price: 0.5, icon: "🕯️" },
  { id: "balloons", name: "بالونات هيليوم", price: 1.0, icon: "🎈" },
  { id: "topper", name: "توبير أكريليك / مجسم", price: 3.0, icon: "🎂" },
  { id: "cutlery", name: "طقم صحون وشوك", price: 0.5, icon: "🍽️" },
  { id: "flowers", name: "ورد طبيعي للتزيين", price: 2.5, icon: "🌸" },
];

export interface ParsedItemOptionsResult {
  selectedSize: string;
  selectedFilling: string;
  cakeInscription: string;
  extras: BakeryExtraItem[];
  unparsedOptions: string[];
  savedExtrasTotal: number;
}

/**
 * Regex to parse extra formatted string:
 * e.g. "🕯️ شموع أرقام (2 × 0.75 د.أ)" or "✨ شموع أرقام (1 × 4.00 د.أ)" or "بالونات هيليوم (3 × 1.00 JD)"
 */
export function parseExtraString(
  str: string,
): { icon: string; name: string; qty: number; price: number } | null {
  const match = str.match(
    /^(?:([\p{Extended_Pictographic}\p{Emoji}\uFE0F]+)\s*)?(.+?)\s*\(\s*(\d+)\s*[×xX*]\s*([\d.]+)(?:\s*(?:د\.أ|JD|JOD))?\s*\)$/u,
  );
  if (!match || !match[2] || !match[3] || !match[4]) return null;
  return {
    icon: (match[1] || "✨").trim(),
    name: match[2].trim(),
    qty: parseInt(match[3], 10),
    price: parseFloat(match[4]),
  };
}

/**
 * Parses options_ar strings into structured fields while preserving:
 * 1. Historical unit price of default extras (J2-A).
 * 2. Exact preservation of multiple extras even with identical names (K1).
 * 3. Free extras with price = 0.00 (K2).
 * 4. Any unparsed / custom instructions (e.g. "بدون مكسرات") (J2-B).
 */
export function parseOptionsAndExtras(
  options: string[] = [],
  defaultExtrasList: Omit<BakeryExtraItem, "qty">[] = DEFAULT_EXTRAS,
): ParsedItemOptionsResult {
  let selectedSize = "";
  let selectedFilling = "";
  let cakeInscription = "";
  const unparsedOptions: string[] = [];

  // Track which default extra IDs have already been claimed to prevent collision (K1)
  const claimedDefaultIds = new Set<string>();
  const matchedDefaultExtras = new Map<string, { qty: number; price: number; icon: string }>();
  const parsedCustomExtras: BakeryExtraItem[] = [];
  let savedExtrasTotal = 0;

  for (let i = 0; i < options.length; i++) {
    const opt = (options[i] || "").trim();
    if (!opt) continue;

    if (opt.startsWith("الحجم:")) {
      selectedSize = opt.replace("الحجم:", "").trim();
      continue;
    }
    if (opt.startsWith("الحشوة:")) {
      selectedFilling = opt.replace("الحشوة:", "").trim();
      continue;
    }
    if (opt.startsWith("الكتابة:")) {
      cakeInscription = opt.replace("الكتابة:", "").trim();
      continue;
    }

    const parsedExtra = parseExtraString(opt);
    if (parsedExtra) {
      const hasExplicitPrice =
        typeof parsedExtra.price === "number" &&
        !isNaN(parsedExtra.price) &&
        parsedExtra.price >= 0;

      // Look for exact icon match first
      let matchingDefault = defaultExtrasList.find(
        (def) =>
          def.name === parsedExtra.name &&
          def.icon === parsedExtra.icon &&
          !claimedDefaultIds.has(def.id),
      );

      // If no exact icon match, match default extra if no later option in this item has an exact icon match
      if (!matchingDefault) {
        const hasLaterExactMatch = options.some((otherOpt, otherIdx) => {
          if (otherIdx <= i) return false;
          const otherParsed = parseExtraString(otherOpt);
          return (
            otherParsed &&
            otherParsed.name === parsedExtra.name &&
            defaultExtrasList.some(
              (def) =>
                def.name === otherParsed.name &&
                def.icon === otherParsed.icon &&
                !claimedDefaultIds.has(def.id),
            )
          );
        });

        if (!hasLaterExactMatch) {
          matchingDefault = defaultExtrasList.find(
            (def) => def.name === parsedExtra.name && !claimedDefaultIds.has(def.id),
          );
        }
      }

      if (matchingDefault) {
        claimedDefaultIds.add(matchingDefault.id);
        const effectivePrice = hasExplicitPrice ? parsedExtra.price : matchingDefault.price;
        matchedDefaultExtras.set(matchingDefault.id, {
          qty: parsedExtra.qty,
          price: effectivePrice,
          icon: parsedExtra.icon || matchingDefault.icon,
        });
        savedExtrasTotal += effectivePrice * parsedExtra.qty;
      } else {
        // Distinct extra (e.g. second item with same name or custom extra) (K1)
        const effectivePrice = hasExplicitPrice ? parsedExtra.price : 0;
        parsedCustomExtras.push({
          id: `custom-extra-${i}-${Date.now()}`,
          name: parsedExtra.name,
          price: effectivePrice,
          icon: parsedExtra.icon,
          qty: parsedExtra.qty,
        });
        savedExtrasTotal += effectivePrice * parsedExtra.qty;
      }
    } else {
      // Unrecognized option / custom spec (e.g. "بدون مكسرات") -> preserve it!
      unparsedOptions.push(opt);
    }
  }

  // Construct full extras array: all default extras with matched or 0 qty + custom extras
  const fullExtras: BakeryExtraItem[] = defaultExtrasList.map((def) => {
    const matched = matchedDefaultExtras.get(def.id);
    return {
      id: def.id,
      name: def.name,
      price: matched ? matched.price : def.price, // Preserves historical unit price!
      icon: matched ? matched.icon : def.icon,
      qty: matched ? matched.qty : 0,
    };
  });

  return {
    selectedSize,
    selectedFilling,
    cakeInscription,
    extras: [...fullExtras, ...parsedCustomExtras],
    unparsedOptions,
    savedExtrasTotal: roundJod(savedExtrasTotal),
  };
}

/**
 * Calculates net base price by deducting saved extras from stored unit price.
 * K2: Do not clamp to 0 so authorized promotions/subsidies where unitPrice < savedExtrasTotal
 * maintain their exact mathematical basis.
 */
export function calculateBasePriceFromSaved(unitPrice: number, savedExtrasTotal: number): number {
  return roundJod(unitPrice - savedExtrasTotal);
}

/**
 * Evaluates whether filling flavor is required based on category and product config (J5).
 */
export function evaluateFillingRequirement(
  tab: "catalog" | "custom",
  category?: string | null,
  productFilling?: string | null,
): boolean {
  if (tab === "catalog") {
    const cat = (category || "").toLowerCase();
    const isCake = cat.includes("cake") || cat.includes("كيك");
    return Boolean((productFilling && productFilling.trim()) || isCake);
  }
  return false;
}

export interface CompilePayloadInput {
  tab: "catalog" | "custom";
  productId?: string | null | undefined;
  productName?: string | undefined;
  customName?: string | undefined;
  unitPrice: number;
  quantity: number;
  selectedSize?: string | undefined;
  selectedFilling?: string | undefined;
  cakeInscription?: string | undefined;
  unparsedOptions?: string[] | undefined;
  extras: BakeryExtraItem[];
  isFillingRequired?: boolean | undefined;
  itemNotes?: string | undefined;
  savedUnitPrice?: number | null | undefined;
  savedExtrasTotal?: number | null | undefined;
}

export interface CompilePayloadResult {
  success: boolean;
  error?: string;
  payload?: {
    productId: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    options: string[];
    notes: string;
  };
}

/**
 * Pure compiler for TouchItemEditor save payload with K1, K2, K3, K4 integrity guarantees.
 */
export function compileSavePayload(input: CompilePayloadInput): CompilePayloadResult {
  const name =
    (input.tab === "catalog" ? input.productName || input.customName : input.customName) || "";
  if (!name.trim()) {
    return { success: false, error: "يرجى اختيار منتج أو كتابة اسم الصنف" };
  }

  // J5: Enforce filling requirement if applicable
  if (input.isFillingRequired && (!input.selectedFilling || !input.selectedFilling.trim())) {
    return { success: false, error: "يرجى اختيار أو كتابة نوع الحشوة المطلوبة للكيك" };
  }

  // Calculate live extras total
  const currentExtrasTotal = (input.extras || []).reduce((sum, e) => sum + e.price * e.qty, 0);

  // Compile options array preserving unknown specs (J2-B)
  const compiledOptions: string[] = [];
  if (input.selectedSize && input.selectedSize.trim()) {
    compiledOptions.push(`الحجم: ${input.selectedSize.trim()}`);
  }
  if (input.selectedFilling && input.selectedFilling.trim()) {
    compiledOptions.push(`الحشوة: ${input.selectedFilling.trim()}`);
  }
  if (input.cakeInscription && input.cakeInscription.trim()) {
    compiledOptions.push(`الكتابة: ${input.cakeInscription.trim()}`);
  }

  // Preserve unparsed/custom options without mutation (J2-B)
  if (input.unparsedOptions && input.unparsedOptions.length > 0) {
    input.unparsedOptions.forEach((opt) => {
      if (opt && opt.trim() && !compiledOptions.includes(opt.trim())) {
        compiledOptions.push(opt.trim());
      }
    });
  }

  // Append extras with quantity > 0 (each extra is distinct and preserved) (K1)
  (input.extras || []).forEach((e) => {
    if (e.qty > 0) {
      compiledOptions.push(`${e.icon} ${e.name} (${e.qty} × ${e.price.toFixed(2)} د.أ)`);
    }
  });

  // Calculate final unit price:
  // K2: If editing an existing item with savedUnitPrice, apply delta of extras to preserve authorized discounts / zero prices!
  let finalUnitPrice: number;
  if (typeof input.savedUnitPrice === "number" && !isNaN(input.savedUnitPrice)) {
    const delta = roundJod(currentExtrasTotal - (input.savedExtrasTotal ?? 0));
    finalUnitPrice = Math.max(0, roundJod(input.savedUnitPrice + delta));
  } else {
    finalUnitPrice = roundJod(input.unitPrice + currentExtrasTotal);
  }

  return {
    success: true,
    payload: {
      productId: input.tab === "catalog" ? input.productId || null : null,
      name: name.trim(),
      quantity: Math.max(1, input.quantity),
      unitPrice: finalUnitPrice,
      options: compiledOptions,
      notes: (input.itemNotes || "").trim(),
    },
  };
}
