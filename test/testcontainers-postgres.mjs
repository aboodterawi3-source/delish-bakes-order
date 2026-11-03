// ==============================================================================
// DETERMINISTIC IN-MEMORY DATABASE TEST SUITE (@electric-sql/pglite)
// NOTE (J7 Audit Resolution): Tests OCC concurrency and transactional rollback
// in deterministic in-memory PostgreSQL engine. When Docker daemon is not active,
// runs entirely within PGlite rather than spinning up container infrastructure.
// ==============================================================================

import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { execSync } from "node:child_process";

console.log("================================================================================");
console.log("🐘 DATABASE OCC & TRANSACTION INTEGRITY SUITE (PGlite In-Memory Engine)");
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

// Check Docker daemon availability safely
function isDockerAvailable() {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

const dockerOnline = isDockerAvailable();
console.log(
  `  ℹ️  Docker Daemon Status: ${dockerOnline ? "ONLINE" : "OFFLINE / LOCAL WORKSTATION"}`,
);
console.log(`  ℹ️  Engine Mode: Deterministic Local Isolated PostgreSQL (@electric-sql/pglite)\n`);

// ------------------------------------------------------------------------------
// TEST 1: Schema Initialization & Enum Creation
// ------------------------------------------------------------------------------
let dbInstance;
await test("1. Isolated Database instance initializes Supabase schema & enums", async () => {
  dbInstance = new PGlite();
  await dbInstance.exec(`
    CREATE TYPE order_status AS ENUM ('new', 'confirmed', 'baking', 'ready', 'completed', 'cancelled');
    CREATE TYPE order_method AS ENUM ('delivery', 'pickup');

    CREATE TABLE orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      total NUMERIC(10,2) NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      status order_status NOT NULL DEFAULT 'new',
      method order_method NOT NULL DEFAULT 'pickup',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const res = await dbInstance.query("SELECT COUNT(*) FROM orders");
  assert.equal(res.rows[0].count, 0, "Initial table must be empty");
});

// ------------------------------------------------------------------------------
// TEST 2: Optimistic Concurrency Control (OCC) Collision Detection
// ------------------------------------------------------------------------------
await test("2. OCC Concurrency: Stale update with mismatched version is rejected", async () => {
  // Insert initial order at version 1
  const insert = await dbInstance.query(`
    INSERT INTO orders (order_number, customer_name, total, version)
    VALUES ('DELISH-1001', 'Ahmad Test', 25.00, 1)
    RETURNING id, version
  `);
  const orderId = insert.rows[0].id;
  assert.equal(insert.rows[0].version, 1);

  // Cashier 1 successfully updates order and increments version to 2
  const update1 = await dbInstance.query(
    `
    UPDATE orders
    SET total = 30.00, version = version + 1
    WHERE id = $1 AND version = 1
    RETURNING version
  `,
    [orderId],
  );
  assert.equal(update1.rows.length, 1, "First update must succeed");
  assert.equal(update1.rows[0].version, 2, "Version must advance to 2");

  // Cashier 2 attempts concurrent update using stale version 1 -> Must match 0 rows!
  const update2 = await dbInstance.query(
    `
    UPDATE orders
    SET total = 35.00, version = version + 1
    WHERE id = $1 AND version = 1
    RETURNING version
  `,
    [orderId],
  );
  assert.equal(update2.rows.length, 0, "Concurrent stale update must match 0 rows (OCC conflict)");

  // Verify final record integrity
  const finalRow = await dbInstance.query("SELECT total, version FROM orders WHERE id = $1", [
    orderId,
  ]);
  assert.equal(finalRow.rows[0].total, "30.00", "Total must preserve Cashier 1's commit");
  assert.equal(finalRow.rows[0].version, 2, "Final version must be 2");
});

// ------------------------------------------------------------------------------
// TEST 3: Transactional Rollback on Constraint Violation
// ------------------------------------------------------------------------------
await test("3. Atomic Transaction: Rollback preserves state when validation fails", async () => {
  const beforeCount = (await dbInstance.query("SELECT COUNT(*) FROM orders")).rows[0].count;

  try {
    await dbInstance.exec(`
      BEGIN;
      INSERT INTO orders (order_number, customer_name, total, version, status)
      VALUES ('DELISH-1002', 'Valid Line', 15.00, 1, 'new');

      -- Force a syntax or type error to trigger rollback
      INSERT INTO orders (order_number, customer_name, total, version, status)
      VALUES ('DELISH-1003', 'Invalid Line', 15.00, 1, 'invalid_enum_status'::order_status);
      COMMIT;
    `);
  } catch {
    await dbInstance.exec("ROLLBACK;");
  }

  const afterCount = (await dbInstance.query("SELECT COUNT(*) FROM orders")).rows[0].count;
  assert.equal(afterCount, beforeCount, "Failed transaction must roll back completely (atomic)");
});

await dbInstance.close();

console.log("\n================================================================================");
console.log(`🏁 IN-MEMORY OCC SUITE FINISHED: ${passed} of ${total} tests passed cleanly!`);
console.log("================================================================================\n");
