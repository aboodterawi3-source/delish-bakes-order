import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SERVING_SIZE_OFFSETS, type LineSpec } from "@/lib/order-pricing";
import { roundJod } from "@/lib/currency";

function canonicalSize(size?: string | null): string {
  if (!size) return "default";
  const trimmed = size.trim().toLowerCase();
  for (const s of SERVING_SIZE_OFFSETS) {
    if (
      s.label.toLowerCase() === trimmed ||
      s.ar.toLowerCase() === trimmed ||
      trimmed.includes(s.label.toLowerCase()) ||
      trimmed.includes(s.ar.toLowerCase())
    ) {
      return s.label;
    }
  }
  return trimmed;
}

/**
 * Generates an immutable, language-invariant cart line key based on permanent IDs
 * and chosen specifications (product ID, size, filling, options, notes, unit price),
 * preventing item duplication when the customer toggles between Arabic and English.
 */
export function generateCartLineKey(line: Omit<CartLine, "key"> & { key?: string }): string {
  if (line.key && line.key.trim()) {
    return line.key.trim();
  }

  const spec = line.spec;
  if (spec) {
    if (spec.kind === "cms") {
      const normalizedSize = canonicalSize(spec.size);
      const notes = (line.notes ?? "").trim().toLowerCase();
      const design = (line.designImage ?? "").trim();
      return `cms:${spec.productId}:${normalizedSize}:${notes}:${design}:${line.unit}`;
    }

    if (spec.kind === "catalog") {
      const sizeId = spec.sizeId?.trim().toLowerCase() || "default";
      const flavorId = spec.flavorId?.trim().toLowerCase() || "default";
      const notes = (line.notes ?? "").trim().toLowerCase();
      return `catalog:${spec.productId}:${sizeId}:${flavorId}:${notes}:${line.unit}`;
    }

    if (spec.kind === "builder") {
      const msg = (spec.message ?? "").trim().toLowerCase();
      const design = (line.designImage ?? "").trim();
      return `builder:${spec.sizeId}:${spec.flavorId}:${spec.fillingId}:${spec.frostingId}:${msg}:${design}:${line.unit}`;
    }
  }

  // Fallback if spec is missing: use stable normalized representation
  const notes = (line.notes ?? "").trim().toLowerCase();
  const design = (line.designImage ?? "").trim();
  return `item:${line.unit}:${notes}:${design}`;
}

export type CartLine = {
  key: string;
  ar: string;
  en: string;
  unit: number;
  qty: number;
  image?: string | undefined;
  designImage?: string | undefined;
  detailsAr: string[];
  detailsEn: string[];
  /** Customer-picked extras saved with the order and shown to kitchen/sales. */
  extrasAr?: string[] | undefined;
  extrasEn?: string[] | undefined;
  notes?: string | undefined;
  /** Trusted description of the choice; the server re-prices from this. */
  spec?: LineSpec | undefined;
};

type Ctx = {
  lines: CartLine[];
  add: (l: Omit<CartLine, "key"> & { key?: string }) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<Ctx | null>(null);

export const CART_SCHEMA_VERSION = 1;

/** The cart survives page navigation and reloads via localStorage. */
const STORAGE_KEY = "delish-cart";

interface StoredCartEnvelope {
  version: number;
  lines: CartLine[];
}

/** Strictly validates stored object structure to protect against undefined errors from older or modified schemas */
function isValidCartLine(line: unknown): line is CartLine {
  if (!line || typeof line !== "object") return false;
  const l = line as any;

  return (
    typeof l.key === "string" &&
    l.key.length > 0 &&
    typeof l.unit === "number" &&
    !isNaN(l.unit) &&
    l.unit >= 0 &&
    typeof l.qty === "number" &&
    !isNaN(l.qty) &&
    l.qty > 0 &&
    typeof l.ar === "string" &&
    typeof l.en === "string" &&
    Array.isArray(l.detailsAr) &&
    Array.isArray(l.detailsEn)
  );
}

function readStored(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);

    // Schema envelope format
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const envelope = parsed as Partial<StoredCartEnvelope>;
      // If version is outdated or corrupted, safely reset
      if (envelope.version !== CART_SCHEMA_VERSION || !Array.isArray(envelope.lines)) {
        window.localStorage.removeItem(STORAGE_KEY);
        return [];
      }
      return envelope.lines.filter(isValidCartLine);
    }

    // Legacy unversioned array format: migrate if valid, or clear
    if (Array.isArray(parsed)) {
      const validLines = parsed.filter(isValidCartLine);
      try {
        const envelope: StoredCartEnvelope = { version: CART_SCHEMA_VERSION, lines: validLines };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      } catch {
        /* storage blocked */
      }
      return validLines;
    }

    return [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore after hydration so server and client markup match.
  useEffect(() => {
    setLines(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const envelope: StoredCartEnvelope = {
        version: CART_SCHEMA_VERSION,
        lines,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      /* storage full or blocked — the cart still works for this session */
    }
  }, [lines, hydrated]);

  // Keep other open tabs of the shop in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add: Ctx["add"] = (line) => {
    const key = generateCartLineKey(line);
    setLines((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) {
        return prev.map((l) =>
          l.key === key
            ? {
                ...l,
                qty: l.qty + line.qty,
                ar: line.ar || l.ar,
                en: line.en || l.en,
                detailsAr: line.detailsAr?.length ? line.detailsAr : l.detailsAr,
                detailsEn: line.detailsEn?.length ? line.detailsEn : l.detailsEn,
              }
            : l,
        );
      }
      return [...prev, { ...line, key }];
    });
  };

  const remove = (key: string) => setLines((p) => p.filter((l) => l.key !== key));
  const setQty = (key: string, qty: number) =>
    setLines((p) =>
      qty <= 0 ? p.filter((l) => l.key !== key) : p.map((l) => (l.key === key ? { ...l, qty } : l)),
    );
  const clear = () => setLines([]);

  const value = useMemo(
    () => ({
      lines,
      add,
      remove,
      setQty,
      clear,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: roundJod(lines.reduce((s, l) => s + l.qty * l.unit, 0)),
    }),
    [lines],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
