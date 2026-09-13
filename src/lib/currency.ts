/**
 * Jordanian Dinar is the only currency the bakery quotes in.
 * Arabic shows د.أ, English shows JOD, and the amount is always two decimals.
 */
export type CurrencyLang = "ar" | "en";

export const CURRENCY_SYMBOL: Record<CurrencyLang, string> = {
  ar: "د.أ",
  en: "JOD",
};

export function formatJod(value: number, lang: CurrencyLang = "ar"): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `${amount.toFixed(2)} ${CURRENCY_SYMBOL[lang]}`;
}

/** Arabic-first label used on staff screens, which are always RTL. */
export const jod = (value: number) => formatJod(value, "ar");
