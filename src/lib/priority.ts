/**
 * Kitchen priority tiers. A product can carry its own priority; otherwise the
 * priority of its category applies; otherwise the base (soft green) tier.
 * Client-safe: no server-only imports.
 */

export const PRIORITY_COLORS = [
  "dark_red",
  "warm_orange",
  "golden_yellow",
  "sky_blue",
  "soft_green",
] as const;

export type PriorityColor = (typeof PRIORITY_COLORS)[number];

/** Used whenever nothing was chosen for the product or its category. */
export const BASE_PRIORITY: PriorityColor = "soft_green";

export type PriorityMeta = {
  value: PriorityColor;
  /** 0 = most urgent. */
  rank: number;
  ar: string;
  en: string;
  swatch: string;
  bg: string;
  fg: string;
  fgMuted: string;
  glow: string;
};

export const PRIORITY_META: Record<PriorityColor, PriorityMeta> = {
  dark_red: {
    value: "dark_red",
    rank: 0,
    ar: "أولوية قصوى · أحمر غامق",
    en: "Critical priority",
    swatch: "oklch(0.45 0.18 25)",
    bg: "oklch(0.45 0.18 25)",
    fg: "#ffffff",
    fgMuted: "rgba(255,255,255,0.84)",
    glow: "0 0 28px -6px oklch(0.45 0.18 25 / 0.65)",
  },
  warm_orange: {
    value: "warm_orange",
    rank: 1,
    ar: "أولوية عالية · برتقالي دافئ",
    en: "High priority",
    swatch: "oklch(0.68 0.17 52)",
    bg: "oklch(0.68 0.17 52)",
    fg: "#ffffff",
    fgMuted: "rgba(255,255,255,0.86)",
    glow: "0 0 26px -6px oklch(0.68 0.17 52 / 0.6)",
  },
  golden_yellow: {
    value: "golden_yellow",
    rank: 2,
    ar: "الأولوية الثالثة · أصفر ذهبي",
    en: "Priority 3",
    swatch: "oklch(0.83 0.16 88)",
    bg: "oklch(0.83 0.16 88)",
    fg: "#2a220f",
    fgMuted: "rgba(42,34,15,0.82)",
    glow: "0 0 26px -6px oklch(0.83 0.16 88 / 0.55)",
  },
  sky_blue: {
    value: "sky_blue",
    rank: 3,
    ar: "الأولوية الرابعة · أزرق سماوي",
    en: "Priority 4",
    swatch: "oklch(0.74 0.11 230)",
    bg: "oklch(0.74 0.11 230)",
    fg: "#0e2233",
    fgMuted: "rgba(14,34,51,0.8)",
    glow: "0 0 24px -6px oklch(0.74 0.11 230 / 0.55)",
  },
  soft_green: {
    value: "soft_green",
    rank: 4,
    ar: "الأولوية الأساسية · أخضر فاتح",
    en: "Base priority",
    swatch: "oklch(0.78 0.11 150)",
    bg: "oklch(0.78 0.11 150)",
    fg: "#122a1a",
    fgMuted: "rgba(18,42,26,0.8)",
    glow: "0 0 24px -6px oklch(0.78 0.11 150 / 0.5)",
  },
};

export const PRIORITY_OPTIONS = PRIORITY_COLORS.map((value) => PRIORITY_META[value]);

export const isPriorityColor = (value: unknown): value is PriorityColor =>
  typeof value === "string" && (PRIORITY_COLORS as readonly string[]).includes(value);

/** The most urgent priority among an order's lines; base tier when empty. */
export const highestPriority = (values: (PriorityColor | null | undefined)[]): PriorityColor => {
  let best: PriorityColor = BASE_PRIORITY;
  for (const value of values) {
    if (!value) continue;
    if (PRIORITY_META[value].rank < PRIORITY_META[best].rank) best = value;
  }
  return best;
};
