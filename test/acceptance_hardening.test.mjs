// ==============================================================================
// DELISH CAKE & BAKE — ACCEPTANCE HARDENING & BUSINESS LOGIC TEST SUITE
// Automated verification calling actual project code units directly:
// - calculateFinancials & buildConfirmationMessage (src/lib/confirmation-message.ts)
// - assertRole (src/lib/role-guard.ts)
// - normalizeUsername & usernameToEmail (src/lib/username.ts)
// ==============================================================================

import assert from "node:assert/strict";
import { calculateFinancials, buildConfirmationMessage } from "../src/lib/confirmation-message.ts";
import { assertRole } from "../src/lib/role-guard.ts";
import { normalizeUsername, usernameToEmail, emailToUsername } from "../src/lib/username.ts";

console.log("================================================================================");
console.log("🧪 DELISH CAKE & BAKE — ACCEPTANCE TEST SUITE (DIRECT CODE UNIT VERIFICATION)");
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
// TEST 1: Financial Precision & Refund-Due Logic via calculateFinancials()
// ------------------------------------------------------------------------------
await test("1. calculateFinancials(): correctly computes refund due when paid exceeds total (25 JD on 20 JD)", () => {
  const fin = calculateFinancials(20.00, 25.00);

  assert.equal(fin.total, 20.00);
  assert.equal(fin.paid, 25.00);
  assert.equal(fin.remaining, 0, "Remaining balance must be 0 when overpaid");
  assert.equal(fin.refundDue, 5.00, "Refund due must be exactly 5.00 JD");
  assert.equal(fin.isOverpaid, true, "isOverpaid must be true");
  assert.equal(fin.isFullyPaid, false, "Overpaid order requires refund action before settling as standard fully paid");
});

await test("2. calculateFinancials(): partial deposit (10 JD on 35 JD) leaves 25 JD remaining and 0 refund due", () => {
  const fin = calculateFinancials(35.00, 10.00);

  assert.equal(fin.remaining, 25.00, "Remaining balance must be 25.00 JD");
  assert.equal(fin.refundDue, 0, "Refund due must be 0");
  assert.equal(fin.isOverpaid, false, "isOverpaid must be false");
  assert.equal(fin.isFullyPaid, false, "Partially paid order is not fully paid");
});

await test("3. calculateFinancials(): exact payment (30 JD on 30 JD) settles fully with 0 balance and 0 refund due", () => {
  const fin = calculateFinancials(30.00, 30.00);

  assert.equal(fin.remaining, 0);
  assert.equal(fin.refundDue, 0);
  assert.equal(fin.isOverpaid, false);
  assert.equal(fin.isFullyPaid, true);
});

// ------------------------------------------------------------------------------
// TEST 2: Confirmation Message Generator via buildConfirmationMessage()
// ------------------------------------------------------------------------------
await test("4. buildConfirmationMessage(): includes prominent refund-due line when customer overpays", () => {
  const msg = buildConfirmationMessage({
    orderNumber: "DL-1040",
    customerName: "فرح حداد",
    when: "اليوم 05:00 م",
    fulfilment: "استلام من المحل",
    items: ["كيكة الشوكولاتة والكراميل الفاخرة"],
    cakeWriting: "Happy Birthday",
    cardWriting: "",
    notes: "",
    price: 20.00,
    deliveryFee: 0,
    total: 20.00,
    paid: 25.00,
    paymentMethod: "cliq",
  });

  assert.ok(
    msg.includes("🔄 مبلغ مستحق الإرجاع للزبون: 5.00 د.أ") || msg.includes("مستحق الإرجاع"),
    "WhatsApp message must explicitly declare the 5.00 JD refund due"
  );
  assert.ok(
    !msg.includes("المبلغ المتبقي: 0.00 د.أ (مسدد بالكامل ✅)"),
    "Must not mask an overpayment as regular full settlement without refund notice"
  );
});

// ------------------------------------------------------------------------------
// TEST 3: Role Guard Logic via assertRole()
// ------------------------------------------------------------------------------
await test("5. assertRole(): validates allowed roles and strictly rejects unauthorized access", async () => {
  const mockKitchenContext = {
    userId: "user-kitchen-uuid",
    supabase: {
      from: (table) => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [{ role: "kitchen" }], error: null }),
        }),
      }),
    },
  };

  // Kitchen attempting sales role action
  await assert.rejects(
    () => assertRole(mockKitchenContext, ["sales", "admin"]),
    /غير مصرّح · Not authorised/,
    "Kitchen role must be rejected from sales actions"
  );

  // Kitchen attempting kitchen role action
  await assert.doesNotReject(
    () => assertRole(mockKitchenContext, ["kitchen", "admin"]),
    "Kitchen role must be accepted for kitchen actions"
  );
});

// ------------------------------------------------------------------------------
// TEST 4: Staff Username & Email Normalization via usernameToEmail()
// ------------------------------------------------------------------------------
await test("6. usernameToEmail(): normalizes staff name to internal delish.local domain for auth", () => {
  assert.equal(usernameToEmail("admin"), "admin@delish.local");
  assert.equal(usernameToEmail("Ahmad Chef"), "ahmad.chef@delish.local");
  assert.equal(emailToUsername("admin@delish.local"), "admin");
  assert.equal(emailToUsername("tariq.kds@delish.local"), "tariq.kds");
});

console.log("\n================================================================================");
console.log(`🏁 ACCEPTANCE SUITE FINISHED: ${passed} of ${total} tests passed cleanly!`);
console.log("================================================================================\n");
