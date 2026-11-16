import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  parseStoreSettingsEnvelope,
  persistStoreSettingsEnvelopeField,
} from "@/lib/cliq-config";
import { DELIVERY_ZONES, type DeliveryZone } from "@/lib/delivery-zones";

const STORAGE_KEY = "delish-delivery-zones";
export const DELIVERY_ZONES_QUERY_KEY = ["store_settings_delivery_zones"] as const;

function readStoredZones(): DeliveryZone[] {
  if (typeof window === "undefined") return DELIVERY_ZONES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DELIVERY_ZONES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    /* fallback to hardcoded default */
  }
  return DELIVERY_ZONES;
}

function writeStoredZones(zones: DeliveryZone[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
    window.dispatchEvent(new Event("delish-zones-updated"));
  } catch {
    /* ignore storage write failures */
  }
}

/**
 * Clean native hook for delivery zones management, replacing external zustand dependency.
 * Preserves 100% of the API used by AdminPanel.
 */
export function useDeliveryZonesStore() {
  const queryClient = useQueryClient();
  const [localZones, setLocalZonesState] = useState<DeliveryZone[]>(readStoredZones);

  const { data: dbZones } = useQuery({
    queryKey: DELIVERY_ZONES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("cliq_alias")
        .eq("singleton", true)
        .maybeSingle();

      if (error) {
        console.warn("[store_settings] error fetching deliveryZones:", error);
        return null;
      }
      const envelope = parseStoreSettingsEnvelope(
        (data as { cliq_alias?: string } | null)?.cliq_alias,
      );
      if (Array.isArray(envelope.deliveryZones) && envelope.deliveryZones.length > 0) {
        return envelope.deliveryZones as DeliveryZone[];
      }
      return null;
    },
    staleTime: 5_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (dbZones) {
      setLocalZonesState(dbZones);
      writeStoredZones(dbZones);
    }
  }, [dbZones]);

  useEffect(() => {
    const onStorage = () => setLocalZonesState(readStoredZones());
    window.addEventListener("delish-zones-updated", onStorage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("delish-zones-updated", onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const zones = dbZones ?? localZones;

  const setZones = async (newZones: DeliveryZone[]) => {
    setLocalZonesState(newZones);
    writeStoredZones(newZones);
    queryClient.setQueryData(DELIVERY_ZONES_QUERY_KEY, newZones);

    try {
      await persistStoreSettingsEnvelopeField("deliveryZones", newZones);
    } catch (error) {
      console.error("[store_settings] failed to save deliveryZones:", error);
      await queryClient.invalidateQueries({ queryKey: DELIVERY_ZONES_QUERY_KEY });
      throw error;
    }

    await queryClient.invalidateQueries({ queryKey: DELIVERY_ZONES_QUERY_KEY });
  };

  const resetZones = async () => {
    await setZones(DELIVERY_ZONES);
  };

  return { zones, setZones, resetZones };
}

/** Helper to get current zones anywhere (components or outside react) */
export const getActiveDeliveryZones = (): DeliveryZone[] => {
  return readStoredZones();
};
