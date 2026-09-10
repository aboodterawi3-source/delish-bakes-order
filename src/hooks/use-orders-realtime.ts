import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * One realtime channel per mounted screen, torn down on unmount.
 * Bursts of `orders` + `order_items` events collapse into a single refetch,
 * so a multi-row insert never triggers a storm of queries.
 */
export function useOrdersRealtime(queryKey: QueryKey, enabled: boolean, channelName: string) {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const key = JSON.stringify(queryKey);
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void queryClient.invalidateQueries({ queryKey: JSON.parse(key) as QueryKey });
      }, 250);
    };

    const channel = supabase
      .channel(`${channelName}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, refresh)
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channelName, queryClient, JSON.stringify(queryKey)]);
}
