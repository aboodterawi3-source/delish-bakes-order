// ==============================================================================
// DELISH CAKE & BAKE — SCHEDULED SLOTS & LEAD TIME ENGINE TEST SUITE
// Validates slot generation (1h pickup vs 2h delivery), lead time enforcement,
// capacity limits, and KDS urgency calculations.
// ==============================================================================

import assert from "node:assert/strict";
import {
  generateAvailableSlots,
  calculateRequiredLeadTime,
  getKdsUrgency,
  getJordanDateTime,
  DEFAULT_MAX_SLOT_CAPACITY,
} from "../src/lib/delivery-slots.ts";

console.log("================================================================================");
console.log("🕒 SCHEDULED DELIVERY & PICKUP SLOTS ENGINE — TDD TEST SUITE");
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
// TEST 1: Pickup Slots (1-hour windows from 10:00 to 23:00)
// ------------------------------------------------------------------------------
await test("1. Pickup slots generate 1-hour windows between 10:00 and 23:00", () => {
  const tomorrow = "2026-11-07";
  const slots = generateAvailableSlots({
    date: tomorrow,
    method: "pickup",
    currentJordanTime: "2026-11-06T12:00:00",
  });

  assert.ok(slots.length >= 12, "Should generate at least 12 one-hour slots");
  const firstSlot = slots[0];
  assert.equal(firstSlot.startTime, "10:00");
  assert.equal(firstSlot.endTime, "11:00");
  assert.equal(firstSlot.method, "pickup");
  assert.equal(firstSlot.isAvailable, true);

  const lastSlot = slots[slots.length - 1];
  assert.equal(lastSlot.startTime, "22:00");
  assert.equal(lastSlot.endTime, "23:00");
});

// ------------------------------------------------------------------------------
// TEST 2: Delivery Slots (2-hour windows to account for Amman traffic)
// ------------------------------------------------------------------------------
await test("2. Delivery slots generate 2-hour windows accommodating Amman traffic", () => {
  const tomorrow = "2026-11-07";
  const slots = generateAvailableSlots({
    date: tomorrow,
    method: "delivery",
    currentJordanTime: "2026-11-06T12:00:00",
  });

  assert.ok(slots.length >= 6, "Should generate multiple two-hour slots");
  const firstSlot = slots[0];
  assert.equal(firstSlot.startTime, "10:00");
  assert.equal(firstSlot.endTime, "12:00");
  assert.equal(firstSlot.method, "delivery");
  assert.ok(firstSlot.labelAr.includes("10:00") && firstSlot.labelAr.includes("12:00"));
});

// ------------------------------------------------------------------------------
// TEST 3: Lead Time Calculation (Cakes = 4h, Pastries/Ready = 1h)
// ------------------------------------------------------------------------------
await test("3. Lead time calculation assigns 4h for celebration cakes and 1h for ready items", () => {
  const cakeItems = [
    { name_ar: "كيكة فستق حلبي ملكية", options_ar: ["الحجم: كبير", "الحشوة: كراميل"] },
    { name_ar: "كرواسون زبدة" },
  ];
  assert.equal(calculateRequiredLeadTime(cakeItems), 4, "Custom cake requires 4 hours lead time");

  const pastryItems = [
    { name_ar: "كرواسون لوز فرنسي" },
    { name_ar: "علبة ماكرون باريسي" },
  ];
  assert.equal(calculateRequiredLeadTime(pastryItems), 1, "Pastries require 1 hour lead time");
});

// ------------------------------------------------------------------------------
// TEST 4: Lead Time Slot Filtering for Same-Day Orders
// ------------------------------------------------------------------------------
await test("4. Lead time filters out today's slots within the preparation window", () => {
  const today = "2026-11-06";
  // Simulated current time: 12:00 PM Jordan time
  const currentSimulatedTime = "2026-11-06T12:00:00";
  const slots = generateAvailableSlots({
    date: today,
    method: "pickup",
    leadTimeHours: 4, // 12:00 + 4 hours = earliest available is 16:00
    currentJordanTime: currentSimulatedTime,
  });

  const slot11 = slots.find((s) => s.startTime === "11:00");
  assert.ok(slot11, "Slot 11:00 should exist");
  assert.equal(slot11.isAvailable, false, "11:00 is in the past");
  assert.equal(slot11.reasonUnavailable, "past");

  const slot14 = slots.find((s) => s.startTime === "14:00");
  assert.ok(slot14, "Slot 14:00 should exist");
  assert.equal(slot14.isAvailable, false, "14:00 is within 4-hour lead time");
  assert.equal(slot14.reasonUnavailable, "lead_time");

  const slot16 = slots.find((s) => s.startTime === "16:00");
  assert.ok(slot16, "Slot 16:00 should exist");
  assert.equal(slot16.isAvailable, true, "16:00 is after 4-hour lead time");
});

// ------------------------------------------------------------------------------
// TEST 5: Slot Capacity Limit & Sold Out Enforcement
// ------------------------------------------------------------------------------
await test("5. Slot capacity limit marks slot as unavailable when bookedCount >= maxCapacity", () => {
  const tomorrow = "2026-11-07";
  const slotBookings = {
    "pickup-16:00": 4, // Exactly reached default max capacity 4
    "pickup-17:00": 2, // 2 bookings, still 2 slots remaining
  };

  const slots = generateAvailableSlots({
    date: tomorrow,
    method: "pickup",
    slotBookings,
    maxCapacity: DEFAULT_MAX_SLOT_CAPACITY,
    currentJordanTime: "2026-11-06T12:00:00",
  });

  const slot16 = slots.find((s) => s.id === "pickup-16:00");
  assert.ok(slot16);
  assert.equal(slot16.bookedCount, 4);
  assert.equal(slot16.isAvailable, false);
  assert.equal(slot16.reasonUnavailable, "capacity");

  const slot17 = slots.find((s) => s.id === "pickup-17:00");
  assert.ok(slot17);
  assert.equal(slot17.bookedCount, 2);
  assert.equal(slot17.isAvailable, true);
});

// ------------------------------------------------------------------------------
// TEST 6: KDS Urgency Indicator (Green > 2h, Yellow 1-2h, Red < 1h / Overdue)
// ------------------------------------------------------------------------------
await test("6. KDS urgency accurately evaluates deadline proximity for kitchen tickets", () => {
  const now = new Date("2026-11-06T14:00:00");

  // Order due at 17:00 (3 hours away) -> normal / green
  const farOrder = getKdsUrgency("2026-11-06", "17:00:00", now);
  assert.equal(farOrder.status, "normal");
  assert.equal(farOrder.color, "emerald");

  // Order due at 15:30 (90 min away) -> warning / amber
  const midOrder = getKdsUrgency("2026-11-06", "15:30:00", now);
  assert.equal(midOrder.status, "warning");
  assert.equal(midOrder.color, "amber");

  // Order due at 14:30 (30 min away) -> critical / red
  const urgentOrder = getKdsUrgency("2026-11-06", "14:30:00", now);
  assert.equal(urgentOrder.status, "critical");
  assert.equal(urgentOrder.color, "rose");

  // Order due at 13:45 (15 min overdue) -> critical / red
  const lateOrder = getKdsUrgency("2026-11-06", "13:45:00", now);
  assert.equal(lateOrder.status, "critical");
  assert.ok(lateOrder.minutesRemaining < 0);
});

// ------------------------------------------------------------------------------
// TEST 7: Asia/Amman Timezone & Clock Invariance (UTC vs Local Clock)
// ------------------------------------------------------------------------------
await test("7. getJordanDateTime accurately converts UTC instants to Asia/Amman without clock skew", () => {
  // 21:30 UTC on Nov 5 = 00:30 on Nov 6 in Amman (UTC+3)
  const utcInstant = new Date("2026-11-05T21:30:00Z");
  const jordanTime = getJordanDateTime(utcInstant);
  assert.equal(jordanTime.dateStr, "2026-11-06", "Date rolls over to next day in Amman");
  assert.equal(jordanTime.hour, 0, "Hour is 00 (midnight in Amman)");
  assert.equal(jordanTime.minute, 30, "Minute is 30");
});

console.log("\n================================================================================");
console.log(`🏁 SLOTS ENGINE SUITE: ${passed} of ${total} tests passed cleanly!`);
console.log("================================================================================\n");
