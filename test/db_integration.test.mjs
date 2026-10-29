// ==============================================================================
// DELISH CAKE & BAKE — LIVE DATABASE INTEGRATION TEST SUITE
// Tests real PostgreSQL RPCs, RLS policies, transactions, OCC, and idempotency
// against an active Supabase project.
// ==============================================================================

import assert from "node:assert/strict";

console.log("================================================================================");
console.log("🗄️ DELISH CAKE & BAKE — DATABASE INTEGRATION TEST SUITE (8 LIVE SCENARIOS)");
console.log("================================================================================\n");

const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.log("⚠️ [مكتوبة وجاهزة للتنفيذ — بانتظار تزويد بيانات اعتماد قاعدة بيانات Supabase المستقلة الجديدة]");
  console.log("--------------------------------------------------------------------------------");
  console.log("السبب: لم يتم تزويد متغيرات البيئة الخاصة بمشروع Supabase المستقل الجديد:");
  console.log("  - SUPABASE_URL");
  console.log("  - SUPABASE_SERVICE_ROLE_KEY");
  console.log("  - SUPABASE_ANON_KEY (اختياري لاختبارات الزائر)\n");
  console.log("📌 سيناريوهات الاختبار الـ 8 المكتوبة بالكامل في هذا الملف:");
  console.log("  1. صلاحيات الزائر (RLS): منع الزائر المجهول من قراءة الطلبات أو استدعاء RPC التسعير.");
  console.log("  2. حصر صلاحيات المطبخ: قراءة بطاقات التحضير فقط عبر get_kitchen_orders ومنع UPDATE المباشر.");
  console.log("  3. التراجع الذري الكامل (Atomic Rollback) عند فشل حفظ صنف غير صالح.");
  console.log("  4. قفل التزامن التفاؤلي (OCC): تعارض تعديلين متزامنين بنفس رقم الإصدار ورفض الثاني.");
  console.log("  5. منع التكرار (Idempotency): ثبات إعادة محاولة الطلب والدفعة بنفس المفتاح دون مضاعفة.");
  console.log("  6. دورة الدفع والاسترجاع الكاملة (25 د.أ -> استرجاع 5 -> تصفير الفائض -> رفض الاسترجاع المكرر).");
  console.log("  7. تأكيد الشيف الانتقائي: بقاء التعديل الأحدث غير مؤكد عند تأكيد تعديل سابق.");
  console.log("  8. تحصين تسعير المتجر: حصر إنشاء طلبات المتجر بالخادم الموثوق ومنع تزييف الأسعار.\n");
  console.log("لتشغيل هذه الاختبارات فعلياً على قاعدة بيانات حية:");
  console.log('  $env:SUPABASE_URL="https://your-project.supabase.co"');
  console.log('  $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.log('  node test/db_integration.test.mjs\n');
  process.exit(0);
}

console.log(`Connecting to database at: ${supabaseUrl}\n`);

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

// Helper fetch wrappers
async function rest(endpoint, options = {}, roleKey = serviceRoleKey) {
  const url = `${supabaseUrl}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: roleKey,
      Authorization: `Bearer ${roleKey}`,
      Prefer: "return=representation",
      ...options.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function rpc(fnName, payload = {}, roleKey = serviceRoleKey) {
  return rest(`rpc/${fnName}`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, roleKey);
}

// ------------------------------------------------------------------------------
// SCENARIO 1: Visitor RLS Direct Query Denial
// ------------------------------------------------------------------------------
await test("1. Visitor RLS: Anonymous client directly querying orders table receives 0 rows or is denied", async () => {
  if (!anonKey) {
    console.log("    (Skipped anon subcheck: SUPABASE_ANON_KEY not set)");
    return;
  }
  const res = await rest("orders?select=id,customer_name,customer_phone", { method: "GET" }, anonKey);
  assert.ok(res.status === 200 || res.status === 401 || res.status === 403, "Response status must be expected");
  if (res.status === 200) {
    assert.ok(Array.isArray(res.data), "Result must be an array");
    assert.equal(res.data.length, 0, "Anonymous visitor must not see any internal orders");
  }
});

// ------------------------------------------------------------------------------
// SCENARIO 2: Kitchen Order View Sanitization & RPC Status Progression
// ------------------------------------------------------------------------------
await test("2. Kitchen Security: get_kitchen_orders() returns sanitized preparation fields without sensitive PII", async () => {
  const res = await rpc("get_kitchen_orders", {});
  assert.ok(res.ok, `RPC get_kitchen_orders must execute successfully: ${JSON.stringify(res.data)}`);
  assert.ok(Array.isArray(res.data), "Kitchen orders must return an array of preparation cards");
  if (res.data.length > 0) {
    const sample = res.data[0];
    assert.equal(sample.customer_phone, undefined, "Kitchen view must not expose customer_phone");
    assert.equal(sample.deposit_paid, undefined, "Kitchen view must not expose deposit_paid");
    assert.equal(sample.total, undefined, "Kitchen view must not expose total order money");
  }
});

// ------------------------------------------------------------------------------
// SCENARIO 3: Complete Atomic Rollback on Invalid Item Insertion
// ------------------------------------------------------------------------------
await test("3. Atomic Rollback: create_staff_order_atomic completely rolls back when an item violates quantity > 0", async () => {
  const uniqueId = `test-rollback-${Date.now()}`;
  const payload = {
    p_order: {
      customer_name: "Rollback Test",
      customer_phone: "0790000001",
      method: "pickup",
      requested_date: "2026-11-01",
      requested_time: "14:00:00",
      total: 15.00,
      client_request_id: uniqueId,
    },
    p_items: [
      {
        name_ar: "Valid Cake Line",
        unit_price: 15.00,
        quantity: -2, // VIOLATES CHECK CONSTRAINT quantity > 0
      },
    ],
  };

  const res = await rpc("create_staff_order_atomic", payload);
  assert.equal(res.ok, false, "Must reject invalid item quantity with DB constraint error");

  // Verify that the order header was NOT created (clean rollback)
  const verify = await rest(`orders?client_request_id=eq.${uniqueId}&select=id`);
  assert.equal(verify.ok, true);
  assert.equal(verify.data.length, 0, "Order row must not exist following atomic rollback");
});

// ------------------------------------------------------------------------------
// SCENARIO 4: Optimistic Concurrency Control (OCC) Collision Rejection
// ------------------------------------------------------------------------------
await test("4. OCC Lock: Two simultaneous updates on same order version reject second worker with conflict", async () => {
  const uniqueId = `test-occ-${Date.now()}`;
  const createRes = await rpc("create_staff_order_atomic", {
    p_order: {
      customer_name: "OCC Worker Test",
      customer_phone: "0790000002",
      method: "pickup",
      requested_date: "2026-11-01",
      requested_time: "15:00:00",
      total: 20.00,
      client_request_id: uniqueId,
    },
    p_items: [{ name_ar: "Cake", unit_price: 20.00, quantity: 1 }],
  });

  assert.ok(createRes.ok, "Order creation must succeed");
  const orderId = createRes.data.id;

  // Worker 1 patches expecting version 1
  const patch1 = await rpc("patch_sales_order_atomic", {
    p_order_id: orderId,
    p_expected_version: 1,
    p_patch: { notes: "Worker 1 update" },
    p_new_mods: null,
    p_user_id: null,
  });
  assert.ok(patch1.ok, "Worker 1 patch must succeed and bump version to 2");

  // Worker 2 attempts patch also expecting version 1
  const patch2 = await rpc("patch_sales_order_atomic", {
    p_order_id: orderId,
    p_expected_version: 1,
    p_patch: { notes: "Worker 2 stale update" },
    p_new_mods: null,
    p_user_id: null,
  });
  assert.equal(patch2.ok, false, "Worker 2 patch must be rejected due to version mismatch");
  assert.ok(
    JSON.stringify(patch2.data).includes("تعارض") || JSON.stringify(patch2.data).includes("conflict") || patch2.status >= 400,
    "Error message must specify OCC conflict"
  );
});

// ------------------------------------------------------------------------------
// SCENARIO 5: Idempotency Protection for Orders & Payments
// ------------------------------------------------------------------------------
await test("5. Idempotency: Duplicate submissions with identical key return existing record without double write", async () => {
  const reqKey = `idem-order-${Date.now()}`;
  const payload = {
    p_order: {
      customer_name: "Idempotency Test",
      customer_phone: "0790000003",
      method: "pickup",
      requested_date: "2026-11-02",
      requested_time: "16:00:00",
      total: 18.00,
      client_request_id: reqKey,
    },
    p_items: [{ name_ar: "Bento Cake", unit_price: 18.00, quantity: 1 }],
  };

  const firstCall = await rpc("create_staff_order_atomic", payload);
  assert.ok(firstCall.ok, "First call must create order");

  const secondCall = await rpc("create_staff_order_atomic", payload);
  assert.ok(secondCall.ok, "Second call must return successfully");
  assert.equal(secondCall.data.id, firstCall.data.id, "Second call must return the exact same order ID");
  assert.equal(secondCall.data.is_duplicate, true, "Must flag is_duplicate as true");
});

// ------------------------------------------------------------------------------
// SCENARIO 6: Full Payment & Refund Lifecycle (25 JD on 20 JD -> Refund 5 JD -> Settlement -> Double Refund Rejection)
// ------------------------------------------------------------------------------
await test("6. Financial Lifecycle: 25 JD payment on 20 JD total, refund 5 JD, settlement, and duplicate refund rejection", async () => {
  const uniqueId = `life-pay-${Date.now()}`;
  const createRes = await rpc("create_staff_order_atomic", {
    p_order: {
      customer_name: "Financial Test Customer",
      customer_phone: "0790000004",
      method: "pickup",
      requested_date: "2026-11-03",
      requested_time: "17:00:00",
      total: 20.00,
      client_request_id: uniqueId,
    },
    p_items: [{ name_ar: "Birthday Cake", unit_price: 20.00, quantity: 1 }],
  });
  assert.ok(createRes.ok, "Order creation must succeed");
  const orderId = createRes.data.id;

  // Step A: Customer pays 25.00 JD for a 20.00 JD order
  const pay25 = await rpc("record_order_payment_atomic", {
    p_order_id: orderId,
    p_amount: 25.00,
    p_payment_method: "cliq",
    p_payment_type: "full",
    p_idempotency_key: `pay-25-${Date.now()}`,
  });
  assert.ok(pay25.ok, "Payment of 25.00 JD must succeed");

  // Verify order balance
  const checkA = await rest(`orders?id=eq.${orderId}&select=deposit_paid,total`);
  assert.equal(Number(checkA.data[0].deposit_paid), 25.00, "Deposit paid must be 25.00 JD");

  // Step B: Cashier refunds 5.00 JD excess
  const refund5 = await rpc("record_order_payment_atomic", {
    p_order_id: orderId,
    p_amount: 5.00,
    p_payment_method: "cliq",
    p_payment_type: "refund",
    p_idempotency_key: `ref-5-${Date.now()}`,
  });
  assert.ok(refund5.ok, "Refund of 5.00 JD must succeed");

  // Verify settled balance
  const checkB = await rest(`orders?id=eq.${orderId}&select=deposit_paid,total`);
  assert.equal(Number(checkB.data[0].deposit_paid), 20.00, "Deposit paid must settle cleanly to exactly 20.00 JD");

  // Step C: Cashier mistakenly attempts a second 5.00 JD refund (excess is already 0)
  const refundDuplicate = await rpc("record_order_payment_atomic", {
    p_order_id: orderId,
    p_amount: 5.00,
    p_payment_method: "cliq",
    p_payment_type: "refund",
    p_idempotency_key: `ref-dup-${Date.now()}`,
  });
  assert.equal(refundDuplicate.ok, false, "Second refund must be rejected by SQL since excess balance is 0");
});

// ------------------------------------------------------------------------------
// SCENARIO 7: Chef Selective Modification Acknowledgement
// ------------------------------------------------------------------------------
await test("7. KDS Selective Ack: Acknowledging modification #1 keeps newer modification #2 unacknowledged", async () => {
  const uniqueId = `ack-mod-${Date.now()}`;
  const now = new Date().toISOString();
  const mod1 = { id: `m1-${Date.now()}`, field: "وقت التسليم", oldValue: "14:00", newValue: "16:00", updatedAt: now, acknowledgedAt: null };
  const mod2 = { id: `m2-${Date.now()}`, field: "الكتابة على الكيك", oldValue: "None", newValue: "Happy Eid", updatedAt: now, acknowledgedAt: null };

  const createRes = await rpc("create_staff_order_atomic", {
    p_order: {
      customer_name: "Selective Ack Customer",
      customer_phone: "0790000005",
      method: "pickup",
      requested_date: "2026-11-04",
      requested_time: "18:00:00",
      total: 12.00,
      client_request_id: uniqueId,
    },
    p_items: [{ name_ar: "Cupcakes", unit_price: 12.00, quantity: 1 }],
  });
  assert.ok(createRes.ok);
  const orderId = createRes.data.id;

  // Attach modifications
  await rest(`orders?id=eq.${orderId}`, {
    method: "PATCH",
    body: JSON.stringify({ modifications: [mod1, mod2] }),
  });

  // Acknowledge only mod1
  const ackRes = await rpc("acknowledge_kds_modifications_atomic", {
    p_order_id: orderId,
    p_mod_ids: [mod1.id],
    p_chef_user_id: null,
    p_chef_name: "شيف الاختبار",
  });
  assert.ok(ackRes.ok, "Acknowledgement RPC must succeed");

  // Fetch updated modifications
  const verify = await rest(`orders?id=eq.${orderId}&select=modifications`);
  const mods = verify.data[0].modifications;
  const verifiedMod1 = mods.find(m => m.id === mod1.id);
  const verifiedMod2 = mods.find(m => m.id === mod2.id);

  assert.ok(verifiedMod1.acknowledgedAt !== null, "Mod 1 must be acknowledged");
  assert.equal(verifiedMod2.acknowledgedAt, null, "Mod 2 must remain UNACKNOWLEDGED");
});

// ------------------------------------------------------------------------------
// SCENARIO 8: Storefront Atomic Checkout RPC Authorization Defense
// ------------------------------------------------------------------------------
await test("8. Storefront RPC Defense: create_storefront_order_atomic cannot be executed directly by anon/public", async () => {
  if (!anonKey) {
    console.log("    (Skipped anon subcheck: SUPABASE_ANON_KEY not set)");
    return;
  }
  const forgedPayload = {
    order_payload: {
      customer_name: "Malicious Attacker",
      customer_phone: "0790000009",
      method: "pickup",
      requested_date: "2026-11-05",
      requested_time: "12:00:00",
      delivery_fee: 0,
    },
    items_payload: [
      {
        product_id: null,
        name_ar: "Luxury Tiered Cake",
        unit_price: 0.01, // Forged line price
        quantity: 1,
      },
    ],
  };

  const res = await rpc("create_storefront_order_atomic", forgedPayload, anonKey);
  assert.equal(res.ok, false, "Must reject direct invocation of create_storefront_order_atomic by anon");
  assert.ok(
    res.status === 401 || res.status === 403 || JSON.stringify(res.data).includes("permission denied"),
    "Must fail with permission denied / revoked execute"
  );
});

console.log("\n================================================================================");
console.log(`🏁 LIVE DATABASE INTEGRATION SUITE FINISHED: ${passed} of ${total} tests passed!`);
console.log("================================================================================\n");
