/**
 * Network Chaos & Resilience Engine for Delish Cake & Bake
 * Inspired by Shopify Toxiproxy (https://github.com/Shopify/toxiproxy)
 * Simulates mobile network latency, dropped packets, and transient TCP resets
 * to harden POS cashier transactions and OCC update loops against failures.
 */

export interface ToxicConfig {
  type: "latency" | "bandwidth" | "timeout" | "reset_peer";
  attributes: {
    latencyMs?: number;
    jitterMs?: number;
    rateKbps?: number;
    timeoutMs?: number;
  };
}

export interface ResilienceOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  timeoutMs?: number;
}

/**
 * Executes a network operation wrapped in an exponential backoff resilience handler.
 * Survives transient connection drops and latency spikes simulated by Toxiproxy.
 */
export async function withNetworkResilience<T>(
  operationName: string,
  fn: (attempt: number) => Promise<T>,
  options: ResilienceOptions = {},
): Promise<{ result: T; attempts: number; durationMs: number }> {
  const { maxRetries = 3, initialDelayMs = 50, backoffFactor = 2, timeoutMs = 5000 } = options;

  const startTime = Date.now();
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      // Run operation with a timeout guard
      const result = await Promise.race([
        fn(attempt),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout: ${operationName} exceeded ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ]);

      const durationMs = Date.now() - startTime;
      return { result, attempts: attempt, durationMs };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt > maxRetries) {
        break;
      }

      // Compute exponential backoff with jitter
      const delay = Math.round(
        initialDelayMs * Math.pow(backoffFactor, attempt - 1) + Math.random() * 20,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `[Resilience Failure] ${operationName} failed after ${attempt} attempts: ${lastError?.message}`,
  );
}
