import assert from "node:assert/strict";
import { buildConfirmationMessage } from "../src/lib/confirmation-message.ts";

console.log("Testing delivery single-field and manual price specification...");

// Test 1: Delivery with custom decimal fee
const msg1 = buildConfirmationMessage({
  orderNumber: "DL-999",
  customerName: "Ahmad",
  customerPhone: "0791234567",
  when: "2026-11-05 16:00",
  date: "2026-11-05",
  time: "16:00",
  address: "Amman - Abdoun - Damascus St",
  area: "",
  filling: "Nutella Hazelnut",
  fulfilment: "Delivery · Amman - Abdoun - Damascus St",
  items: ["1 × Chocolate Cake"],
  price: 25,
  deliveryFee: 3.5,
  total: 28.5,
  paid: 0,
  paymentMethod: "Cash on delivery",
  isGift: false,
  orderSource: "Instagram",
});

assert.ok(msg1.includes("Amman - Abdoun - Damascus St"), "Must include address");
assert.ok(msg1.includes("3.50"), "Must format decimal fee accurately");
assert.ok(!msg1.includes("Amman - Abdoun - Damascus St — Amman"), "Must not repeat address");
console.log("✅ Test 1 Passed: Decimal delivery fee accurately rendered without duplication.");

// Test 2: Delivery with integer fee
const msg2 = buildConfirmationMessage({
  orderNumber: "DL-1000",
  customerName: "Sara",
  customerPhone: "0798765432",
  when: "2026-11-05 16:00",
  date: "2026-11-05",
  time: "16:00",
  address: "Khalda - Sugar Circle",
  area: "Khalda - Sugar Circle", // Even if area == address
  filling: "Vanilla Strawberry",
  fulfilment: "Delivery · Khalda - Sugar Circle",
  items: ["1 × Vanilla Cake"],
  price: 20,
  deliveryFee: 3,
  total: 23,
  paid: 0,
  paymentMethod: "Cash on delivery",
  isGift: false,
  orderSource: "WhatsApp",
});

assert.ok(msg2.includes("Khalda - Sugar Circle"), "Must include address");
assert.ok(msg2.includes("3 دنانير"), "Must format integer fee cleanly");
assert.ok(!msg2.includes("Khalda - Sugar Circle — Khalda"), "Must deduplicate identical area/address");
console.log("✅ Test 2 Passed: Integer delivery fee and identical area/address deduplication verified.");

// Test 3: Pickup (no delivery lines)
const msg3 = buildConfirmationMessage({
  orderNumber: "DL-1001",
  customerName: "Rami",
  customerPhone: "0795555555",
  when: "2026-11-05 16:00",
  date: "2026-11-05",
  time: "16:00",
  address: "",
  area: "",
  filling: "Salted Caramel",
  fulfilment: "Pickup from shop",
  items: ["1 × Caramel Cake"],
  price: 22,
  deliveryFee: 0,
  total: 22,
  paid: 22,
  paymentMethod: "CliQ Full",
  isGift: false,
  orderSource: "Store",
});

assert.ok(msg3.includes("استلام من المحل"), "Must show pickup");
assert.ok(!msg3.includes("📦 التوصيل"), "Must not include delivery fee line for pickup");
console.log("✅ Test 3 Passed: Pickup orders correctly omit delivery details.");

console.log("\n🎉 ALL DELIVERY FEATURE TESTS PASSED SUCCESSFULLY!");
