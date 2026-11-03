import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

async function run() {
  console.log("=== LOCAL POSTGRESQL REPRODUCTION SUITE (V3 FINDINGS) ===");
  const pg = new PGlite();

  // Create mock auth schema and roles matching Supabase environment
  await pg.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;

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

  console.log("Loading standalone_complete_schema.sql...");
  let schemaSql = fs.readFileSync(path.resolve("supabase/standalone_complete_schema.sql"), "utf8");
  // In PGlite, extensions like uuid-ossp and pgcrypto are not bundled; gen_random_uuid() is built-in
  schemaSql = schemaSql
    .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', "-- uuid-ossp skipped for pglite")
    .replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', "-- pgcrypto skipped for pglite");
  await pg.exec(schemaSql);
  console.log("✅ Schema executed successfully on clean PostgreSQL!");

  // Create test users: admin, sales, social, kitchen
  const adminId = "11111111-1111-1111-1111-111111111111";
  const salesId = "22222222-2222-2222-2222-222222222222";
  const socialId = "33333333-3333-3333-3333-333333333333";
  const kitchenId = "44444444-4444-4444-4444-444444444444";
  const visitorId = "55555555-5555-5555-5555-555555555555";

  await pg.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${adminId}', 'admin@delish.local'),
      ('${salesId}', 'sales@delish.local'),
      ('${socialId}', 'social@delish.local'),
      ('${kitchenId}', 'kitchen@delish.local'),
      ('${visitorId}', 'visitor@external.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role) VALUES
      ('${adminId}', 'admin'),
      ('${salesId}', 'sales'),
      ('${socialId}', 'social'),
      ('${kitchenId}', 'kitchen')
    ON CONFLICT (user_id, role) DO NOTHING;
  `);

  // Helper to set current user context
  const setAuthUser = async (userId) => {
    await pg.exec(`SET LOCAL request.jwt.claim.sub = '${userId || ""}';`);
  };

  // TEST 1: Test create_staff_order_atomic with new client_request_id (B1 issue 1)
  console.log("\n--- TEST B1.1: create_staff_order_atomic with new client_request_id ---");
  try {
    const res = await pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
      return await tx.query(`
        SELECT public.create_staff_order_atomic(
          '{"customer_name": "Test Customer", "customer_phone": "0790000000", "method": "pickup", "requested_date": "2026-11-01", "requested_time": "14:00", "total": 20, "client_request_id": "req-new-123"}'::jsonb,
          '[{"name_ar": "كيكة فانيلا", "unit_price": 20, "quantity": 1}]'::jsonb
        ) AS result;
      `);
    });
    console.log("Result:", res.rows[0].result);
  } catch (err) {
    console.log("❌ REPRODUCED B1.1 ERROR:", err.message);
  }

  // TEST 2: Test create_storefront_order_atomic (B1 issue 2)
  console.log("\n--- TEST B1.2: create_storefront_order_atomic without client_request_id ---");
  try {
    const res = await pg.query(`
      SELECT public.create_storefront_order_atomic(
        '{"customer_name": "Web Visitor", "customer_phone": "0791111111", "method": "pickup", "requested_date": "2026-11-02", "requested_time": "15:00", "payment_method": "cash"}'::jsonb,
        '[{"name_ar": "كيكة شوكولاتة", "unit_price": 25, "quantity": 1}]'::jsonb
      ) AS result;
    `);
    console.log("Result:", res.rows[0].result);
  } catch (err) {
    console.log("❌ REPRODUCED B1.2 ERROR:", err.message);
  }

  // TEST 3: Check authenticated grant on create_storefront_order_atomic (B2)
  console.log(
    "\n--- TEST B2: has_function_privilege for authenticated on create_storefront_order_atomic ---",
  );
  const b2Res = await pg.query(`
    SELECT
      has_function_privilege('anon', 'public.create_storefront_order_atomic(jsonb, jsonb)', 'execute') AS anon_can_exec,
      has_function_privilege('authenticated', 'public.create_storefront_order_atomic(jsonb, jsonb)', 'execute') AS auth_can_exec,
      has_function_privilege('service_role', 'public.create_storefront_order_atomic(jsonb, jsonb)', 'execute') AS service_can_exec;
  `);
  console.log("Privileges:", b2Res.rows[0]);

  // TEST 4: Test pending payment modifying deposit_paid (B4)
  console.log("\n--- TEST B4: Pending payment impact on deposit_paid ---");
  // Create an order first by passing client_request_id = null to bypass B1
  let testOrderId;
  await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
    const ord = await tx.query(`
      SELECT public.create_staff_order_atomic(
        '{"customer_name": "Pay Test", "customer_phone": "0792222222", "method": "pickup", "requested_date": "2026-11-01", "requested_time": "14:00", "total": 20}'::jsonb,
        '[{"name_ar": "كيكة فانيلا", "unit_price": 20, "quantity": 1}]'::jsonb
      ) AS result;
    `);
    testOrderId = ord.rows[0].result.id;
  });

  // Record a pending payment of 7 JD
  await pg.transaction(async (tx) => {
    await tx.exec(`SET LOCAL request.jwt.claim.sub = '${salesId}';`);
    await tx.query(`
      SELECT public.record_order_payment_atomic(
        '${testOrderId}',
        7.00,
        'cliq',
        'deposit',
        'pending',
        'REF-PENDING',
        'Pending payment',
        '${salesId}',
        'Sales Staff',
        'idem-pending-1'
      );
    `);
  });

  const checkDeposit = await pg.query(`
    SELECT deposit_paid FROM public.orders WHERE id = '${testOrderId}';
  `);
  console.log("Deposit paid after pending payment of 7 JD:", checkDeposit.rows[0].deposit_paid);

  // TEST 5: Test kitchen stage transition on cancelled order (B5)
  console.log("\n--- TEST B5: Kitchen updating cancelled order to ready ---");
  await pg.query(`UPDATE public.orders SET status = 'cancelled' WHERE id = '${testOrderId}';`);
  try {
    await pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL request.jwt.claim.sub = '${kitchenId}';`);
      await tx.query(`
        SELECT public.update_kitchen_order_status('${testOrderId}', 'ready');
      `);
    });
    const checkCancelled = await pg.query(
      `SELECT status FROM public.orders WHERE id = '${testOrderId}';`,
    );
    console.log(
      "❌ REPRODUCED B5: Cancelled order was transitioned to:",
      checkCancelled.rows[0].status,
    );
  } catch (err) {
    console.log("✅ Transition was rejected:", err.message);
  }
}

run().catch(console.error);
