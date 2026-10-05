import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BrandPalette {
  id: string;
  nameEn: string;
  nameAr: string;
  main: string; // Primary Accent e.g. #B8801C, #8C6D3B, #E11D48, #16A34A, #6E3917
  secondary: string; // Text & secondary accent
  cardBg: string; // Light Tint background e.g. #FEF7EB, #FAF5EB, #FDF2F4, #F0FDF4, #FAF5F0
  border: string; // Border color e.g. #FDE68A, #EFE8DC, #FBCFE8, #BBF7D0, #E4D5C7
  badgeBg: string; // Badge background
  badgeText: string; // Badge text color
  btnBg: string; // Button background
  btnHoverBg: string; // Button hover background e.g. #9E6C14, #70552B, #BE123C, #15803D, #552B11
  highlightBg: string; // Soft highlight background
}

export const BRAND_PALETTES: Record<string, BrandPalette> = {
  gold: {
    id: "gold",
    nameEn: "Honey Gold 🍯",
    nameAr: "عسل ذهبي 🍯",
    main: "#B8801C",
    secondary: "#6E3917",
    cardBg: "#FEF7EB",
    border: "#FDE68A",
    badgeBg: "#B8801C",
    badgeText: "#FFFFFF",
    btnBg: "#B8801C",
    btnHoverBg: "#9E6C14",
    highlightBg: "#FEF7EB",
  },
  ivory: {
    id: "ivory",
    nameEn: "Soft Ivory 🍦",
    nameAr: "عاجي ناعم 🍦",
    main: "#8C6D3B",
    secondary: "#26160F",
    cardBg: "#FAF5EB",
    border: "#EFE8DC",
    badgeBg: "#8C6D3B",
    badgeText: "#FFFFFF",
    btnBg: "#8C6D3B",
    btnHoverBg: "#70552B",
    highlightBg: "#FAF5EB",
  },
  rose: {
    id: "rose",
    nameEn: "Pastel Rose 🌸",
    nameAr: "باستيل وردي 🌸",
    main: "#E11D48",
    secondary: "#9F1239",
    cardBg: "#FDF2F4",
    border: "#FBCFE8",
    badgeBg: "#E11D48",
    badgeText: "#FFFFFF",
    btnBg: "#E11D48",
    btnHoverBg: "#BE123C",
    highlightBg: "#FDF2F4",
  },
  pistachio: {
    id: "pistachio",
    nameEn: "Refined Pistachio 🌿",
    nameAr: "فستق راقي 🌿",
    main: "#16A34A",
    secondary: "#14532D",
    cardBg: "#F0FDF4",
    border: "#BBF7D0",
    badgeBg: "#16A34A",
    badgeText: "#FFFFFF",
    btnBg: "#16A34A",
    btnHoverBg: "#15803D",
    highlightBg: "#F0FDF4",
  },
  chocolate: {
    id: "chocolate",
    nameEn: "Luxury Chocolate 🍫",
    nameAr: "شوكولاتة فاخرة 🍫",
    main: "#6E3917",
    secondary: "#3E2723",
    cardBg: "#FAF5F0",
    border: "#E4D5C7",
    badgeBg: "#6E3917",
    badgeText: "#FFFFFF",
    btnBg: "#6E3917",
    btnHoverBg: "#552B11",
    highlightBg: "#FAF5F0",
  },
};

const PALETTE_STORAGE_KEY = "delish_active_brand_palette";
const PALETTE_EVENT_NAME = "delish-palette-change";
export const STORE_SETTINGS_KEY = ["store_settings"] as const;

export function getStoredPaletteId(): string {
  if (typeof window === "undefined") return "gold";
  return localStorage.getItem(PALETTE_STORAGE_KEY) || "gold";
}

export function setStoredPaletteId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PALETTE_STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent(PALETTE_EVENT_NAME, { detail: id }));
}

/** Helper to update CSS custom properties on document element for site-wide styling. */
function applyThemeCssVariables(palette: BrandPalette) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", palette.main);
  root.style.setProperty("--theme-hover", palette.btnHoverBg);
  root.style.setProperty("--theme-light", palette.cardBg);
  root.style.setProperty("--theme-border", palette.border);
  root.style.setProperty("--theme-secondary", palette.secondary);
}

export function useBrandPalette() {
  const queryClient = useQueryClient();
  const [cachedPaletteId, setCachedPaletteId] = useState<string>(getStoredPaletteId);

  // Single source of truth: store_settings table in Supabase
  const { data: storeSettings, isSuccess } = useQuery({
    queryKey: STORE_SETTINGS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("card_color_palette")
        .eq("singleton", true)
        .maybeSingle();

      if (error) {
        console.warn("[store_settings] error fetching card_color_palette:", error);
        return null;
      }
      return data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // When database setting arrives, sync localStorage fallback so next visit is instantly aligned
  useEffect(() => {
    if (isSuccess && storeSettings?.card_color_palette && BRAND_PALETTES[storeSettings.card_color_palette]) {
      const dbPaletteId = storeSettings.card_color_palette;
      setStoredPaletteId(dbPaletteId);
      setCachedPaletteId(dbPaletteId);
    }
  }, [isSuccess, storeSettings?.card_color_palette]);

  // Keep tabs in sync via storage event
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PALETTE_STORAGE_KEY && event.newValue && BRAND_PALETTES[event.newValue]) {
        setCachedPaletteId(event.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Database is the single source of truth; cachedPaletteId is solely a transient fallback before DB resolves
  const dbPaletteId = storeSettings?.card_color_palette;
  const activePaletteId =
    dbPaletteId && BRAND_PALETTES[dbPaletteId]
      ? dbPaletteId
      : cachedPaletteId && BRAND_PALETTES[cachedPaletteId]
        ? cachedPaletteId
        : "gold";

  const activePalette: BrandPalette = BRAND_PALETTES[activePaletteId] ?? BRAND_PALETTES["gold"]!;

  // Apply CSS custom variables to document root whenever active palette changes
  useEffect(() => {
    applyThemeCssVariables(activePalette);
  }, [activePalette]);

  // Persist chosen palette to database (source of truth) and update query cache
  const changePalette = async (newId: string) => {
    if (!BRAND_PALETTES[newId]) return;

    // Optimistically update query cache and local cache
    setStoredPaletteId(newId);
    setCachedPaletteId(newId);
    applyThemeCssVariables(BRAND_PALETTES[newId]!);
    queryClient.setQueryData(STORE_SETTINGS_KEY, { card_color_palette: newId });

    // Save to Supabase store_settings table
    const { error } = await supabase
      .from("store_settings")
      .update({ card_color_palette: newId } as never)
      .eq("singleton", true);

    if (error) {
      console.error("[store_settings] failed to save card_color_palette:", error);
      // Invalidate to rollback on error
      await queryClient.invalidateQueries({ queryKey: STORE_SETTINGS_KEY });
      throw error;
    }

    await queryClient.invalidateQueries({ queryKey: STORE_SETTINGS_KEY });
  };

  return {
    paletteId: activePaletteId,
    setPalette: changePalette,
    palette: activePalette,
  };
}
