import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LineSpec } from "@/lib/order-pricing";

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

/** The cart survives page navigation and reloads via localStorage. */
const STORAGE_KEY = "delish-cart";

function readStored(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is CartLine =>
        !!line && typeof line === "object" && typeof (line as CartLine).key === "string",
    );
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
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
    const key = line.key ?? `${line.en}|${line.detailsEn.join(",")}|${line.notes ?? ""}|${line.unit}`;
    setLines((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + line.qty } : l));
      return [...prev, { ...line, key }];
    });
  };

  const remove = (key: string) => setLines((p) => p.filter((l) => l.key !== key));
  const setQty = (key: string, qty: number) =>
    setLines((p) => (qty <= 0 ? p.filter((l) => l.key !== key) : p.map((l) => (l.key === key ? { ...l, qty } : l))));
  const clear = () => setLines([]);

  const value = useMemo(
    () => ({
      lines,
      add,
      remove,
      setQty,
      clear,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + l.qty * l.unit, 0),
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
