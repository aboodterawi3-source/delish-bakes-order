import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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
  spec: LineSpec;
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

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
