import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LineSpec } from "@/lib/order-pricing";
import { roundJod } from "@/lib/currency";

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
  const l = line as Record<string, unknown>;

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
    const key =
      line.key ?? `${line.en}|${line.detailsEn.join(",")}|${line.notes ?? ""}|${line.unit}`;
    setLines((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + line.qty } : l));
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
