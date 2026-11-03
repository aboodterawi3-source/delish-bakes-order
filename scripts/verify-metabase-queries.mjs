// ==============================================================================
// METABASE SQL QUERIES VERIFICATION SUITE (PGLite In-Memory DB)
// Validates 100% syntactical & execution correctness of all 5 Metabase BI queries
// ==============================================================================

import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

console.log("================================================================================");
console.log("📊 METABASE BI SQL QUERIES — AUTOMATED VERIFICATION SUITE");
console.log("================================================================================\n");

const db = new PGlite();

// 1. Setup minimal test schema matching Supabase
await db.exec(`
  CREATE TYPE app_role AS ENUM ('admin', 'sales', 'kitchen', 'social');
  CREATE TYPE order_status AS ENUM ('new', 'confirmed', 'baking', 'ready', 'out_for_delivery', 'completed', 'delivered', 'cancelled');
  CREATE TYPE order_method AS ENUM ('delivery', 'pickup');
  CREATE TYPE payment_method AS ENUM ('cash', 'cliq', 'visa');

  CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL DEFAULT 'Cake',
    name_ar text NOT NULL,
    name_en text NOT NULL,
    price numeric(10, 2) NOT NULL DEFAULT 0.00
  );

  CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    method order_method NOT NULL DEFAULT 'pickup',
    payment_method payment_method NOT NULL DEFAULT 'cash',
    deposit_paid numeric(10, 2) NOT NULL DEFAULT 0.00,
    subtotal numeric(10, 2) NOT NULL DEFAULT 0.00,
    total numeric(10, 2) NOT NULL DEFAULT 0.00,
    status order_status NOT NULL DEFAULT 'new',
    is_urgent boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id),
    name_ar text NOT NULL,
    name_en text NOT NULL,
    unit_price numeric(10, 2) NOT NULL DEFAULT 0.00,
    quantity integer NOT NULL DEFAULT 1
  );

  -- Seed test data
  INSERT INTO products (id, category, name_ar, name_en, price) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Cake', 'كيكة الشوكولاتة الفاخرة', 'Luxury Chocolate Cake', 25.00),
    ('22222222-2222-2222-2222-222222222222', 'Bakery', 'كرواسون زبدة فرنسي', 'Butter Croissant', 1.50);

  INSERT INTO orders (id, order_number, customer_name, customer_phone, method, payment_method, deposit_paid, total, status, is_urgent, version) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DL-1001', 'سارة الأحمد', '0791111111', 'pickup', 'cash', 30.00, 25.00, 'ready', false, 1),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'DL-1002', 'أحمد خليل', '0792222222', 'delivery', 'cliq', 15.00, 15.00, 'baking', true, 3);

  INSERT INTO order_items (order_id, product_id, name_ar, name_en, unit_price, quantity) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'كيكة الشوكولاتة الفاخرة', 'Luxury Chocolate Cake', 25.00, 1),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'كرواسون زبدة فرنسي', 'Butter Croissant', 1.50, 10);
`);

console.log("  ✅ Test Database Schema & Mock Seed Created in PGLite.\n");

const queriesDir = path.resolve("metabase/queries");
const queryFiles = fs
  .readdirSync(queriesDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let passCount = 0;
for (const file of queryFiles) {
  const filePath = path.join(queriesDir, file);
  const sql = fs.readFileSync(filePath, "utf-8");
  try {
    const res = await db.query(sql);
    console.log(`  ✅ [PASS] ${file}`);
    console.log(`     Rows returned: ${res.rows.length}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${file}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("\n================================================================================");
console.log(
  `🏁 METABASE VERIFICATION SUMMARY: ${passCount} of ${queryFiles.length} queries executed successfully!`,
);
console.log("================================================================================\n");
