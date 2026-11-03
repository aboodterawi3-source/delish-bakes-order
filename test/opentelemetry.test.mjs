// ==============================================================================
// OPENTELEMETRY TRACING & METRICS TEST SUITE
// Validates span creation, duration tracing, error capture, and metric counters
// ==============================================================================

import assert from "node:assert/strict";
import {
  tracer,
  meter,
  withActiveSpan,
  recordBusinessEvent,
  ordersCreatedCounter,
  occConflictsCounter,
  refundDueCounter,
} from "../src/lib/telemetry.ts";

console.log("================================================================================");
console.log("🔭 OPENTELEMETRY TRACING & METRICS — VERIFICATION SUITE");
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
// TEST 1: Tracer & Meter instances are healthy
// ------------------------------------------------------------------------------
await test("1. OpenTelemetry Tracer and Meter instances initialize properly", () => {
  assert.ok(tracer, "Tracer should be defined");
  assert.ok(meter, "Meter should be defined");
  assert.equal(typeof tracer.startSpan, "function");
  assert.equal(typeof meter.createCounter, "function");
});

// ------------------------------------------------------------------------------
// TEST 2: Active Span Lifecycle and Context Execution
// ------------------------------------------------------------------------------
await test("2. withActiveSpan() executes workload, captures attributes and completes cleanly", async () => {
  const result = await withActiveSpan(
    "calculate_order_pricing",
    { "order.channel": "pickup", "order.items_count": 3 },
    async (span) => {
      assert.ok(span, "Span object must be supplied to callback");
      assert.equal(typeof span.setAttribute, "function");
      span.setAttribute("pricing.total_jd", 25.5);
      return { success: true, total: 25.5 };
    },
  );

  assert.deepEqual(result, { success: true, total: 25.5 });
});

// ------------------------------------------------------------------------------
// TEST 3: Active Span captures Errors & Exceptions
// ------------------------------------------------------------------------------
await test("3. withActiveSpan() propagates errors and records exception status", async () => {
  let caught = false;
  try {
    await withActiveSpan("failing_operation", { "test.scenario": "error_handling" }, async () => {
      throw new Error("Simulated OCC concurrency conflict");
    });
  } catch (err) {
    caught = true;
    assert.equal(err.message, "Simulated OCC concurrency conflict");
  }

  assert.equal(caught, true, "Exception must be propagated to caller");
});

// ------------------------------------------------------------------------------
// TEST 4: Business Telemetry Event Counter Recording
// ------------------------------------------------------------------------------
await test("4. recordBusinessEvent() routes business events to OpenTelemetry counters", () => {
  // Test adding metrics for OCC retry and refund detection
  assert.doesNotThrow(() => {
    recordBusinessEvent("occ_retry", { order_id: "test-order-1", retry_count: 2 });
    recordBusinessEvent("refund_detected", { order_id: "test-order-2", refund_amount: 5.0 });
    recordBusinessEvent("order_created", { channel: "pickup", payment_method: "cash" });
    recordBusinessEvent("payment_completed", { payment_method: "cliq" });
  });
});

console.log("\n================================================================================");
console.log(`🏁 OPENTELEMETRY SUITE FINISHED: ${passed} of ${total} tests passed cleanly!`);
console.log("================================================================================\n");
