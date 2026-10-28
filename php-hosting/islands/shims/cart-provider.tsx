/*
 * Shared cart store for the PHP site. Every island is its own React root, so
 * the original <CartProvider> context is replaced by one module-level store
 * (same localStorage key and the same add/update/remove rules).
 */
import { useSyncExternalStore } from "react";
import { addLine, parseStoredCart, removeLine, setQuantity, type CartLine } from "@/lib/domain/cart";

const STORAGE_KEY = "hds_cart_v1";

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

let lines: CartLine[] = typeof window === "undefined" ? [] : read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function set(next: CartLine[]) {
  lines = next;
  write(next);
  emit();
}

if (typeof window !== "undefined") {
  // Keep multiple tabs in sync.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      lines = read();
      emit();
    }
  });
}

const api = {
  add: (line: Omit<CartLine, "key">) => {
    const next = addLine(lines, line);
    if (next === lines) return false;
    set(next);
    return true;
  },
  update: (key: string, quantity: number) => set(setQuantity(lines, key, quantity)),
  remove: (key: string) => set(removeLine(lines, key)),
  clear: () => set([]),
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useCart() {
  const current = useSyncExternalStore(subscribe, () => lines, () => lines);
  return { lines: current, ready: true, ...api };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
