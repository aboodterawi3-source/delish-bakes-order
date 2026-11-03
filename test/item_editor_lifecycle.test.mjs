import assert from "node:assert/strict";

console.log("================================================================================");
console.log("🍰 TOUCH ITEM EDITOR LIFECYCLE & INTEGRITY SUITE (J2, J3, J5 VERIFICATION)");
console.log("================================================================================\n");

// Helpers mirroring the exact logic in TouchItemEditorSheet.tsx
const DEFAULT_EXTRAS = [
  { id: "candles", name: "شموع أرقام", price: 0.5, icon: "🕯️" },
  { id: "balloons", name: "بالونات هيليوم", price: 1.0, icon: "🎈" },
  { id: "topper", name: "توبير أكريليك / مجسم", price: 3.0, icon: "🎂" },
  { id: "cutlery", name: "طقم صحون وشوك", price: 0.5, icon: "🍽️" },
  { id: "flowers", name: "ورد طبيعي للتزيين", price: 2.5, icon: "🌸" },
];

function roundJod(val) {
  return Math.round(val * 100) / 100;
}

function parseItemOptionsAndBasePrice(item) {
  const opts = item.options_ar || [];
  const sizeOpt = opts.find((o) => o.startsWith("الحجم:"));
  const selectedSize = sizeOpt ? sizeOpt.replace("الحجم:", "").trim() : "";

  const fillingOpt = opts.find((o) => o.startsWith("الحشوة:"));
  const selectedFilling = fillingOpt ? fillingOpt.replace("الحشوة:", "").trim() : "";

  const writingOpt = opts.find((o) => o.startsWith("الكتابة:"));
  const cakeInscription = writingOpt ? writingOpt.replace("الكتابة:", "").trim() : "";

  let savedExtrasTotal = 0;
  const updatedDefaultExtras = DEFAULT_EXTRAS.map((def) => {
    const match = opts.find((o) => o.includes(def.name));
    if (match) {
      const qtyMatch = match.match(/\((\d+)\s*[×xX*]/) || match.match(/(\d+)/);
      const qty = qtyMatch?.[1] ? parseInt(qtyMatch[1], 10) : 1;
      savedExtrasTotal += def.price * qty;
      return { ...def, qty };
    }
    return { ...def, qty: 0 };
  });

  const parsedCustomExtras = [];
  opts.forEach((optStr, idx) => {
    if (optStr.startsWith("الحجم:") || optStr.startsWith("الحشوة:") || optStr.startsWith("الكتابة:")) return;
    if (DEFAULT_EXTRAS.some((def) => optStr.includes(def.name))) return;
    const customMatch = optStr.match(/^(?:(?:\p{Extended_Pictographic}|\p{Emoji}|[^\w\s])\s*)?(.+?)\s*\(\s*(\d+)\s*[×xX*]\s*([\d.]+)/u);
    if (customMatch && customMatch[1]) {
      const name = customMatch[1].trim();
      const qty = customMatch[2] ? parseInt(customMatch[2], 10) : 1;
      const price = customMatch[3] ? parseFloat(customMatch[3]) : 0;
      const iconMatch = optStr.match(/^(\p{Extended_Pictographic}|\p{Emoji})/u);
      const icon = iconMatch && iconMatch[1] ? iconMatch[1] : "✨";
      parsedCustomExtras.push({
        id: `custom-extra-${idx}`,
        name,
        price,
        icon,
        qty,
      });
      savedExtrasTotal += price * qty;
    }
  });

  const allExtras = [...updatedDefaultExtras, ...parsedCustomExtras];
  const basePrice = Math.max(0, roundJod(item.unit_price - savedExtrasTotal));

  return {
    selectedSize,
    selectedFilling,
    cakeInscription,
    extras: allExtras,
    basePrice,
    savedExtrasTotal,
  };
}

function compileSavePayload({ basePrice, extras, selectedSize, selectedFilling, cakeInscription, name, quantity, notes, isFillingRequired }) {
  if (!name.trim()) throw new Error("Item name required");
  if (isFillingRequired && !selectedFilling.trim()) {
    throw new Error("يرجى تحديد نوع الحشوة المطلوبة لهذا الصنف");
  }

  const compiledOptions = [];
  if (selectedSize) compiledOptions.push(`الحجم: ${selectedSize}`);
  if (selectedFilling.trim()) compiledOptions.push(`الحشوة: ${selectedFilling.trim()}`);
  if (cakeInscription.trim()) compiledOptions.push(`الكتابة: ${cakeInscription.trim()}`);

  let extrasTotal = 0;
  extras.forEach((e) => {
    if (e.qty > 0) {
      extrasTotal += e.price * e.qty;
      compiledOptions.push(`${e.icon} ${e.name} (${e.qty} × ${e.price.toFixed(2)} د.أ)`);
    }
  });

  const finalUnitPrice = roundJod(basePrice + extrasTotal);

  return {
    name,
    quantity,
    unitPrice: finalUnitPrice,
    options: compiledOptions,
    notes: notes?.trim() || null,
  };
}

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------------------
// TEST 1: J2 Addon Double-Count Prevention Across Consecutive Saves
// ------------------------------------------------------------------------------
test("1. J2: Item at 21 JD with 2 candles remains 21 JD after 2 consecutive saves and notes edit", () => {
  const initialItem = {
    id: "item-101",
    product_id: "prod-vanilla-cake",
    name_ar: "كيكة فانيلا",
    unit_price: 21.00, // base 20 + 2 candles (0.50 ea = 1.00)
    quantity: 1,
    options_ar: ["🕯️ شموع أرقام (2 × 0.50 د.أ)"],
    notes: null,
  };

  // Open item in editor
  const s1 = parseItemOptionsAndBasePrice(initialItem);
  assert.equal(s1.basePrice, 20.00, "Base price must be deducted to exactly 20.00 JD");
  assert.equal(s1.savedExtrasTotal, 1.00, "Saved extras total must be 1.00 JD");

  // Save 1: without any change
  const save1 = compileSavePayload({
    basePrice: s1.basePrice,
    extras: s1.extras,
    selectedSize: s1.selectedSize,
    selectedFilling: s1.selectedFilling,
    cakeInscription: s1.cakeInscription,
    name: initialItem.name_ar,
    quantity: initialItem.quantity,
    notes: initialItem.notes,
    isFillingRequired: false,
  });
  assert.equal(save1.unitPrice, 21.00, "First save unit price must remain exactly 21.00 JD");

  // Save 2: simulate opening the result of save 1 and saving again
  const itemAfterSave1 = { ...initialItem, unit_price: save1.unitPrice, options_ar: save1.options };
  const s2 = parseItemOptionsAndBasePrice(itemAfterSave1);
  const save2 = compileSavePayload({
    basePrice: s2.basePrice,
    extras: s2.extras,
    selectedSize: s2.selectedSize,
    selectedFilling: s2.selectedFilling,
    cakeInscription: s2.cakeInscription,
    name: itemAfterSave1.name_ar,
    quantity: itemAfterSave1.quantity,
    notes: itemAfterSave1.notes,
    isFillingRequired: false,
  });
  assert.equal(save2.unitPrice, 21.00, "Second consecutive save unit price must stay exactly 21.00 JD");

  // Save 3: edit notes only
  const save3 = compileSavePayload({
    basePrice: s2.basePrice,
    extras: s2.extras,
    selectedSize: s2.selectedSize,
    selectedFilling: s2.selectedFilling,
    cakeInscription: s2.cakeInscription,
    name: itemAfterSave1.name_ar,
    quantity: itemAfterSave1.quantity,
    notes: "كتابة بطاقة إهداء مع الطلب",
    isFillingRequired: false,
  });
  assert.equal(save3.unitPrice, 21.00, "Notes-only edit must preserve unit price at 21.00 JD");
  assert.equal(save3.notes, "كتابة بطاقة إهداء مع الطلب");
});

// ------------------------------------------------------------------------------
// TEST 2: J2 Changing Extras and Custom Extras
// ------------------------------------------------------------------------------
test("2. J2: Adding or removing extras accurately adjusts price with custom extras preserved", () => {
  const itemWithCustom = {
    id: "item-102",
    product_id: null,
    name_ar: "كيكة مخصصة",
    unit_price: 24.50, // base 20 + 2 candles (1.00) + custom topper (3.50)
    quantity: 1,
    options_ar: [
      "🕯️ شموع أرقام (2 × 0.50 د.أ)",
      "✨ مجسم سكر ثلاثي الأبعاد (1 × 3.50 د.أ)",
    ],
    notes: null,
  };

  const state = parseItemOptionsAndBasePrice(itemWithCustom);
  assert.equal(state.basePrice, 20.00, "Recovered base price must be 20.00 JD");
  assert.equal(state.savedExtrasTotal, 4.50, "Total saved extras must be 4.50 JD");

  // Increment candles from 2 to 3 (+0.50 JD)
  const modifiedExtras = state.extras.map((e) =>
    e.name === "شموع أرقام" ? { ...e, qty: 3 } : e
  );
  const savePlus = compileSavePayload({
    basePrice: state.basePrice,
    extras: modifiedExtras,
    selectedSize: "",
    selectedFilling: "",
    cakeInscription: "",
    name: itemWithCustom.name_ar,
    quantity: 1,
    notes: null,
    isFillingRequired: false,
  });
  assert.equal(savePlus.unitPrice, 25.00, "20 base + 1.50 candles + 3.50 custom = 25.00 JD");

  // Remove candles completely (0 candles)
  const zeroCandles = state.extras.map((e) =>
    e.name === "شموع أرقام" ? { ...e, qty: 0 } : e
  );
  const saveZero = compileSavePayload({
    basePrice: state.basePrice,
    extras: zeroCandles,
    selectedSize: "",
    selectedFilling: "",
    cakeInscription: "",
    name: itemWithCustom.name_ar,
    quantity: 1,
    notes: null,
    isFillingRequired: false,
  });
  assert.equal(saveZero.unitPrice, 23.50, "20 base + 0 candles + 3.50 custom = 23.50 JD");
});

// ------------------------------------------------------------------------------
// TEST 3: J3 State Isolation Between Consecutive Edit Sessions
// ------------------------------------------------------------------------------
test("3. J3: Switching from Item A (full options) to Item B (no options) strictly resets all fields", () => {
  const itemA = {
    id: "item-A",
    product_id: "cake-tiered",
    name_ar: "كيكة طبقات",
    unit_price: 35.00,
    quantity: 1,
    options_ar: [
      "الحجم: كبير (15 شخص)",
      "الحشوة: فانيلا فراولة غنية",
      "الكتابة: مبروك التخرج يا أحمد 🎓",
      "🕯️ شموع أرقام (4 × 0.50 د.أ)",
    ],
    notes: "رجاء التوصيل مبرد",
  };

  const itemB = {
    id: "item-B",
    product_id: null,
    name_ar: "كرواسان زبدة",
    unit_price: 1.50,
    quantity: 2,
    options_ar: [],
    notes: null,
  };

  // State after parsing Item A
  const stateA = parseItemOptionsAndBasePrice(itemA);
  assert.equal(stateA.selectedSize, "كبير (15 شخص)");
  assert.equal(stateA.selectedFilling, "فانيلا فراولة غنية");
  assert.equal(stateA.cakeInscription, "مبروك التخرج يا أحمد 🎓");

  // State after switching to Item B
  const stateB = parseItemOptionsAndBasePrice(itemB);
  assert.equal(stateB.selectedSize, "", "Item B must have empty size");
  assert.equal(stateB.selectedFilling, "", "Item B must have empty filling");
  assert.equal(stateB.cakeInscription, "", "Item B must have empty inscription");
  assert.equal(stateB.savedExtrasTotal, 0, "Item B must have 0 extras");
  assert.equal(stateB.basePrice, 1.50, "Item B base price must be 1.50 JD");
});

// ------------------------------------------------------------------------------
// TEST 4: J5 Filling Requirement Validation Logic
// ------------------------------------------------------------------------------
test("4. J5: Filling requirement strictly validated for cakes and optional for non-cakes", () => {
  const cakeProduct = {
    category: "Cake",
    filling_ar: "شوكولاتة نوتيلا",
  };
  const isCakeFillingRequired = Boolean(cakeProduct.category.toLowerCase().includes("cake") || cakeProduct.filling_ar);
  assert.equal(isCakeFillingRequired, true, "Cake must require filling");

  // Attempt save cake without filling -> throws validation error
  assert.throws(
    () => {
      compileSavePayload({
        basePrice: 20,
        extras: [],
        selectedSize: "وسط",
        selectedFilling: "", // empty!
        cakeInscription: "",
        name: "كيكة شوكولاتة",
        quantity: 1,
        notes: null,
        isFillingRequired: isCakeFillingRequired,
      });
    },
    /يرجى تحديد نوع الحشوة/,
    "Must throw error when required cake filling is empty"
  );

  // Non-cake product (e.g. cookies)
  const cookieProduct = {
    category: "Cookies",
    filling_ar: null,
  };
  const isCookieFillingRequired = Boolean(cookieProduct.category.toLowerCase().includes("cake") || cookieProduct.filling_ar);
  assert.equal(isCookieFillingRequired, false, "Cookies must not require filling");

  // Save cookie without filling -> succeeds cleanly
  const cookieSave = compileSavePayload({
    basePrice: 5.00,
    extras: [],
    selectedSize: "",
    selectedFilling: "",
    cakeInscription: "",
    name: "كوكيز كلاسيك",
    quantity: 1,
    notes: null,
    isFillingRequired: isCookieFillingRequired,
  });
  assert.equal(cookieSave.unitPrice, 5.00);
  assert.equal(cookieSave.options.length, 0);
});

console.log("\n================================================================================");
console.log(`🏁 ITEM EDITOR LIFECYCLE SUITE: ${passed} of ${total} checks passed cleanly!`);
console.log("================================================================================\n");
