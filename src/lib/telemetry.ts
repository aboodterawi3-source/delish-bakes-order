/**
 * OpenTelemetry Observability & Tracing Module for Delish & Bake Order Management
 * Powered by @opentelemetry/api
 * https://github.com/open-telemetry/opentelemetry-js
 */

import { trace, metrics, SpanStatusCode, type Span, type Tracer, type Meter } from "@opentelemetry/api";

const SERVICE_NAME = "delish-bakes-order";
const SERVICE_VERSION = "1.0.0";

// Global Tracer & Meter instances
export const tracer: Tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);
export const meter: Meter = metrics.getMeter(SERVICE_NAME, SERVICE_VERSION);

// Standard Business & Performance Metric Counters
export const ordersCreatedCounter = meter.createCounter("delish_orders_created_total", {
  description: "Total number of customer and cashier orders created",
  unit: "1",
});

export const occConflictsCounter = meter.createCounter("delish_occ_conflicts_total", {
  description: "Total number of Optimistic Concurrency Control update retries/conflicts",
  unit: "1",
});

export const refundDueCounter = meter.createCounter("delish_refunds_due_total", {
  description: "Total count of orders resulting in customer refunds due",
  unit: "1",
});

export const paymentSettledCounter = meter.createCounter("delish_payments_settled_total", {
  description: "Total count of payments settled (cash, cliq, visa)",
  unit: "1",
});

/**
 * Execute an async operation within an OpenTelemetry active span.
 * Automatically records status code, duration, exceptions, and custom attributes.
 */
export async function withActiveSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean> = {},
  fn: (span: Span) => Promise<T> | T
): Promise<T> {
  const span = tracer.startSpan(name, {
    attributes: {
      "service.name": SERVICE_NAME,
      "service.version": SERVICE_VERSION,
      ...attributes,
    },
  });

  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Error) {
      span.recordException(error);
    }
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Record a business telemetry event with structured attributes
 */
export function recordBusinessEvent(
  eventName: "order_created" | "occ_retry" | "refund_detected" | "payment_completed",
  attributes: Record<string, string | number | boolean>
): void {
  switch (eventName) {
    case "order_created":
      ordersCreatedCounter.add(1, attributes);
      break;
    case "occ_retry":
      occConflictsCounter.add(1, attributes);
      break;
    case "refund_detected":
      refundDueCounter.add(1, attributes);
      break;
    case "payment_completed":
      paymentSettledCounter.add(1, attributes);
      break;
  }
}
