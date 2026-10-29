import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

async function run() {
  console.log("================================================================================");
  console.log("🐘 IN-MEMORY POSTGRESQL VERIFICATION OF FIXED STANDALONE SCHEMA");
  console.log("================================================================================\n");

  const pg = new PGlite();

  // Polyfill auth & storage schemas as Supabase cloud provides
  await pg.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$ LANGUAGE sql STABLE;

    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE IF NOT EXISTS storage.buckets (
      id text PRIMARY KEY,
      name text NOT NULL,
      public boolean DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS storage.objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id text REFERENCES storage.buckets(id),
      name text,
      owner uuid,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      last_accessed_at timestamptz DEFAULT now(),
      metadata jsonb
    );
  `);

  console.log("1. Loading and executing standalone_complete_schema.sql...");
  let schemaSql = fs.readFileSync(path.resolve("supabase/standalone_complete_schema.sql"), "utf8");
  schemaSql = schemaSql
    .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '-- uuid-ossp polyfilled')
    .replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '-- pgcrypto polyfilled');
  await pg.exec(schemaSql);
  console.log("   ✅ Schema loaded and executed cleanly with 0 syntax or runtime errors!\n");

  // Verify seeds
  console.log("2. Verifying default bootstrap seeds (store_settings & storefront_banner)...");
  const settingsRes = await pg.query("SELECT * FROM public.store_settings WHERE singleton = true;");
  assert.equal(settingsRes.rows.length, 1, "store_settings row must exist");
  assert.equal(settingsRes.rows[0].store_name, "Delish Cake & Bake");
  assert.equal(settingsRes.rows[0].card_color_palette, "soft_green");

  const bannerRes = await pg.query("SELECT * FROM public.storefront_banner WHERE id = '00000000-0000-0000-0000-000000000001';");
  assert.equal(bannerRes.rows.length, 1, "storefront_banner row must exist");
  console.log("   ✅ Bootstrap seeds verified!\n");

  // Setup mock staff users
  const adminId = "11111111-1111-1111-1111-111111111111";
  const salesId = "22222222-2222-2222-2222-222222222222";
  const kitchenId = "33333333-3333-3333-3333-333333333333";
  const socialId = "44444444-4444-4444-4444-444444444444";

  await pg.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${adminId}', 'admin@delish.local'),
      ('${salesId}', 'sales@delish.local'),
      ('${kitchenId}', 'kitchen@delish.local'),
      ('${socialId}', 'social@delish.local');

    INSERT INTO public.user_roles (user_id, role) VALUES
      ('${adminId}', 'admin'),
      ('${salesId}', 'sales'),
      ('${kitchenId}', 'kitchen'),
      ('${socialId}', 'social');
  `);

  // Journey 1: Test B1.1 fix in create_staff_order_atomic
  console.log("3. Testing Journey 1 (B1.1): Staff order creation with new client_request_id...");
  const orderRes = await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
    return await tx.query(`
      SELECT public.create_staff_order_atomic(
        '{"customer_name": "Reem Al-Majali", "customer_phone": "0791234567", "method": "pickup", "requested_date": "2026-11-01", "requested_time": "14:00", "client_request_id": "req-staff-001"}'::jsonb,
        '[{"name_ar": "كيك شوكولاتة", "unit_price": 25, "quantity": 1}]'::jsonb
      ) AS result;
    `);
  });
  const staffOrder = orderRes.rows[0].result;
  assert.ok(staffOrder.id, "Order ID must be generated");
  assert.equal(Number(staffOrder.subtotal), 25, "Subtotal must be 25");
  assert.equal(Number(staffOrder.total), 25, "Total must be 25");
  assert.equal(staffOrder.is_duplicate, false, "Must not be duplicate");

  // Test idempotency of staff order
  const dupStaffRes = await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
    return await tx.query(`
      SELECT public.create_staff_order_atomic(
        '{"customer_name": "Reem Al-Majali", "customer_phone": "0791234567", "method": "pickup", "requested_date": "2026-11-01", "requested_time": "14:00", "client_request_id": "req-staff-001"}'::jsonb,
        '[{"name_ar": "كيك شوكولاتة", "unit_price": 25, "quantity": 1}]'::jsonb
      ) AS result;
    `);
  });
  assert.equal(dupStaffRes.rows[0].result.id, staffOrder.id);
  assert.equal(dupStaffRes.rows[0].result.is_duplicate, true);
  console.log("   ✅ B1.1 resolved: Staff order created and idempotent retry verified cleanly!\n");

  // Journey 2: Test B1.2 fix in create_storefront_order_atomic
  console.log("4. Testing Journey 2 (B1.2): Storefront atomic order creation with items payload...");
  const sfOrderRes = await pg.query(`
    SELECT public.create_storefront_order_atomic(
      '{"customer_name": "Lina Storefront", "customer_phone": "0799876543", "method": "delivery", "area": "دابوق", "delivery_fee": 3, "requested_date": "2026-11-02", "requested_time": "16:00", "client_request_id": "req-sf-001"}'::jsonb,
      '[{"name_ar": "تشيز كيك لوتس", "unit_price": 22, "quantity": 1, "options_ar": ["شموع ذهبية"]}]'::jsonb
    ) AS result;
  `);
  const sfOrder = sfOrderRes.rows[0].result;
  assert.ok(sfOrder.id, "Storefront order ID must be generated");
  assert.equal(Number(sfOrder.subtotal), 22, "Storefront subtotal must be 22");
  assert.equal(Number(sfOrder.delivery_fee), 3, "Delivery fee must be 3");
  assert.equal(Number(sfOrder.total), 25, "Total must be 25");
  console.log("   ✅ B1.2 resolved: Storefront order atomic created without column reference ambiguity!\n");

  // Journey 3: Test B4 - Pending Payment must NOT update orders.deposit_paid
  console.log("5. Testing Journey 3 (B4): Financial ledger - Pending payment must NOT alter deposit_paid...");
  const orderId = staffOrder.id;
  await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
    await tx.query(`
      SELECT public.record_order_payment_atomic(
        '${orderId}'::uuid,
        7.00,
        'cliq',
        'deposit',
        'pending',
        'ref-pend-1',
        'دفعة معلقة قيد المراجعة',
        '${salesId}'::uuid,
        'موظف مبيعات',
        'pay-key-pend-1'
      );
    `);
  });
  const checkPendingOrder = await pg.query(`SELECT deposit_paid, version FROM public.orders WHERE id = '${orderId}';`);
  assert.equal(Number(checkPendingOrder.rows[0].deposit_paid), 0, "deposit_paid MUST remain 0 for pending payment");
  assert.equal(Number(checkPendingOrder.rows[0].version), 1, "version MUST remain 1 for pending payment");
  console.log("   ✅ B4 resolved: Pending payments strictly preserved in ledger without altering deposit_paid!\n");

  // Journey 4: Test B3 & Financial Lifecycle (Pay 25 on 20 JD total, refund 5 JD, settlement, duplicate refund rejection)
  console.log("6. Testing Journey 4 (B3 & Full Lifecycle): Pay 25 JD on 20 JD order, refund 5 JD, settle to 20 JD, reject 2nd refund...");
  // Create an order of 20 JD
  const lifeOrderRes = await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
    return await tx.query(`
      SELECT public.create_staff_order_atomic(
        '{"customer_name": "Tariq Lifecycle", "customer_phone": "0795555555", "method": "pickup", "requested_date": "2026-11-03", "requested_time": "15:00", "client_request_id": "req-life-001"}'::jsonb,
        '[{"name_ar": "كيكة فانيلا وسط", "unit_price": 20, "quantity": 1}]'::jsonb
      ) AS result;
    `);
  });
  const lifeOrderId = lifeOrderRes.rows[0].result.id;

  // Pay 25 JD
  const pay25Res = await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
    return await tx.query(`
      SELECT public.record_order_payment_atomic(
        '${lifeOrderId}'::uuid,
        25.00,
        'cliq',
        'full',
        'confirmed',
        'ref-pay-25',
        'دفع كامل مسبق مع زيادة',
        '${salesId}'::uuid,
        'موظف مبيعات',
        'key-pay-25'
      ) AS result;
    `);
  });
  assert.equal(Number(pay25Res.rows[0].result.deposit_paid), 25);
  assert.equal(Number(pay25Res.rows[0].result.refund_due), 5);

  // Refund 5 JD
  const ref5Res = await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
    return await tx.query(`
      SELECT public.record_order_payment_atomic(
        '${lifeOrderId}'::uuid,
        5.00,
        'cliq',
        'refund',
        'confirmed',
        'ref-ret-5',
        'استرجاع الفائض للزبون',
        '${salesId}'::uuid,
        'موظف مبيعات',
        'key-ref-5'
      ) AS result;
    `);
  });
  assert.equal(Number(ref5Res.rows[0].result.deposit_paid), 20);
  assert.equal(Number(ref5Res.rows[0].result.refund_due), 0);
  assert.equal(Number(ref5Res.rows[0].result.remaining), 0);

  // Mistaken second refund of 5 JD (must be rejected)
  let secondRefundFailed = false;
  try {
    await pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
      await tx.query(`
        SELECT public.record_order_payment_atomic(
          '${lifeOrderId}'::uuid,
          5.00,
          'cliq',
          'refund',
          'confirmed',
          'ref-ret-5-dup',
          'استرجاع مكرر خاطئ',
          '${salesId}'::uuid,
          'موظف مبيعات',
          'key-ref-5-dup'
        );
      `);
    });
  } catch (err) {
    secondRefundFailed = true;
    assert.ok(err.message.includes("يتجاوز المبلغ المسموح باسترجاعه"), "Must reject refund with cap error");
  }
  assert.equal(secondRefundFailed, true, "Second refund beyond allowable cap must be strictly rejected");
  console.log("   ✅ Financial lifecycle and refund cap verified cleanly!\n");

  // Journey 5: Test B5 - Kitchen order status transitions
  console.log("7. Testing Journey 5 (B5): Kitchen cannot modify cancelled or finalized orders...");
  // Cancel an order
  await pg.exec(`UPDATE public.orders SET status = 'cancelled' WHERE id = '${lifeOrderId}';`);
  let kitchenTransitionFailed = false;
  try {
    await pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL request.jwt.claim.sub = '${kitchenId}';`);
      await tx.query(`SELECT public.update_kitchen_order_status('${lifeOrderId}'::uuid, 'ready');`);
    });
  } catch (err) {
    kitchenTransitionFailed = true;
    assert.ok(err.message.includes("لا يمكن تعديل حالة طلب مكتمل أو ملغى"), "Must reject kitchen transition on cancelled order");
  }
  assert.equal(kitchenTransitionFailed, true);
  console.log("   ✅ B5 resolved: Kitchen order transitions protected against invalid states!\n");

  // Journey 6: Test B7 - update_order_item_atomic
  console.log("8. Testing Journey 6 (B7): Atomic order item price update with recalculation & OCC...");
  const itemRow = await pg.query(`SELECT id, order_id, unit_price FROM public.order_items WHERE order_id = '${orderId}' LIMIT 1;`);
  const itemId = itemRow.rows[0].id;
  const updateItemRes = await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
    return await tx.query(`
      SELECT public.update_order_item_atomic(
        '${orderId}'::uuid,
        '${itemId}'::uuid,
        30.00,
        1,
        1, -- expected version 1
        'موظف مبيعات',
        'تعديل سعر الصنف مع إضافة كريمة'
      ) AS result;
    `);
  });
  const updatedOrderRow = updateItemRes.rows[0].result;
  assert.equal(Number(updatedOrderRow.subtotal), 30);
  assert.equal(Number(updatedOrderRow.total), 30);
  assert.equal(Number(updatedOrderRow.version), 2);

  // Concurrency collision test
  let occItemMismatch = false;
  try {
    await pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
      await tx.query(`
        SELECT public.update_order_item_atomic(
          '${orderId}'::uuid,
          '${itemId}'::uuid,
          35.00,
          1,
          1 -- stale expected version 1 (order is now at version 2)
        );
      `);
    });
  } catch (err) {
    occItemMismatch = true;
    assert.ok(err.message.includes("OCC_VERSION_MISMATCH"));
  }
  assert.equal(occItemMismatch, true, "OCC must reject stale version");
  console.log("   ✅ B7 update_order_item_atomic verified with total recalculation and OCC!\n");

  // Journey 7: Test apply_order_discount_atomic
  console.log("9. Testing Journey 7 (B7): apply_order_discount_atomic...");
  const discRes = await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${adminId}';`);
    return await tx.query(`
      SELECT public.apply_order_discount_atomic(
        '${orderId}'::uuid,
        5.00,
        16.67,
        2, -- expected version 2
        'المدير العام',
        'خصم ترويجي خاص'
      ) AS result;
    `);
  });
  const discountedOrder = discRes.rows[0].result;
  assert.equal(Number(discountedOrder.discount_amount), 5);
  assert.equal(Number(discountedOrder.total), 25); // 30 - 5 = 25
  assert.equal(Number(discountedOrder.version), 3);
  console.log("   ✅ apply_order_discount_atomic verified cleanly!\n");

  // Journey 8: Test get_kitchen_orders() sanitization
  console.log("10. Testing Journey 8: get_kitchen_orders() hides sensitive monetary/phone fields in modifications...");
  const kdsFeedRes = await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${kitchenId}';`);
    return await tx.query(`SELECT * FROM public.get_kitchen_orders() WHERE id = '${orderId}';`);
  });
  assert.equal(kdsFeedRes.rows.length, 1);
  const kdsOrder = kdsFeedRes.rows[0];
  assert.equal(kdsOrder.customer_phone, undefined, "Kitchen view must not contain customer_phone");
  assert.equal(kdsOrder.deposit_paid, undefined, "Kitchen view must not contain deposit_paid");
  assert.equal(kdsOrder.total, undefined, "Kitchen view must not contain total");
  console.log("   ✅ Kitchen security & modifications sanitization verified!\n");

  console.log("================================================================================");
  console.log("🎉 ALL IN-MEMORY POSTGRESQL JOURNEYS PASSED 100% CLEANLY!");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("FATAL ERROR in verification suite:", err);
  process.exit(1);
});
