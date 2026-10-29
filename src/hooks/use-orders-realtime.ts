import { useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UseOrdersRealtimeOptions {
  /** Debounce delay in ms to collapse rapid bursts into a single refetch (default: 1500ms). */
  debounceMs?: number;
  /** Minimum cooldown between consecutive refetches in ms (default: 2000ms). */
  cooldownMs?: number;
}

/**
 * SEC-08: Production-grade Realtime Channel with burst debouncing, throttling cooldown,
 * network reconnection recovery, and live connection status tracking.
 */
export function useOrdersRealtime(
  queryKey: QueryKey,
  enabled: boolean,
  channelName: string,
  options?: UseOrdersRealtimeOptions,
) {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExecutedAt = useRef<number>(0);
  const refreshPending = useRef<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR" | "CONNECTING"
  >("CONNECTING");

  const debounceMs = options?.debounceMs ?? 1500;
  const cooldownMs = options?.cooldownMs ?? 2000;

  useEffect(() => {
    if (!enabled) return;

    const key = JSON.stringify(queryKey);

    const executeRefresh = () => {
      const now = Date.now();
      const elapsed = now - lastExecutedAt.current;

      // If document is hidden, defer refetch until tab is focused to save server bandwidth
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        refreshPending.current = true;
        return;
      }

      if (elapsed < cooldownMs) {
        // Schedule after remaining cooldown
        const wait = cooldownMs - elapsed;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          executeRefresh();
        }, wait);
        return;
      }

      lastExecutedAt.current = Date.now();
      refreshPending.current = false;
      const parsedKey = JSON.parse(key) as QueryKey;
      void queryClient.invalidateQueries({ queryKey: parsedKey, refetchType: "active" });
    };

    const triggerDebounced = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        executeRefresh();
      }, debounceMs);
    };

    // When returning to tab or regaining network, flush any pending refresh
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        executeRefresh();
      }
    };

    const handleOnline = () => {
      executeRefresh();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
    }

    setConnectionStatus("CONNECTING");

    const channel = supabase
      .channel(`${channelName}-live`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, triggerDebounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, triggerDebounced)
      .subscribe((status) => {
        setConnectionStatus(status as any);
        if (status === "SUBSCRIBED") {
          // Immediately sync current data when subscribed
          executeRefresh();
        }
      });

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channelName, queryClient, JSON.stringify(queryKey), debounceMs, cooldownMs]);

  return {
    isConnected: connectionStatus === "SUBSCRIBED",
    status: connectionStatus,
  };
}
