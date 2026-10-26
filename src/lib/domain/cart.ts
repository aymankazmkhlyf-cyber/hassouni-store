/** Client-side cart model. The cart is a convenience only — the server re-prices everything. */
export type CartLine = {
  /** Stable key: product + package + inputs, so different player IDs become different lines. */
  key: string;
  productId: number;
  slug: string;
  packageId: number | null;
  quantity: number;
  inputs: Record<string, string>;
  /** Display hints captured when added; replaced by the server quote on the cart page. */
  nameAr: string;
  nameEn: string;
  packageLabelAr: string | null;
  packageLabelEn: string | null;
  unitPriceHint: number;
};

export const MAX_CART_LINES = 20;

export function lineKey(productId: number, packageId: number | null, inputs: Record<string, string>): string {
  const sorted = Object.keys(inputs)
    .sort()
    .map((k) => `${k}=${inputs[k]}`)
    .join("&");
  return `${productId}:${packageId ?? "-"}:${sorted}`;
}

export function addLine(cart: CartLine[], line: Omit<CartLine, "key">): CartLine[] {
  const key = lineKey(line.productId, line.packageId, line.inputs);
  const existing = cart.find((l) => l.key === key);
  if (existing) return cart.map((l) => (l.key === key ? { ...l, quantity: l.quantity + line.quantity } : l));
  if (cart.length >= MAX_CART_LINES) return cart;
  return [...cart, { ...line, key }];
}

export function setQuantity(cart: CartLine[], key: string, quantity: number): CartLine[] {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return cart;
  return cart.map((l) => (l.key === key ? { ...l, quantity } : l));
}

export function removeLine(cart: CartLine[], key: string): CartLine[] {
  return cart.filter((l) => l.key !== key);
}

export function cartCount(cart: CartLine[]): number {
  return cart.length;
}

export function hintTotal(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.unitPriceHint * l.quantity, 0);
}

/** Defensive parse of whatever is in localStorage. */
export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (l): l is CartLine =>
          typeof l === "object" && l !== null &&
          typeof (l as CartLine).productId === "number" &&
          typeof (l as CartLine).quantity === "number" &&
          typeof (l as CartLine).key === "string" &&
          typeof (l as CartLine).inputs === "object",
      )
      .slice(0, MAX_CART_LINES);
  } catch {
    return [];
  }
}
