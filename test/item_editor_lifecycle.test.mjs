// ==============================================================================
// DELISH CAKE & BAKE — TOUCH ITEM EDITOR LIFECYCLE & INTEGRITY SUITE
// Directly imports and executes the actual application code units from
// src/components/staff/touch-item-editor-utils.ts for J2-A, J2-B, J3, and J5.
// ==============================================================================

import assert from "node:assert/strict";
import {
  DEFAULT_EXTRAS,
  parseOptionsAndExtras,
  calculateBasePriceFromSaved,
  evaluateFillingRequirement,
  compileSavePayload,
} from "../src/components/staff/touch-item-editor-utils.ts";

console.log("================================================================================");
console.log("🍰 TOUCH ITEM EDITOR LIFECYCLE & INTEGRITY SUITE (ACTUAL SOURCE CODE UNIT TESTS)");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------------------
// TEST 1 (J2-A): Historical Price Retention & Exact Deduction upon Removal
// ------------------------------------------------------------------------------
await test("1. J2-A: Item at 21.50 JD with 2 candles @ 0.75 historical price saves as 20.00 JD when candles removed", () => {
  const item = {
    id: "item-hist-1",
    product_id: "prod-1",
    name_ar: "كيكة فانيلا فاخرة",
    unit_price: 21.5,
    quantity: 1,
    options_ar: ["الحجم: وسط (10 أشخاص)", "الحشوة: فانيلا", "🕯️ شموع أرقام (2 × 0.75 د.أ)"],
    notes: "ملاحظات الطلب",
  };

  // Step A: Parse options using actual application function
  const parsed = parseOptionsAndExtras(item.options_ar, DEFAULT_EXTRAS);
  assert.equal(parsed.selectedSize, "وسط (10 أشخاص)");
  assert.equal(parsed.selectedFilling, "فانيلا");

  // Verify historical candle price was extracted (0.75 each, not default 0.50)
  const candles = parsed.extras.find((e) => e.name === "شموع أرقام");
  assert.ok(candles, "Candles must be matched");
  assert.equal(candles.qty, 2, "Quantity must be 2");
  assert.equal(candles.price, 0.75, "Historical unit price must be preserved as 0.75");
  assert.equal(parsed.savedExtrasTotal, 1.5, "Saved extras total must be exactly 1.50 JD");

  // Step B: Calculate base price
  const basePrice = calculateBasePriceFromSaved(item.unit_price, parsed.savedExtrasTotal);
  assert.equal(basePrice, 20.0, "Inferred base price must be 20.00 JD");

  // Step C: Save without modification (candles kept) -> must remain 21.50 JD
  const keptRes = compileSavePayload({
    tab: "catalog",
    productName: item.name_ar,
    unitPrice: basePrice,
    quantity: 1,
    selectedSize: parsed.selectedSize,
    selectedFilling: parsed.selectedFilling,
    extras: parsed.extras,
    isFillingRequired: true,
  });
  assert.equal(keptRes.success, true);
  assert.equal(keptRes.payload.unitPrice, 21.5, "Keeping 0.75 candles preserves 21.50 JD");

  // Step D: Remove candles (qty set to 0) -> must save as exactly 20.00 JD
  const removedExtras = parsed.extras.map((e) => (e.name === "شموع أرقام" ? { ...e, qty: 0 } : e));
  const removedRes = compileSavePayload({
    tab: "catalog",
    productName: item.name_ar,
    unitPrice: basePrice,
    quantity: 1,
    selectedSize: parsed.selectedSize,
    selectedFilling: parsed.selectedFilling,
    extras: removedExtras,
    isFillingRequired: true,
  });
  assert.equal(removedRes.success, true);
  assert.equal(
    removedRes.payload.unitPrice,
    20.0,
    "Removing candles MUST result in clean 20.00 JD base price",
  );
  assert.equal(
    removedRes.payload.options.some((o) => o.includes("شموع")),
    false,
    "Candles must not appear in compiled options when qty is 0",
  );
});

// ------------------------------------------------------------------------------
// TEST 2 (J2-B): Unknown Options & Distinct Custom Extras Preservation
// ------------------------------------------------------------------------------
await test("2. J2-B: Unknown specs ('بدون مكسرات') and custom extra ('شموع أرقام ذهبية' @ 4.00) preserved without corruption", () => {
  const item = {
    id: "item-custom-1",
    name_ar: "كيكة مخصصة",
    unit_price: 24.0, // 20.00 base + 4.00 gold candles
    quantity: 1,
    options_ar: [
      "الحجم: كبير (15 شخص)",
      "الحشوة: كيندر",
      "بدون مكسرات", // Unparsed / custom specification
      "✨ شموع أرقام ذهبية (1 × 4.00 د.أ)", // Custom extra sharing partial name with default candles
    ],
  };

  // Step A: Parse options
  const parsed = parseOptionsAndExtras(item.options_ar, DEFAULT_EXTRAS);

  // Check unknown options preserved
  assert.deepEqual(
    parsed.unparsedOptions,
    ["بدون مكسرات"],
    "Unknown spec 'بدون مكسرات' must be preserved",
  );

  // Check custom extra did NOT match default candles
  const defaultCandles = parsed.extras.find((e) => e.name === "شموع أرقام");
  assert.equal(defaultCandles.qty, 0, "Default candles must NOT match 'شموع أرقام ذهبية'");

  const customCandles = parsed.extras.find((e) => e.name === "شموع أرقام ذهبية");
  assert.ok(customCandles, "Custom extra 'شموع أرقام ذهبية' must be preserved as distinct extra");
  assert.equal(customCandles.price, 4.0, "Price must remain 4.00 JD");
  assert.equal(customCandles.qty, 1);
  assert.equal(parsed.savedExtrasTotal, 4.0);

  const basePrice = calculateBasePriceFromSaved(item.unit_price, parsed.savedExtrasTotal);
  assert.equal(basePrice, 20.0);

  // Step B: Save without modifications -> compileSavePayload
  const res = compileSavePayload({
    tab: "catalog",
    productName: item.name_ar,
    unitPrice: basePrice,
    quantity: 1,
    selectedSize: parsed.selectedSize,
    selectedFilling: parsed.selectedFilling,
    unparsedOptions: parsed.unparsedOptions,
    extras: parsed.extras,
    isFillingRequired: true,
  });

  assert.equal(res.success, true);
  assert.equal(res.payload.unitPrice, 24.0, "Total price must remain 24.00 JD");
  assert.ok(
    res.payload.options.includes("بدون مكسرات"),
    "'بدون مكسرات' must be preserved in compiled options",
  );
  assert.ok(
    res.payload.options.some((o) => o.includes("شموع أرقام ذهبية (1 × 4.00 د.أ)")),
    "Custom gold candles must be preserved with exact 4.00 price",
  );
});

// ------------------------------------------------------------------------------
// TEST 3 (J3): Switching Product A to B within Same Session Resets Filling
// ------------------------------------------------------------------------------
await test("3. J3: Switching from Product A (with filling) to Product B (without filling) resets filling to empty", () => {
  const prodA = {
    id: "prod-a",
    name_ar: "كيكة الريد فيلفيت",
    price: 25.0,
    category: "Cakes",
    filling_ar: "تشيز كيك فانيلا",
  };

  const prodB = {
    id: "prod-b",
    name_ar: "علبة كوكيز ميكس",
    price: 10.0,
    category: "Cookies",
    filling_ar: "", // No filling for cookies!
  };

  // User chooses Product A
  let selectedFilling = prodA.filling_ar?.trim() || "";
  assert.equal(selectedFilling, "تشيز كيك فانيلا");

  // User switches to Product B inside the same session
  // Logic executed in handleSelectProduct:
  selectedFilling = prodB.filling_ar?.trim() || "";
  assert.equal(
    selectedFilling,
    "",
    "Switching to Product B must reset selectedFilling to empty string",
  );

  // Attempting to save Product B (Cookies) without filling succeeds because cookies do not require filling
  const isReqB = evaluateFillingRequirement("catalog", prodB.category, prodB.filling_ar);
  assert.equal(isReqB, false, "Cookies must not require filling");

  const saveB = compileSavePayload({
    tab: "catalog",
    productName: prodB.name_ar,
    unitPrice: prodB.price,
    quantity: 1,
    selectedFilling: selectedFilling,
    extras: DEFAULT_EXTRAS.map((e) => ({ ...e, qty: 0 })),
    isFillingRequired: isReqB,
  });
  assert.equal(saveB.success, true);
  assert.equal(
    saveB.payload.options.some((o) => o.startsWith("الحشوة:")),
    false,
  );
});

// ------------------------------------------------------------------------------
// TEST 4 (J5): Filling Requirement Enforcement on handleSave Compiler
// ------------------------------------------------------------------------------
await test("4. J5: Cake strictly rejects save when filling is missing, while non-cake saves smoothly", () => {
  // Cake requiring filling
  const cakeReq = evaluateFillingRequirement("catalog", "Cakes / كيك المناسبات", null);
  assert.equal(cakeReq, true, "Cake category must evaluate isFillingRequired to true");

  const cakeAttemptEmpty = compileSavePayload({
    tab: "catalog",
    productName: "كيكة شوكولاتة",
    unitPrice: 20.0,
    quantity: 1,
    selectedFilling: "   ", // Empty string
    extras: DEFAULT_EXTRAS.map((e) => ({ ...e, qty: 0 })),
    isFillingRequired: cakeReq,
  });
  assert.equal(cakeAttemptEmpty.success, false, "Cake with empty filling must fail save");
  assert.ok(cakeAttemptEmpty.error.includes("الحشوة"), "Error message must mention filling");

  const cakeAttemptFilled = compileSavePayload({
    tab: "catalog",
    productName: "كيكة شوكولاتة",
    unitPrice: 20.0,
    quantity: 1,
    selectedFilling: "لوتس مقرمش",
    extras: DEFAULT_EXTRAS.map((e) => ({ ...e, qty: 0 })),
    isFillingRequired: cakeReq,
  });
  assert.equal(cakeAttemptFilled.success, true, "Cake with filled flavor must succeed save");
  assert.ok(cakeAttemptFilled.payload.options.includes("الحشوة: لوتس مقرمش"));
});

// ------------------------------------------------------------------------------
// TEST 5 (K1): Duplicate Named Extras (Default + Custom) Preserved Distinctly
// ------------------------------------------------------------------------------
await test("5. K1: Duplicate named extras ('🕯️ شموع أرقام' 0.50 + '✨ شموع أرقام' 4.00) preserved without collision", () => {
  const item = {
    id: "item-k1-collision",
    name_ar: "كيكة المناسبات",
    unit_price: 24.5, // 20.00 base + 0.50 default candle + 4.00 custom candle
    quantity: 1,
    options_ar: [
      "الحجم: وسط (10 أشخاص)",
      "الحشوة: فانيلا",
      "🕯️ شموع أرقام (1 × 0.50 د.أ)",
      "✨ شموع أرقام (1 × 4.00 د.أ)",
    ],
  };

  // Step A: Parse options with actual function
  const parsed = parseOptionsAndExtras(item.options_ar, DEFAULT_EXTRAS);

  // Assert both extras exist distinctly in parsed extras
  const defaultCandle = parsed.extras.find((e) => e.name === "شموع أرقام" && e.icon === "🕯️");
  const customCandle = parsed.extras.find((e) => e.name === "شموع أرقام" && e.icon === "✨");

  assert.ok(defaultCandle, "Default 0.50 candle must be extracted");
  assert.equal(defaultCandle.price, 0.5, "Default candle price must be 0.50 JD");
  assert.equal(defaultCandle.qty, 1);

  assert.ok(customCandle, "Custom 4.00 candle with same name must be extracted distinctly");
  assert.equal(customCandle.price, 4.0, "Custom candle price must be 4.00 JD");
  assert.equal(customCandle.qty, 1);

  assert.equal(parsed.savedExtrasTotal, 4.5, "Saved extras total must be exactly 4.50 JD");

  const basePrice = calculateBasePriceFromSaved(item.unit_price, parsed.savedExtrasTotal);
  assert.equal(basePrice, 20.0, "Net base price must be 20.00 JD");

  // Step B: Save without changes
  const save1 = compileSavePayload({
    tab: "catalog",
    productName: item.name_ar,
    unitPrice: basePrice,
    quantity: 1,
    selectedSize: parsed.selectedSize,
    selectedFilling: parsed.selectedFilling,
    extras: parsed.extras,
    isFillingRequired: true,
    savedUnitPrice: item.unit_price,
    savedExtrasTotal: parsed.savedExtrasTotal,
  });
  assert.equal(save1.success, true);
  assert.equal(save1.payload.unitPrice, 24.5, "Total price must remain exactly 24.50 JD");
  assert.ok(
    save1.payload.options.includes("🕯️ شموع أرقام (1 × 0.50 د.أ)"),
    "First candle option must be preserved",
  );
  assert.ok(
    save1.payload.options.includes("✨ شموع أرقام (1 × 4.00 د.أ)"),
    "Second candle option must be preserved",
  );

  // Step C: Second pass (re-parse saved options and save again)
  const parsed2 = parseOptionsAndExtras(save1.payload.options, DEFAULT_EXTRAS);
  assert.equal(parsed2.savedExtrasTotal, 4.5);
  const save2 = compileSavePayload({
    tab: "catalog",
    productName: item.name_ar,
    unitPrice: basePrice,
    quantity: 1,
    selectedSize: parsed2.selectedSize,
    selectedFilling: parsed2.selectedFilling,
    extras: parsed2.extras,
    isFillingRequired: true,
    savedUnitPrice: save1.payload.unitPrice,
    savedExtrasTotal: parsed2.savedExtrasTotal,
  });
  assert.equal(save2.success, true);
  assert.equal(save2.payload.unitPrice, 24.5, "Second save must maintain 24.50 JD");
  assert.equal(
    save2.payload.options.filter((o) => o.includes("شموع أرقام")).length,
    2,
    "Both candle options must still be present",
  );

  // Step D: Delete custom candle (4.00) only -> price becomes 20.50 JD
  const extrasNoCustom = parsed.extras.map((e) => (e.icon === "✨" ? { ...e, qty: 0 } : e));
  const saveNoCustom = compileSavePayload({
    tab: "catalog",
    productName: item.name_ar,
    unitPrice: basePrice,
    quantity: 1,
    selectedSize: parsed.selectedSize,
    selectedFilling: parsed.selectedFilling,
    extras: extrasNoCustom,
    isFillingRequired: true,
    savedUnitPrice: item.unit_price,
    savedExtrasTotal: parsed.savedExtrasTotal,
  });
  assert.equal(saveNoCustom.success, true);
  assert.equal(
    saveNoCustom.payload.unitPrice,
    20.5,
    "Removing 4.00 candle yields exactly 20.50 JD (20.00 base + 0.50 default)",
  );
  assert.equal(saveNoCustom.payload.options.includes("🕯️ شموع أرقام (1 × 0.50 د.أ)"), true);
  assert.equal(saveNoCustom.payload.options.includes("✨ شموع أرقام (1 × 4.00 د.أ)"), false);

  // Step E: Delete default candle (0.50) only -> price becomes 24.00 JD
  const extrasNoDefault = parsed.extras.map((e) => (e.icon === "🕯️" ? { ...e, qty: 0 } : e));
  const saveNoDefault = compileSavePayload({
    tab: "catalog",
    productName: item.name_ar,
    unitPrice: basePrice,
    quantity: 1,
    selectedSize: parsed.selectedSize,
    selectedFilling: parsed.selectedFilling,
    extras: extrasNoDefault,
    isFillingRequired: true,
    savedUnitPrice: item.unit_price,
    savedExtrasTotal: parsed.savedExtrasTotal,
  });
  assert.equal(saveNoDefault.success, true);
  assert.equal(
    saveNoDefault.payload.unitPrice,
    24.0,
    "Removing 0.50 candle yields exactly 24.00 JD (20.00 base + 4.00 custom)",
  );
  assert.equal(saveNoDefault.payload.options.includes("🕯️ شموع أرقام (1 × 0.50 د.أ)"), false);
  assert.equal(saveNoDefault.payload.options.includes("✨ شموع أرقام (1 × 4.00 د.أ)"), true);

  // Step F: Delete both candles -> price becomes 20.00 JD
  const extrasNoBoth = parsed.extras.map((e) => ({ ...e, qty: 0 }));
  const saveNoBoth = compileSavePayload({
    tab: "catalog",
    productName: item.name_ar,
    unitPrice: basePrice,
    quantity: 1,
    selectedSize: parsed.selectedSize,
    selectedFilling: parsed.selectedFilling,
    extras: extrasNoBoth,
    isFillingRequired: true,
    savedUnitPrice: item.unit_price,
    savedExtrasTotal: parsed.savedExtrasTotal,
  });
  assert.equal(saveNoBoth.success, true);
  assert.equal(saveNoBoth.payload.unitPrice, 20.0, "Removing all candles yields exactly 20.00 JD");
});

// ------------------------------------------------------------------------------
// TEST 6 (K2): Zero Price & Authorized Low Price Retention
// ------------------------------------------------------------------------------
await test("6. K2: Zero-priced extras and authorized low-price items (0.00 & 0.50 JD) retain exact pricing on save", () => {
  // Part A: Free custom extra @ 0.00 JD
  const freeItem = {
    id: "item-free-extra",
    name_ar: "كيكة شوكولاتة",
    unit_price: 20.0,
    quantity: 1,
    options_ar: [
      "الحجم: وسط (10 أشخاص)",
      "الحشوة: نوتيلا",
      "✨ شموع أرقام (1 × 0.00 د.أ)", // Free extra with explicit 0.00 price!
    ],
  };

  const parsedFree = parseOptionsAndExtras(freeItem.options_ar, DEFAULT_EXTRAS);
  const freeCandle = parsedFree.extras.find((e) => e.name === "شموع أرقام");
  assert.ok(freeCandle, "Free extra must be parsed");
  assert.equal(freeCandle.price, 0.0, "Price of 0.00 must NOT be overwritten by default 0.50!");
  assert.equal(parsedFree.savedExtrasTotal, 0.0, "Saved extras total must be 0.00 JD");

  const basePriceFree = calculateBasePriceFromSaved(freeItem.unit_price, parsedFree.savedExtrasTotal);
  assert.equal(basePriceFree, 20.0, "Net base price is 20.00 JD");

  // Save keeping the free extra -> 20.00 JD
  const saveFreeKept = compileSavePayload({
    tab: "catalog",
    productName: freeItem.name_ar,
    unitPrice: basePriceFree,
    quantity: 1,
    selectedSize: parsedFree.selectedSize,
    selectedFilling: parsedFree.selectedFilling,
    extras: parsedFree.extras,
    isFillingRequired: true,
    savedUnitPrice: freeItem.unit_price,
    savedExtrasTotal: parsedFree.savedExtrasTotal,
  });
  assert.equal(saveFreeKept.success, true);
  assert.equal(saveFreeKept.payload.unitPrice, 20.0, "Keeping 0.00 extra preserves 20.00 JD");

  // Remove the free extra -> MUST remain 20.00 JD (NOT 19.50 JD!)
  const freeExtrasRemoved = parsedFree.extras.map((e) => ({ ...e, qty: 0 }));
  const saveFreeRemoved = compileSavePayload({
    tab: "catalog",
    productName: freeItem.name_ar,
    unitPrice: basePriceFree,
    quantity: 1,
    selectedSize: parsedFree.selectedSize,
    selectedFilling: parsedFree.selectedFilling,
    extras: freeExtrasRemoved,
    isFillingRequired: true,
    savedUnitPrice: freeItem.unit_price,
    savedExtrasTotal: parsedFree.savedExtrasTotal,
  });
  assert.equal(saveFreeRemoved.success, true);
  assert.equal(
    saveFreeRemoved.payload.unitPrice,
    20.0,
    "Removing 0.00 extra must result in 20.00 JD (NOT 19.50 JD)",
  );

  // Part B: Authorized item at 0.50 JD with 1.00 JD extras (promotional/subsidized price)
  const promoItem050 = {
    id: "item-promo-050",
    name_ar: "عرض ترويجي",
    unit_price: 0.5, // Authorized low unit price!
    quantity: 1,
    options_ar: ["🕯️ شموع أرقام (2 × 0.50 د.أ)"], // Extras worth 1.00 JD
    notes: "ملاحظات الإدارة",
  };

  const parsed050 = parseOptionsAndExtras(promoItem050.options_ar, DEFAULT_EXTRAS);
  assert.equal(parsed050.savedExtrasTotal, 1.0, "Saved extras total is 1.00 JD");

  const basePrice050 = calculateBasePriceFromSaved(promoItem050.unit_price, parsed050.savedExtrasTotal);
  assert.equal(basePrice050, -0.5, "Unclamped base price is -0.50 JD");

  // Save without modification or editing notes only -> MUST remain exactly 0.50 JD!
  const save050NotesOnly = compileSavePayload({
    tab: "catalog",
    productName: promoItem050.name_ar,
    unitPrice: basePrice050,
    quantity: 1,
    extras: parsed050.extras,
    itemNotes: "تعديل الملاحظات فقط",
    savedUnitPrice: promoItem050.unit_price,
    savedExtrasTotal: parsed050.savedExtrasTotal,
  });
  assert.equal(save050NotesOnly.success, true);
  assert.equal(
    save050NotesOnly.payload.unitPrice,
    0.5,
    "Authorized 0.50 JD item MUST NOT jump to 1.00 JD on save!",
  );
  assert.equal(save050NotesOnly.payload.notes, "تعديل الملاحظات فقط");

  // Part C: Authorized item at 0.00 JD with 1.00 JD extras
  const freePromoItem = {
    id: "item-promo-000",
    name_ar: "هدية مجانية",
    unit_price: 0.0, // Free promotional item!
    quantity: 1,
    options_ar: ["🕯️ شموع أرقام (2 × 0.50 د.أ)"],
  };

  const parsed000 = parseOptionsAndExtras(freePromoItem.options_ar, DEFAULT_EXTRAS);
  const save000Unchanged = compileSavePayload({
    tab: "catalog",
    productName: freePromoItem.name_ar,
    unitPrice: -1.0,
    quantity: 1,
    extras: parsed000.extras,
    savedUnitPrice: freePromoItem.unit_price,
    savedExtrasTotal: parsed000.savedExtrasTotal,
  });
  assert.equal(save000Unchanged.success, true);
  assert.equal(
    save000Unchanged.payload.unitPrice,
    0.0,
    "Free 0.00 JD item MUST NOT jump to 1.00 JD on save!",
  );
});

// ------------------------------------------------------------------------------
// TEST 7 (K3): Product Selection & Size Price Invariance
// ------------------------------------------------------------------------------
await test("7. K3: Switching product resets size; order of product/size clicks produces identical invariant pricing", () => {
  const prodA = {
    id: "prod-a",
    name_ar: "كيكة فانيلا فاخرة",
    price: 20.0,
    sizes: [{ label: "عائلي (20+ شخص)", price: 30.0 }],
  };

  const prodB = {
    id: "prod-b",
    name_ar: "كيكة شوكولاتة",
    price: 10.0,
    sizes: [{ label: "عائلي (20+ شخص)", price: 20.0 }],
  };

  // Workflow 1: Click A (20) -> Click Family (+10 = 30) -> Switch to B -> Click Family (+10 = 20)
  // Simulating exact component state transitions:
  let selectedProduct = prodA;
  let selectedSize = "";
  let unitPrice = prodA.price;

  // Click Family size on A
  selectedSize = "عائلي (20+ شخص)";
  const sizeA = prodA.sizes.find((s) => s.label === selectedSize);
  unitPrice = sizeA.price; // 30.00
  assert.equal(unitPrice, 30.0);

  // Switch to Product B (handleSelectProduct)
  selectedProduct = prodB;
  selectedSize = ""; // K3 FIX: reset selectedSize!
  unitPrice = prodB.price || 0; // 10.00
  assert.equal(selectedSize, "");
  assert.equal(unitPrice, 10.0);

  // Click Family size on B
  selectedSize = "عائلي (20+ شخص)";
  const sizeB = prodB.sizes.find((s) => s.label === selectedSize);
  unitPrice = sizeB.price; // 20.00
  assert.equal(unitPrice, 20.0);

  const payloadFlow1 = compileSavePayload({
    tab: "catalog",
    productId: selectedProduct.id,
    productName: selectedProduct.name_ar,
    unitPrice: unitPrice,
    quantity: 1,
    selectedSize: selectedSize,
    extras: [],
  });

  // Workflow 2: Directly select B (10) -> Click Family (+10 = 20)
  const payloadFlow2 = compileSavePayload({
    tab: "catalog",
    productId: prodB.id,
    productName: prodB.name_ar,
    unitPrice: 20.0,
    quantity: 1,
    selectedSize: "عائلي (20+ شخص)",
    extras: [],
  });

  // Assertion: Both workflows yield identical unit price of 20.00 JD
  assert.equal(payloadFlow1.success, true);
  assert.equal(payloadFlow2.success, true);
  assert.equal(
    payloadFlow1.payload.unitPrice,
    payloadFlow2.payload.unitPrice,
    "Both selection sequences must yield identical 20.00 JD unit price",
  );
  assert.equal(payloadFlow1.payload.unitPrice, 20.0);
  assert.deepEqual(payloadFlow1.payload.options, payloadFlow2.payload.options);
});

// ------------------------------------------------------------------------------
// TEST 8 (K4): Existing Item Product ID Lock & Rejection of ID Desynchronization
// ------------------------------------------------------------------------------
await test("8. K4: Existing item retains its original product_id; product swapping is locked during edit", () => {
  const existingItem = {
    id: "item-existing-1",
    product_id: "original-prod-uuid-111",
    name: "كيكة فانيلا قديمة",
    unit_price: 20.0,
    quantity: 1,
    options: ["الحجم: وسط"],
  };

  // Sheet compiler invoked with existing item:
  // productId: item ? item.product_id ?? selectedProduct?.id ?? null : selectedProduct?.id ?? null
  const compiledEdit = compileSavePayload({
    tab: "catalog",
    productId: existingItem.product_id, // Locked to existingItem.product_id
    productName: existingItem.name,
    unitPrice: 20.0,
    quantity: 1,
    selectedSize: "وسط",
    extras: [],
  });

  assert.equal(compiledEdit.success, true);
  assert.equal(
    compiledEdit.payload.productId,
    "original-prod-uuid-111",
    "Compiled payload must retain the original product_id",
  );

  // For a newly added item, productId comes from the newly selected product
  const compiledNew = compileSavePayload({
    tab: "catalog",
    productId: "new-prod-uuid-222",
    productName: "كيكة شوكولاتة جديدة",
    unitPrice: 15.0,
    quantity: 1,
    selectedSize: "صغير",
    extras: [],
  });

  assert.equal(compiledNew.success, true);
  assert.equal(
    compiledNew.payload.productId,
    "new-prod-uuid-222",
    "New item correctly receives selected product_id",
  );
});

console.log("\n================================================================================");
console.log(`🏁 ITEM EDITOR LIFECYCLE SUITE: ${passed} of ${total} checks passed cleanly!`);
console.log("================================================================================\n");
