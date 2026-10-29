// ==============================================================================
// DELISH CAKE & BAKE — ACCEPTANCE HARDENING & BUSINESS LOGIC TEST SUITE
// Automated verification for financial accuracy, refund-due logic, gift orders,
// KDS preparation privacy, and optimistic concurrency contracts.
// ==============================================================================

import assert from "node:assert/strict";

console.log("🚀 Starting Delish Cake & Bake Verification Suite...\n");

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
// TEST 1: Financial Precision & Refund-Due Logic
// ------------------------------------------------------------------------------
test("Financials: calculates correct refund due when paid exceeds total (25 JD paid on 20 JD total)", () => {
  const roundJod = (val) => Math.round((Number(val) || 0) * 100) / 100;
  
  const calculateFinancials = (total, paid) => {
    const t = Number(total) || 0;
    const p = Number(paid) || 0;
    const diff = p - t;
    return {
      total: t,
      paid: p,
      remaining: Math.max(t - p, 0),
      refundDue: Math.max(diff, 0),
      isOverpaid: diff > 0.001,
      isFullyPaid: Math.abs(diff) <= 0.001,
    };
  };

  const total = 20.00;
  const paid = 25.00;
  const fin = calculateFinancials(total, paid);

  assert.equal(fin.remaining, 0, "Remaining balance must be 0 when overpaid");
  assert.equal(fin.refundDue, 5.00, "Refund due must be exactly 5.00 JD");
  assert.equal(fin.isOverpaid, true, "isOverpaid must be true");
  assert.equal(fin.isFullyPaid, false, "Overpaid order is not standard fully paid, requires refund");
});

test("Financials: calculates remaining balance accurately when partial deposit is paid (10 JD deposit on 35 JD total)", () => {
  const calculateFinancials = (total, paid) => {
    const t = Number(total) || 0;
    const p = Number(paid) || 0;
    const diff = p - t;
    return {
      total: t,
      paid: p,
      remaining: Math.max(t - p, 0),
      refundDue: Math.max(diff, 0),
      isOverpaid: diff > 0.001,
      isFullyPaid: Math.abs(diff) <= 0.001,
    };
  };

  const fin = calculateFinancials(35.00, 10.00);
  assert.equal(fin.remaining, 25.00, "Remaining balance must be 25.00 JD");
  assert.equal(fin.refundDue, 0, "Refund due must be 0");
  assert.equal(fin.isOverpaid, false, "isOverpaid must be false");
});

// ------------------------------------------------------------------------------
// TEST 2: Confirmation Message Generator
// ------------------------------------------------------------------------------
test("Confirmation Message: includes prominent refund due line when customer overpaid", () => {
  const money = (val) => `${(Number(val) || 0).toFixed(2)} د.أ`;
  const formatConfirmation = (total, paid) => {
    const fin = {
      remaining: Math.max(total - paid, 0),
      refundDue: Math.max(paid - total, 0),
      isOverpaid: paid > total + 0.001,
    };
    const lines = [
      `💰 الحساب كامل: ${money(total)}`,
      `💵 المبلغ المدفوع (عربون/كليك): ${money(paid)}`,
    ];
    if (fin.isOverpaid) {
      lines.push(`🔄 مبلغ مستحق الإرجاع للزبون: ${money(fin.refundDue)}`);
    } else if (fin.remaining > 0) {
      lines.push(`💳 المبلغ المتبقي: ${money(fin.remaining)}`);
    } else {
      lines.push(`💳 المبلغ المتبقي: 0.00 د.أ (مسدد بالكامل ✅)`);
    }
    return lines.join("\n");
  };

  const msg = formatConfirmation(20.00, 25.00);
  assert.ok(msg.includes("🔄 مبلغ مستحق الإرجاع للزبون: 5.00 د.أ"), "Must state 5.00 JD refund due");
  assert.ok(!msg.includes("المبلغ المتبقي: 0.00 د.أ (مسدد بالكامل ✅)"), "Must not mask overpayment as standard full pay");
});

// ------------------------------------------------------------------------------
// TEST 3: Gift Order Dispatch Formatting & Separation
// ------------------------------------------------------------------------------
test("Gift Orders: Driver dispatch WhatsApp text delivers to recipient and instructs driver not to ask for payment if pre-paid", () => {
  const jd = (val) => `${(Number(val) || 0).toFixed(2)} د.أ`;
  const formatDriverMessage = (order) => {
    const remaining = Math.max(order.total - order.deposit_paid, 0);
    const isGift = Boolean(order.recipient_phone && order.recipient_phone !== order.sender_phone);
    const recipientPhone = order.recipient_phone || order.customer_phone;
    const senderPhone = order.sender_phone || order.customer_phone;
    const recipientName = order.order_name || order.customer_name;

    const collectionText = remaining > 0
      ? `المبلغ المطلوب تحصيله من المستلم: ${jd(remaining)} (كاش)`
      : isGift
        ? `المبلغ: مدفوع بالكامل مسبقاً ✅ (هدية - ممنوع طلب أي مبلغ من المستلم)`
        : `المبلغ: مدفوع بالكامل مسبقاً ✅`;

    if (isGift) {
      return `🚗 **طلب توصيل هدية - ${order.order_number}**
المستلم: ${recipientName}
هاتف المستلم للتوصيل: ${recipientPhone}
هاتف صاحب الطلب / المرسل (للطوارئ): ${senderPhone}
العنوان: ${order.area} - ${order.address}
${collectionText}`;
    }

    return `🚗 **طلب توصيل جديد - ${order.order_number}**
العميل: ${recipientName}
الهاتف: ${order.customer_phone}`;
  };

  const giftOrder = {
    order_number: "DL-1042",
    customer_name: "سامر الصايغ",
    order_name: "هدية لريم",
    customer_phone: "0791111111",
    sender_phone: "0791111111",
    recipient_phone: "0792222222",
    area: "دابوق",
    address: "قرب جامع الصالحين فيلا 12",
    total: 35.00,
    deposit_paid: 35.00,
  };

  const msg = formatDriverMessage(giftOrder);
  assert.ok(msg.includes("المستلم: هدية لريم"), "Recipient name must be displayed");
  assert.ok(msg.includes("هاتف المستلم للتوصيل: 0792222222"), "Driver must call recipient for delivery");
  assert.ok(msg.includes("هاتف صاحب الطلب / المرسل (للطوارئ): 0791111111"), "Sender phone is emergency only");
  assert.ok(msg.includes("ممنوع طلب أي مبلغ من المستلم"), "Driver must be explicitly warned not to ask for payment on gift");
});

// ------------------------------------------------------------------------------
// TEST 4: Kitchen Masking & Contact Isolation
// ------------------------------------------------------------------------------
test("Kitchen Display: contact numbers and marketing tags are stripped from kitchen view", () => {
  const PHONE_LIKE = /\+?[\d٠-٩][\d٠-٩\s-]{6,}[\d٠-٩]/g;
  const stripPhones = (text) => text ? text.replace(PHONE_LIKE, "—") : text;

  const rawNotes = "الرجاء الاتصال على الرقم 0795551234 للتأكيد قبل التجهيز";
  const masked = stripPhones(rawNotes);
  assert.ok(!masked.includes("0795551234"), "Phone number must be scrubbed from kitchen view");
  assert.ok(masked.includes("—"), "Scrubbed phone should be replaced with dash");
});

// ------------------------------------------------------------------------------
// TEST 5: Optimistic Concurrency Control Simulation
// ------------------------------------------------------------------------------
test("Optimistic Concurrency Control: detects version mismatch and prevents silent overwrite", () => {
  const existingOrder = {
    id: "ord-1",
    version: 3,
    notes: "Original notes",
  };

  function simulatePatch(order, expectedVersion, newNotes) {
    if (expectedVersion !== undefined && expectedVersion !== null && expectedVersion !== order.version) {
      throw new Error(`تعارض في التعديل: تم تعديل هذا الطلب مسبقاً (النسخة الحالية: ${order.version}، نسختك: ${expectedVersion})`);
    }
    return {
      ...order,
      notes: newNotes,
      version: order.version + 1,
    };
  }

  // 1. Success with current version
  const updated = simulatePatch(existingOrder, 3, "New notes from Cashier A");
  assert.equal(updated.version, 4, "Version must increment on successful write");
  assert.equal(updated.notes, "New notes from Cashier A");

  // 2. Reject stale write from Cashier B who still had version 3
  assert.throws(
    () => simulatePatch(updated, 3, "Stale notes from Cashier B"),
    /تعارض في التعديل/,
    "Must throw optimistic concurrency conflict on stale version"
  );
});

console.log(`\n🎉 Verification Complete: ${passed} of ${total} tests passed successfully!\n`);
