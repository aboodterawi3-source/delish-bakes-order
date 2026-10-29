import { useState, useEffect } from "react";
import { DELIVERY_ZONES, type DeliveryZone } from "@/lib/delivery-zones";

const STORAGE_KEY = "delish-delivery-zones";

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
  const [zones, setZonesState] = useState<DeliveryZone[]>(readStoredZones);

  useEffect(() => {
    const onStorage = () => setZonesState(readStoredZones());
    window.addEventListener("delish-zones-updated", onStorage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("delish-zones-updated", onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setZones = (newZones: DeliveryZone[]) => {
    setZonesState(newZones);
    writeStoredZones(newZones);
  };

  const resetZones = () => {
    setZonesState(DELIVERY_ZONES);
    writeStoredZones(DELIVERY_ZONES);
  };

  return { zones, setZones, resetZones };
}

/** Helper to get current zones anywhere (components or outside react) */
export const getActiveDeliveryZones = (): DeliveryZone[] => {
  return readStoredZones();
};

/** Helper to compute fees mapping from current zones */
export const getActiveAreaFees = (): Record<string, number> => {
  const zones = getActiveDeliveryZones();
  const map: Record<string, number> = {};
  for (const zone of zones) {
    for (const area of zone.areas) {
      const current = map[area];
      map[area] = current === undefined ? zone.fee : Math.min(current, zone.fee);
    }
  }
  return map;
};
