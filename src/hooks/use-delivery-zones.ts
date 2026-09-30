import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DELIVERY_ZONES, type DeliveryZone } from "@/lib/delivery-zones";

type DeliveryZonesState = {
  zones: DeliveryZone[];
  setZones: (zones: DeliveryZone[]) => void;
  resetZones: () => void;
};

export const useDeliveryZonesStore = create<DeliveryZonesState>()(
  persist(
    (set) => ({
      zones: DELIVERY_ZONES,
      setZones: (zones) => set({ zones }),
      resetZones: () => set({ zones: DELIVERY_ZONES }),
    }),
    {
      name: "delish-delivery-zones", // LocalStorage key
    },
  ),
);

/** Helper to get current zones anywhere (components or outside react) */
export const getActiveDeliveryZones = (): DeliveryZone[] => {
  return useDeliveryZonesStore.getState().zones;
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
