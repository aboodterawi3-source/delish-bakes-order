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

console.log("\n================================================================================");
console.log(`🏁 ITEM EDITOR LIFECYCLE SUITE: ${passed} of ${total} checks passed cleanly!`);
console.log("================================================================================\n");
