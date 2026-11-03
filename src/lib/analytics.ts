/**
 * Delish Cake & Bake — Analytics & Product Telemetry (PostHog Integration)
 *
 * Lightweight, zero-overhead client/server telemetry wrapper.
 * Safely handles SSR and respects privacy boundaries.
 */

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

class DelishAnalytics {
  private apiKey: string | null = null;
  private host: string = "https://app.posthog.com";
  private isBrowser: boolean = typeof window !== "undefined";

  constructor() {
    if (this.isBrowser) {
      this.apiKey =
        (window as any).__DELISH_POSTHOG_KEY__ ||
        (import.meta as any).env?.VITE_POSTHOG_KEY ||
        null;
    }
  }

  public identify(userId: string, traits?: Record<string, unknown>) {
    if (!this.isBrowser || !this.apiKey) return;
    try {
      this.sendPostHogEvent("$identify", {
        $distinct_id: userId,
        ...traits,
      });
    } catch (e) {
      // Non-blocking telemetry
    }
  }

  public track(eventName: string, properties?: Record<string, unknown>) {
    if (!this.isBrowser) return;
    try {
      if (this.apiKey) {
        this.sendPostHogEvent(eventName, {
          ...properties,
          $current_url: window.location.href,
          $referrer: document.referrer,
        });
      }
    } catch {
      // Telemetry should never disrupt UX
    }
  }

  private sendPostHogEvent(event: string, properties: Record<string, unknown>) {
    if (!this.apiKey) return;
    const payload = {
      api_key: this.apiKey,
      event,
      properties: {
        ...properties,
        $lib: "delish-posthog-client",
        $lib_version: "1.0.0",
      },
      timestamp: new Date().toISOString(),
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${this.host}/capture/`,
        new Blob([JSON.stringify(payload)], { type: "application/json" }),
      );
    } else {
      fetch(`${this.host}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }

  // Pre-typed high-value e-commerce events for luxury bakery
  public trackOrderStarted(itemCount: number, estimatedTotal: number) {
    this.track("delish_order_started", {
      item_count: itemCount,
      estimated_total_jod: estimatedTotal,
    });
  }

  public trackOrderSubmitted(
    orderNumber: string,
    total: number,
    deposit: number,
    fulfillment: string,
  ) {
    this.track("delish_order_submitted", {
      order_number: orderNumber,
      total_amount_jod: total,
      deposit_amount_jod: deposit,
      fulfillment_type: fulfillment,
    });
  }

  public trackStaffAction(role: string, action: string, orderNumber?: string) {
    this.track("delish_staff_action", {
      role,
      action,
      order_number: orderNumber,
    });
  }
}

export const analytics = new DelishAnalytics();
