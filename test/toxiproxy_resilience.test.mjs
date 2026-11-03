// ==============================================================================
// TOXIPROXY CHAOS RESILIENCE TEST SUITE
// Simulates latency spikes, connection drops, and transient failures
// ==============================================================================

import assert from "node:assert/strict";
import { withNetworkResilience } from "../src/lib/chaos-network.ts";

console.log("================================================================================");
console.log("☣️  TOXIPROXY CHAOS & NETWORK RESILIENCE — VERIFICATION SUITE");
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
// TEST 1: Clean network succeeds immediately
// ------------------------------------------------------------------------------
await test("1. Clean network operation completes on attempt 1", async () => {
  const { result, attempts } = await withNetworkResilience(
    "fetch_bakery_catalog",
    async (attempt) => {
      return { status: 200, itemsCount: 15 };
    }
  );

  assert.equal(attempts, 1);
  assert.equal(result.itemsCount, 15);
});

// ------------------------------------------------------------------------------
// TEST 2: Survives Transient Connection Drop (Toxiproxy reset_peer simulation)
// ------------------------------------------------------------------------------
await test("2. Survives 2 consecutive transient TCP resets and succeeds on attempt 3", async () => {
  let callCount = 0;

  const { result, attempts } = await withNetworkResilience(
    "place_cashier_order_occ",
    async (attempt) => {
      callCount++;
      if (callCount < 3) {
        throw new Error("ECONNRESET: Toxiproxy injected connection reset by peer");
      }
      return { orderNumber: "DL-9901", status: "confirmed", version: 2 };
    },
    { maxRetries: 3, initialDelayMs: 20 }
  );

  assert.equal(attempts, 3, "Operation must recover on attempt 3");
  assert.equal(result.orderNumber, "DL-9901");
  assert.equal(result.version, 2);
});

// ------------------------------------------------------------------------------
// TEST 3: Timeout Guard on Heavy Latency Spike (Toxiproxy latency toxic)
// ------------------------------------------------------------------------------
await test("3. Timeout guard rejects operations exceeding specified bound", async () => {
  let threw = false;

  try {
    await withNetworkResilience(
      "slow_mobile_sync",
      async () => {
        // Simulate extreme 500ms delay while timeout limit is 50ms
        await new Promise((r) => setTimeout(r, 200));
        return "too late";
      },
      { maxRetries: 1, timeoutMs: 50, initialDelayMs: 10 }
    );
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes("Timeout"), "Should raise timeout error");
  }

  assert.equal(threw, true, "Must abort on exceeded timeout");
});

console.log("\n================================================================================");
console.log(`🏁 TOXIPROXY SUITE FINISHED: ${passed} of ${total} tests passed cleanly!`);
console.log("================================================================================\n");
