import { MAX_ORDER_TOTAL_IQD } from "./money";

export type PricingProduct = {
  id: number;
  isActive: boolean;
  categoryActive: boolean;
  pricingMode: "unit" | "package";
  unitPrice: number | null;
  minQuantity: number;
  maxQuantity: number | null;
};
export type PricingPackage = { id: number; productId: number; price: number; isActive: boolean };
export type PricingTier = { minQuantity: number; unitPrice: number };

export type PriceErrorCode =
  | "product_unavailable"
  | "package_required"
  | "package_unavailable"
  | "invalid_quantity"
  | "below_minimum"
  | "above_maximum"
  | "total_too_large";

export type PriceResult =
  | { ok: true; unitPrice: number; quantity: number; lineTotal: number }
  | { ok: false; error: PriceErrorCode };

/** Effective unit price for a quantity: the highest tier whose threshold is met, else the base price. */
export function tierUnitPrice(basePrice: number, tiers: PricingTier[], quantity: number): number {
  let best: PricingTier | undefined;
  for (const tier of tiers) {
    if (quantity >= tier.minQuantity && (!best || tier.minQuantity > best.minQuantity)) best = tier;
  }
  return best ? best.unitPrice : basePrice;
}

export function quantityBounds(product: Pick<PricingProduct, "pricingMode" | "minQuantity" | "maxQuantity">) {
  // Packages are bought as whole packages; quantity is the number of packages.
  if (product.pricingMode === "package") return { min: 1, max: product.maxQuantity ?? 20 };
  return { min: product.minQuantity, max: product.maxQuantity ?? 1_000_000 };
}

/**
 * Authoritative line price calculation. Runs on the server against database
 * rows only — prices sent by the browser are never used.
 */
export function priceLine(
  product: PricingProduct,
  packages: PricingPackage[],
  tiers: PricingTier[],
  selection: { packageId?: number | null; quantity: number },
): PriceResult {
  if (!product.isActive || !product.categoryActive) return { ok: false, error: "product_unavailable" };

  const { quantity } = selection;
  if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, error: "invalid_quantity" };

  const bounds = quantityBounds(product);
  if (quantity < bounds.min) return { ok: false, error: "below_minimum" };
  if (quantity > bounds.max) return { ok: false, error: "above_maximum" };

  let unitPrice: number;
  if (product.pricingMode === "package") {
    if (selection.packageId == null) return { ok: false, error: "package_required" };
    const pkg = packages.find((p) => p.id === selection.packageId && p.productId === product.id);
    if (!pkg || !pkg.isActive) return { ok: false, error: "package_unavailable" };
    unitPrice = pkg.price;
  } else {
    if (product.unitPrice == null) return { ok: false, error: "product_unavailable" };
    unitPrice = tierUnitPrice(product.unitPrice, tiers, quantity);
  }

  const lineTotal = unitPrice * quantity;
  if (!Number.isSafeInteger(lineTotal) || lineTotal > MAX_ORDER_TOTAL_IQD) return { ok: false, error: "total_too_large" };
  return { ok: true, unitPrice, quantity, lineTotal };
}

/** "From" price for listings. */
export function startingPrice(
  product: Pick<PricingProduct, "pricingMode" | "unitPrice" | "minQuantity">,
  packages: Pick<PricingPackage, "price" | "isActive">[],
  tiers: PricingTier[] = [],
): number | null {
  if (product.pricingMode === "package") {
    const active = packages.filter((p) => p.isActive).map((p) => p.price);
    return active.length ? Math.min(...active) : null;
  }
  if (product.unitPrice == null) return null;
  return tierUnitPrice(product.unitPrice, tiers, product.minQuantity) * product.minQuantity;
}
