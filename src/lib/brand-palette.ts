import { useEffect, useState } from "react";

export interface BrandPalette {
  id: string;
  nameEn: string;
  nameAr: string;
  main: string;        // Accent / Primary color e.g. #B8801C
  secondary: string;   // Dark text accent e.g. #6E3917
  cardBg: string;      // Image container background e.g. #FAF5EB
  border: string;      // Card border color e.g. #EFE8DC
  badgeBg: string;     // Badge background e.g. #B8801C
  badgeText: string;   // Badge text color e.g. #FFFFFF
  btnBg: string;       // Button background e.g. #B8801C
  btnHoverBg: string;  // Button hover background e.g. #9E6C14
  highlightBg: string; // Soft highlight background e.g. #FEF7EB
}

export const BRAND_PALETTES: Record<string, BrandPalette> = {
  gold: {
    id: "gold",
    nameEn: "DELISH Honey Gold 🍯",
    nameAr: "العسلي الذهبي (DELISH Honey Gold 🍯)",
    main: "#B8801C",
    secondary: "#6E3917",
    cardBg: "#FAF5EB",
    border: "#EFE8DC",
    badgeBg: "#B8801C",
    badgeText: "#FFFFFF",
    btnBg: "#B8801C",
    btnHoverBg: "#9E6C14",
    highlightBg: "#FEF7EB",
  },
  ivory: {
    id: "ivory",
    nameEn: "Soft Cream Ivory 🍦",
    nameAr: "عاجي ناعم (Soft Cream Ivory 🍦)",
    main: "#C58B24",
    secondary: "#4A3B32",
    cardBg: "#FAF5EB",
    border: "#F3E9DC",
    badgeBg: "#C58B24",
    badgeText: "#FFFFFF",
    btnBg: "#C58B24",
    btnHoverBg: "#A9731B",
    highlightBg: "#FEF7EB",
  },
  rose: {
    id: "rose",
    nameEn: "Warm Rose Pastel 🌸",
    nameAr: "باستيل وردي دافئ (Warm Rose Pastel 🌸)",
    main: "#D9777F",
    secondary: "#6E3917",
    cardBg: "#FFF5F5",
    border: "#FCD5CE",
    badgeBg: "#D9777F",
    badgeText: "#FFFFFF",
    btnBg: "#D9777F",
    btnHoverBg: "#C25D65",
    highlightBg: "#FFF0F0",
  },
  pistachio: {
    id: "pistachio",
    nameEn: "Delicate Pistachio 🌿",
    nameAr: "فستق راقي (Delicate Pistachio 🌿)",
    main: "#4E8752",
    secondary: "#1B3B1D",
    cardBg: "#E8F5E9",
    border: "#C8E6C9",
    badgeBg: "#4E8752",
    badgeText: "#FFFFFF",
    btnBg: "#4E8752",
    btnHoverBg: "#3B693E",
    highlightBg: "#F1F8F5",
  },
  chocolate: {
    id: "chocolate",
    nameEn: "Rich Chocolate Brown 🍫",
    nameAr: "شوكولاتة فاخرة (Rich Chocolate Brown 🍫)",
    main: "#6E3917",
    secondary: "#3E2723",
    cardBg: "#FDFBF7",
    border: "#D7CCC8",
    badgeBg: "#6E3917",
    badgeText: "#FFFFFF",
    btnBg: "#6E3917",
    btnHoverBg: "#542A10",
    highlightBg: "#F7F0EB",
  },
};

const PALETTE_STORAGE_KEY = "delish_active_brand_palette";
const PALETTE_EVENT_NAME = "delish-palette-change";

export function getStoredPaletteId(): string {
  if (typeof window === "undefined") return "gold";
  return localStorage.getItem(PALETTE_STORAGE_KEY) || "gold";
}

export function setStoredPaletteId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PALETTE_STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent(PALETTE_EVENT_NAME, { detail: id }));
}

export function useBrandPalette() {
  const [paletteId, setPaletteId] = useState<string>(getStoredPaletteId);

  useEffect(() => {
    const handlePaletteChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail) {
        setPaletteId(customEvent.detail);
      } else {
        setPaletteId(getStoredPaletteId());
      }
    };

    window.addEventListener(PALETTE_EVENT_NAME, handlePaletteChange);
    window.addEventListener("storage", handlePaletteChange);
    return () => {
      window.removeEventListener(PALETTE_EVENT_NAME, handlePaletteChange);
      window.removeEventListener("storage", handlePaletteChange);
    };
  }, []);

  const changePalette = (newId: string) => {
    setStoredPaletteId(newId);
    setPaletteId(newId);
  };

  const activePalette = BRAND_PALETTES[paletteId] || BRAND_PALETTES.gold;

  return {
    paletteId,
    setPalette: changePalette,
    palette: activePalette,
  };
}
