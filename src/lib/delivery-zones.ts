/**
 * Zone based delivery pricing.
 *
 * The browser only ever sends the *area name*. The fee is resolved from this
 * trusted table on the server, so a tampered request cannot lower the delivery
 * charge.
 */
export type DeliveryZone = {
  fee: number;
  labelAr: string;
  labelEn: string;
  areas: string[];
};

/**
 * "Other governorates" is a single catch-all option. Its fee is a range
 * (5–8 JD) that staff confirm per order; orders are stored at the range max
 * and staff adjust the final fee after confirming the address.
 */
export const OTHER_GOVERNORATES_AREA = "محافظات أخرى";
export const OTHER_FEE_MIN = 5;
export const OTHER_FEE_MAX = 8;

export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    fee: 3,
    labelAr: "توصيل ٣ د.أ",
    labelEn: "3 JD delivery",
    areas: [
      "عبدون",
      "الجبيهة",
      "طبربور",
      "عبدون العبدلي",
      "شفا بدران",
      "أبو نصير",
      "خلدا ش مكة",
      "ش المدينة عين الباشا",
      "تلاع العلي",
      "طلوع نيفين",
      "ضاحية الرشيد",
      "شميساني",
      "دابوق",
      "الكمالية",
      "جبل عمان",
      "جبل التاج",
      "ام السماق",
      "ام اذينة",
      "هاشمي الشمالي",
    ],
  },
  {
    fee: 4,
    labelAr: "توصيل ٤ د.أ",
    labelEn: "4 JD delivery",
    areas: [
      "ماركا",
      "المحطة",
      "عبدون الشمالي",
      "البيادر",
      "بدر الجديدة",
      "المقابلين",
      "أبو علندا",
      "الجويدة",
      "القويسمة",
    ],
  },
  {
    fee: 5,
    labelAr: "توصيل ٥ د.أ",
    labelEn: "5 JD delivery",
    areas: [
      "مرج الحمام",
      "البنيات",
      "الظهير",
      "البنيات الشمالي",
      "طريق المطار",
      "ناعور",
      "يادودة",
    ],
  },
  {
    fee: OTHER_FEE_MAX,
    labelAr: "محافظات أخرى · ٥–٨ د.أ",
    labelEn: "Other governorates · 5–8 JD",
    areas: [OTHER_GOVERNORATES_AREA],
  },
];

/** Cheapest zone wins when the same area name appears twice (e.g. بدر الجديدة). */
export const AREA_FEES: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const zone of DELIVERY_ZONES) {
    for (const area of zone.areas) {
      const current = map[area];
      map[area] = current === undefined ? zone.fee : Math.min(current, zone.fee);
    }
  }
  return map;
})();

export const DELIVERY_AREAS = Object.keys(AREA_FEES);

const normalise = (value: string) => value.trim().replace(/\s+/g, " ");

/** Returns the fee for an area, or null when the area is not one we deliver to. */
export function feeForArea(area: string | null | undefined): number | null {
  if (!area) return null;
  const fee = AREA_FEES[normalise(area)];
  return fee === undefined ? null : fee;
}
