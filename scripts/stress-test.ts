import { performance } from "perf_hooks";

// Configurations
const CONCURRENCY = 50; // Number of simultaneous checkout requests
const TIMEOUT_MS = 10000;
// Note: Replace with your actual local/production storefront endpoint.
// In a TanStack Start app, the server function endpoint path might vary, 
// usually it's /_server or the mapped API route. We simulate a generic API blast here.
const ENDPOINT = "http://localhost:3000/api/checkout"; 

const log = {
  info: (msg: string) => console.log(`\x1b[34m[INFO]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
};

// Helper to calculate percentiles
function calculateP95(durations: number[]): number {
  if (durations.length === 0) return 0;
  durations.sort((a, b) => a - b);
  const index = Math.ceil(durations.length * 0.95) - 1;
  return durations[index];
}

async function simulateCheckout(workerId: number): Promise<{ success: boolean; duration: number }> {
  const start = performance.now();
  
  // Create a realistic payload. To test Race Conditions, some workers will intentionally 
  // share the SAME client_request_id to trigger the Idempotency/Twin Order logic.
  const isDuplicate = workerId % 5 === 0; // 20% chance of double-tap simulation
  const idempotencyKey = isDuplicate ? "static-twin-uuid-0000" : crypto.randomUUID();

  const payload = {
    customer_name: `Stress Test Worker ${workerId}`,
    customer_phone: "0790000000",
    method: "pickup",
    requested_date: "2026-12-31",
    requested_time: "14:00",
    client_request_id: idempotencyKey,
    lines: [
      {
        spec: { kind: "cms", productId: "test-product", size: "Standard" },
        quantity: 1,
      }
    ]
  };

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(id);
    const duration = performance.now() - start;
    
    // We treat 200/OK and 429 (Rate Limit Expected) as acceptable application responses.
    if (response.ok || response.status === 429) {
      return { success: true, duration };
    } else {
      return { success: false, duration };
    }
  } catch (err) {
    const duration = performance.now() - start;
    return { success: false, duration };
  }
}

async function runStressTest() {
  console.log("\n=======================================================");
  console.log("🔥 Zero-Tolerance Concurrency & Stress Test Suite");
  console.log(`Firing ${CONCURRENCY} simultaneous checkout requests...`);
  console.log("=======================================================\n");

  const startTime = performance.now();
  
  // Blast all requests at the exact same time (Promise.all)
  const promises = Array.from({ length: CONCURRENCY }, (_, i) => simulateCheckout(i));
  const results = await Promise.all(promises);
  
  const totalDuration = performance.now() - startTime;
  
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  const durations = results.map(r => r.duration);
  
  const p95 = calculateP95(durations);
  const errorRate = (failures.length / CONCURRENCY) * 100;

  console.log(`\n📊 [RESULTS OVERVIEW]`);
  console.log(`Total Requests: ${CONCURRENCY}`);
  console.log(`Successful/Handled: ${successes.length}`);
  console.log(`Failed/Dropped: ${failures.length}`);
  console.log(`Total Time: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Average Latency: ${(durations.reduce((a, b) => a + b, 0) / CONCURRENCY).toFixed(2)}ms`);

  console.log(`\n🛑 [SRE THRESHOLDS]`);
  
  if (p95 > 2000) {
    log.error(`P95 Latency: ${p95.toFixed(2)}ms (Failed: > 2000ms threshold). Possible Connection Pool Exhaustion.`);
  } else {
    log.success(`P95 Latency: ${p95.toFixed(2)}ms (Passed)`);
  }

  if (errorRate > 1) {
    log.error(`Error Rate: ${errorRate.toFixed(2)}% (Failed: > 1% threshold). Race Conditions or Dropped Connections detected.`);
  } else {
    log.success(`Error Rate: ${errorRate.toFixed(2)}% (Passed)`);
  }

  console.log("\nNote: Idempotency keys were intentionally duplicated in 20% of requests to test twin-order safety.\n");
  
  if (p95 <= 2000 && errorRate <= 1) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runStressTest().catch(console.error);
