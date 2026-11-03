// ==============================================================================
// DELISH CAKE & BAKE — MULTI-SESSION ORDER LIFECYCLE & INTEGRITY SUITE
// Simulates real end-to-end multi-role flow (Storefront -> Kitchen -> Sales Editor -> OCC -> Ledger)
// on exact standalone schema with PGlite in-memory database engine.
// ==============================================================================

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

console.log("================================================================================");
console.log("🏪 MULTI-SESSION ORDER LIFECYCLE & INTEGRITY TEST SUITE (E2E SIMULATION)");
console.log("================================================================================\n");

const root = process.cwd();
const schema = fs.readFileSync(path.join(root, "supabase/standalone_complete_schema.sql"), "utf8");

const ids = {
  admin: "00000000-4000-4000-8000-000000000001",
  sales: "00000000-4000-4000-8000-000000000002",
  kitchen: "00000000-4000-4000-8000-000000000003",
  colleague: "00000000-4000-4000-8000-000000000004",
  visitor: "00000000-4000-4000-8000-000000000005",
};

const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });

// Bootstrap PostgreSQL roles and schemas
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean);
  CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
  GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
`);

await db.exec(schema);

for (const [role, id] of Object.entries(ids)) {
  await db.query("INSERT INTO auth.users(id, email) VALUES($1, $2)", [id, `${role}@delish.local`]);
  if (role !== "visitor") {
    const appRole = role === "colleague" ? "sales" : role;
    await db.query("INSERT INTO public.user_roles(user_id, role) VALUES($1, $2::public.app_role)", [id, appRole]);
  }
}

async function asUser(role, uid, fn) {
  await db.exec(`SET ROLE ${role}`);
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
  }
}

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

const todayIso = new Date().toISOString().slice(0, 10);
let orderId = null;
let itemId = null;

// ------------------------------------------------------------------------------
// PHASE 1: Storefront Order Creation
// ------------------------------------------------------------------------------
await test("1. Storefront Order Creation: Customer orders cake with candles (20 JD base + 2 candles = 21 JD)", async () => {
  const orderPayload = {
    customer_name: "سارة خالد",
    customer_phone: "0791234567",
    method: "pickup",
    requested_date: todayIso,
    requested_time: "16:00:00",
    client_request_id: randomUUID(),
  };

  const itemsPayload = [
    {
      name_ar: "كيكة شوكولاتة فخمة",
      name_en: "Luxury Chocolate Cake",
      unit_price: 21.0, // Stored as base (20) + 2 candles (1.0)
      quantity: 1,
      options_ar: [
        "الحجم: وسط (10 أشخاص)",
        "الحشوة: نوتيلا بالبندق",
        "الكتابة: عيد ميلاد سعيد يا سارة 🎂",
        "🕯️ شموع أرقام (2 × 0.50 د.أ)",
      ],
      options_en: [],
      notes: "يرجى تسليمها في علبة بيضاء",
    },
  ];

  const res = await asUser("authenticated", ids.sales, async () => {
    return await db.query(
      "SELECT public.create_staff_order_atomic($1::jsonb, $2::jsonb) AS res",
      [JSON.stringify(orderPayload), JSON.stringify(itemsPayload)]
    );
  });

  const rawRes = res.rows[0].res;
  const parsed = typeof rawRes === "string" ? JSON.parse(rawRes) : rawRes;
  assert.ok(parsed.id, "Order ID must be generated");
  assert.equal(Number(parsed.total), 21.0, "Total must be 21.00 JD");
  assert.equal(Number(parsed.version), 1, "Initial version must be 1");
  orderId = parsed.id;

  const itemRows = await db.query("SELECT id, name_ar, unit_price, options_ar FROM public.order_items WHERE order_id = $1", [orderId]);
  assert.equal(itemRows.rows.length, 1);
  itemId = itemRows.rows[0].id;
  assert.equal(Number(itemRows.rows[0].unit_price), 21.0);
});

// ------------------------------------------------------------------------------
// PHASE 2: Kitchen Display Access (KDS) & Data Masking
// ------------------------------------------------------------------------------
await test("2. Kitchen Display (KDS): Kitchen reads preparation details; phone and money fields are strictly stripped", async () => {
  // 1. Kitchen calls get_kitchen_orders RPC
  const kitchenOrders = await asUser("authenticated", ids.kitchen, async () => {
    return await db.query("SELECT * FROM public.get_kitchen_orders() WHERE id = $1", [orderId]);
  });

  assert.equal(kitchenOrders.rows.length, 1, "Kitchen must see the active order");
  const kOrder = kitchenOrders.rows[0];
  assert.equal(kOrder.customer_name, "سارة خالد");
  assert.equal(kOrder.status, "new");
  assert.equal(kOrder.total, undefined, "Kitchen RPC must not return total column");

  // 2. Kitchen reads items via get_kitchen_order_items
  const kitchenItems = await asUser("authenticated", ids.kitchen, async () => {
    return await db.query("SELECT * FROM public.get_kitchen_order_items($1::uuid[])", [[orderId]]);
  });

  assert.equal(kitchenItems.rows.length, 1);
  const kItem = kitchenItems.rows[0];
  assert.equal(kItem.name_ar, "كيكة شوكولاتة فخمة");
  assert.equal(kItem.unit_price, undefined, "Kitchen item RPC must not return unit_price");

  // Verify direct SELECT on public.orders is blocked by RLS for kitchen
  const directSelect = await asUser("authenticated", ids.kitchen, async () => {
    return await db.query("SELECT id FROM public.orders WHERE id = $1", [orderId]);
  });
  assert.equal(directSelect.rows.length, 0, "Kitchen direct SELECT on orders must return 0 rows under RLS");
});

// ------------------------------------------------------------------------------
// PHASE 3: Touch Item Editor Price Preservation (J2) & State Invariance
// ------------------------------------------------------------------------------
await test("3. Touch Item Editor (J2): Opening item at 21 JD and saving twice without changes stays 21 JD", async () => {
  // Simulate TouchItemEditorSheet opening:
  // Item stored at 21.00 JD with 2 candles (1.00 JD extras)
  const currentItem = (await db.query("SELECT * FROM public.order_items WHERE id = $1", [itemId])).rows[0];
  const unitPriceFromDb = Number(currentItem.unit_price); // 21.00

  // Deduct parsed extras: 2 candles * 0.50 = 1.00 JD
  const parsedExtrasTotal = 1.00;
  const basePrice = unitPriceFromDb - parsedExtrasTotal; // 20.00 JD

  // Save 1: without changing anything -> finalUnitPrice = basePrice (20) + extras (1) = 21.00 JD
  const newUnitPrice = basePrice + parsedExtrasTotal; // 21.00 JD

  // Call update_order_item_atomic(p_order_id, p_item_id, p_unit_price, p_quantity, p_expected_version, p_staff_name, p_reason, p_name_ar, p_name_en, p_options_ar, p_options_en, p_notes)
  const updateRes = await asUser("authenticated", ids.sales, async () => {
    return await db.query(
      "SELECT public.update_order_item_atomic($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS res",
      [
        orderId,
        itemId,
        newUnitPrice, // 21.00 JD
        currentItem.quantity,
        1, // expected version 1
        "سيلز 1",
        "حفظ المحرر دون تغيير",
        currentItem.name_ar,
        currentItem.name_en,
        currentItem.options_ar,
        currentItem.options_en,
        "تم حفظ الملاحظات دون تغيير السعر",
      ]
    );
  });

  const raw1 = updateRes.rows[0].res;
  const parsed = typeof raw1 === "string" ? JSON.parse(raw1) : raw1;
  assert.equal(Number(parsed.total), 21.00, "Order total after first save must remain 21.00 JD");
  assert.equal(Number(parsed.version), 2, "Order version advanced to 2");

  // Save 2: simulate opening again and saving again
  const secondUpdateRes = await asUser("authenticated", ids.sales, async () => {
    return await db.query(
      "SELECT public.update_order_item_atomic($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS res",
      [
        orderId,
        itemId,
        newUnitPrice, // Still 21.00 JD!
        currentItem.quantity,
        2, // expected version 2
        "سيلز 1",
        "حفظ ثانٍ للتأكيد",
        currentItem.name_ar,
        currentItem.name_en,
        currentItem.options_ar,
        currentItem.options_en,
        "حفظ ثانٍ للتأكيد",
      ]
    );
  });

  const raw2 = secondUpdateRes.rows[0].res;
  const parsed2 = typeof raw2 === "string" ? JSON.parse(raw2) : raw2;
  assert.equal(Number(parsed2.total), 21.00, "Order total after second save must stay 21.00 JD!");
  assert.equal(Number(parsed2.version), 3, "Order version advanced to 3");
});

// ------------------------------------------------------------------------------
// PHASE 4: Optimistic Concurrency Control (OCC) Collision Protection
// ------------------------------------------------------------------------------
await test("4. OCC Collision Protection: Colleague saving against stale version 2 is rejected", async () => {
  let threw = false;
  try {
    await asUser("authenticated", ids.colleague, async () => {
      await db.query(
        "SELECT public.update_order_item_atomic($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
        [
          orderId,
          itemId,
          25.0, // p_unit_price
          1,    // p_quantity
          2,    // Stale version! (Current version is 3)
          "سيلز 2",
          "تعديل قديم متزامن",
          "كيكة شوكولاتة",
          null,
          ["الحجم: كبير"],
          [],
          null,
        ]
      );
    });
  } catch (err) {
    threw = true;
    assert.match(err.message, /OCC_VERSION_MISMATCH|تعارض في التعديل|Optimistic locking conflict/);
  }
  assert.equal(threw, true, "Must reject stale version update with OCC conflict exception");
});

// ------------------------------------------------------------------------------
// PHASE 5: Payment & Overpayment Refund Flow (Ledger Integrity)
// ------------------------------------------------------------------------------
await test("5. Payment & Refund Ledger: Customer tenders 25 JD (4 JD overpayment), refund settles balance to 21 JD", async () => {
  // Customer tenders 25 JD cash for 21 JD order
  const payRes = await asUser("authenticated", ids.sales, async () => {
    return await db.query(
      "SELECT public.record_order_payment_atomic($1, $2, $3, $4, $5, $6, $7, $8) AS res",
      [
        orderId,
        25.0,
        "cash",
        "full",
        "confirmed",
        "Cashier register drawer #1",
        "دفعة كاش عند الاستلام",
        ids.sales,
      ]
    );
  });

  const rawPay = payRes.rows[0].res;
  const payData = typeof rawPay === "string" ? JSON.parse(rawPay) : rawPay;
  assert.equal(Number(payData.deposit_paid), 25.0, "Deposit paid must record 25.00 JD");
  assert.equal(Number(payData.remaining), 0, "Balance remaining is 0");
  assert.equal(Number(payData.refund_due), 4.0, "Refund due must be 4.00 JD");

  // Cashier issues 4.00 JD change / refund to customer
  const refundRes = await asUser("authenticated", ids.sales, async () => {
    return await db.query(
      "SELECT public.record_order_payment_atomic($1, $2, $3, $4, $5, $6, $7, $8) AS res",
      [
        orderId,
        4.0,
        "cash",
        "refund",
        "confirmed",
        "Drawer change return",
        "إرجاع باقي المبلغ للعميل (فكة)",
        ids.sales,
      ]
    );
  });

  const rawRefund = refundRes.rows[0].res;
  const refundData = typeof rawRefund === "string" ? JSON.parse(rawRefund) : rawRefund;
  assert.equal(Number(refundData.deposit_paid), 21.0, "Net deposit settled to exactly 21.00 JD");
  assert.equal(Number(refundData.refund_due), 0.0, "Refund due settles to 0.00 JD");

  // Verify audit payments ledger rows
  const ledger = await db.query("SELECT amount, payment_type, status FROM public.order_payments WHERE order_id = $1 ORDER BY created_at ASC", [orderId]);
  assert.equal(ledger.rows.length, 2, "Must contain exactly 2 immutable ledger transactions");
  assert.equal(Number(ledger.rows[0].amount), 25.0);
  assert.equal(ledger.rows[0].payment_type, "full");
  assert.equal(Number(ledger.rows[1].amount), 4.0);
  assert.equal(ledger.rows[1].payment_type, "refund");
});

await db.close();

console.log("\n================================================================================");
console.log(`🏁 MULTI-SESSION ORDER LIFECYCLE SUITE: ${passed} of ${total} scenarios PASSED!`);
console.log("================================================================================\n");
