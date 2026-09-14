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
    fee: 5,
    labelAr: "محافظات أخرى · ٥ د.أ",
    labelEn: "Other governorates · 5 JD",
    areas: ["الزرقاء", "مادبا", "السلط"],
  },
  {
    fee: 6,
    labelAr: "محافظات أخرى · ٦ د.أ",
    labelEn: "Other governorates · 6 JD",
    areas: ["جرش", "عجلون", "المفرق"],
  },
  {
    fee: 7,
    labelAr: "محافظات أخرى · ٧ د.أ",
    labelEn: "Other governorates · 7 JD",
    areas: ["إربد", "الكرك"],
  },
  {
    fee: 8,
    labelAr: "محافظات أخرى · ٨ د.أ",
    labelEn: "Other governorates · 8 JD",
    areas: ["الطفيلة", "معان", "العقبة", "البحر الميت"],
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
