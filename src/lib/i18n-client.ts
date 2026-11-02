/**
 * React-i18next Client Configuration for Delish Cake & Bake
 * Powered by i18next & react-i18next (https://github.com/i18next/react-i18next)
 * Provides bilingual (Arabic RTL default, English LTR) translation bindings.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import arTranslations from "../../locales/ar.json" with { type: "json" };
import enTranslations from "../../locales/en.json" with { type: "json" };

const resources = {
  ar: {
    translation: arTranslations,
  },
  en: {
    translation: enTranslations,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ar",
    fallbackLng: "ar",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
export { i18n };
