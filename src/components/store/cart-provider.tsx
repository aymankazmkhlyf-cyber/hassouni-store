"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addLine, parseStoredCart, removeLine, setQuantity, type CartLine } from "@/lib/domain/cart";

const STORAGE_KEY = "hds_cart_v1";

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  add: (line: Omit<CartLine, "key">) => boolean;
  update: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function read(): CartLine[] {
  try {
    return parseStoredCart(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable (private mode) — cart still works for this page view */
  }
}

/**
 * Cart persisted in localStorage so it survives refreshes. It is only a
 * convenience: the server re-validates and re-prices every line.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLinesState] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  // Latest cart, so several add() calls in one event (e.g. "order again") build on each other.
  const latest = useRef<CartLine[]>([]);
  const setLines = useCallback((next: CartLine[]) => {
    latest.current = next;
    setLinesState(next);
  }, []);

  useEffect(() => {
    setLines(read());
    setReady(true);
    // Keep multiple tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback(
    (next: (prev: CartLine[]) => CartLine[]) => {
      const value = next(latest.current);
      write(value);
      setLines(value);
    },
    [setLines],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      add: (line) => {
        const prev = latest.current;
        const next = addLine(prev, line);
        if (next === prev) return false;
        write(next);
        setLines(next);
        return true;
      },
      update: (key, quantity) => commit((prev) => setQuantity(prev, key, quantity)),
      remove: (key) => commit((prev) => removeLine(prev, key)),
      clear: () => commit(() => []),
    }),
    [lines, ready, commit, setLines],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
