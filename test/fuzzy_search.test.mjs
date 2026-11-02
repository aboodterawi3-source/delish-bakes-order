// ==============================================================================
// FUSE.JS FUZZY SEARCH TEST SUITE
// Validates typo-tolerance, Arabic letter variations, and phone number partial search
// ==============================================================================

import assert from "node:assert/strict";
import { searchBakeryProducts, searchOrders } from "../src/lib/fuzzy-search.ts";

console.log("================================================================================");
console.log("🔍 FUSE.JS FUZZY SEARCH — VERIFICATION SUITE");
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

const mockProducts = [
  {
    id: "p1",
    name_ar: "كيكة الشوكولاتة البلجيكية الفاخرة",
    name_en: "Luxury Belgian Chocolate Cake",
    category: "Cakes",
    price: 28.00,
  },
  {
    id: "p2",
    name_ar: "تشيز كيك التوت البري",
    name_en: "Wild Berry Cheesecake",
    category: "Cakes",
    price: 24.00,
  },
  {
    id: "p3",
    name_ar: "كرواسون بالزبدة الفرنسية",
    name_en: "French Butter Croissant",
    category: "Bakery",
    price: 1.75,
  },
];

const mockOrders = [
  {
    id: "o1",
    order_number: "DL-1045",
    customer_name: "ريم العبداللات",
    customer_phone: "0798765432",
    status: "ready",
    total: 35.00,
  },
  {
    id: "o2",
    order_number: "DL-1046",
    customer_name: "محمد الحنيطي",
    customer_phone: "0771234567",
    status: "baking",
    total: 50.00,
  },
];

// ------------------------------------------------------------------------------
// TEST 1: Arabic Spelling Variation Tolerance (ه vs ة)
// ------------------------------------------------------------------------------
await test("1. searchBakeryProducts(): matches 'كيكه شوكلاته' to 'كيكة الشوكولاتة'", () => {
  const results = searchBakeryProducts("كيكه شوكلاته", mockProducts);
  assert.ok(results.length > 0, "Should find at least 1 match");
  assert.equal(results[0].id, "p1");
  assert.equal(results[0].name_en, "Luxury Belgian Chocolate Cake");
});

// ------------------------------------------------------------------------------
// TEST 2: English Typo Tolerance
// ------------------------------------------------------------------------------
await test("2. searchBakeryProducts(): matches 'croisant' (typo) to 'French Butter Croissant'", () => {
  const results = searchBakeryProducts("croisant", mockProducts);
  assert.ok(results.length > 0, "Should find matching product despite typo");
  assert.equal(results[0].id, "p3");
});

// ------------------------------------------------------------------------------
// TEST 3: Order Search by Phone Substring or Order Number
// ------------------------------------------------------------------------------
await test("3. searchOrders(): matches by partial phone number or DL number", () => {
  const phoneResults = searchOrders("8765432", mockOrders);
  assert.ok(phoneResults.length >= 1);
  assert.equal(phoneResults[0].order_number, "DL-1045");

  const orderNumResults = searchOrders("1046", mockOrders);
  assert.ok(orderNumResults.length >= 1);
  assert.equal(orderNumResults[0].order_number, "DL-1046");
  assert.equal(orderNumResults[0].customer_name, "محمد الحنيطي");
});

console.log("\n================================================================================");
console.log(`🏁 FUSE.JS SUITE FINISHED: ${passed} of ${total} tests passed cleanly!`);
console.log("================================================================================\n");
