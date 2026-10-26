import { describe, expect, it } from "vitest";
import { priceLine, quantityBounds, startingPrice, tierUnitPrice } from "@/lib/domain/pricing";
import { formatIQD, isValidIqdAmount, MAX_ORDER_TOTAL_IQD } from "@/lib/domain/money";

const unit = { id: 1, isActive: true, categoryActive: true, pricingMode: "unit" as const, unitPrice: 10, minQuantity: 100, maxQuantity: 20000 };
const pkgProduct = { ...unit, id: 2, pricingMode: "package" as const, unitPrice: null, minQuantity: 1, maxQuantity: 10 };
const packages = [
  { id: 11, productId: 2, price: 1500, isActive: true },
  { id: 12, productId: 2, price: 7000, isActive: true },
  { id: 13, productId: 2, price: 9999, isActive: false },
  { id: 99, productId: 3, price: 1, isActive: true },
];
const tiers = [
  { minQuantity: 1000, unitPrice: 8 },
  { minQuantity: 5000, unitPrice: 6 },
];

describe("tier pricing", () => {
  it("uses the highest tier whose threshold is met", () => {
    expect(tierUnitPrice(10, tiers, 999)).toBe(10);
    expect(tierUnitPrice(10, tiers, 1000)).toBe(8);
    expect(tierUnitPrice(10, tiers, 4999)).toBe(8);
    expect(tierUnitPrice(10, tiers, 5000)).toBe(6);
    expect(tierUnitPrice(10, [...tiers].reverse(), 6000)).toBe(6);
  });
});

describe("priceLine (unit mode)", () => {
  it("computes integer totals", () => {
    expect(priceLine(unit, [], tiers, { quantity: 1500 })).toEqual({ ok: true, unitPrice: 8, quantity: 1500, lineTotal: 12000 });
  });
  it("enforces min and max quantity", () => {
    expect(priceLine(unit, [], tiers, { quantity: 99 })).toEqual({ ok: false, error: "below_minimum" });
    expect(priceLine(unit, [], tiers, { quantity: 20001 })).toEqual({ ok: false, error: "above_maximum" });
  });
  it("rejects non-integer, zero, negative and unsafe quantities", () => {
    for (const q of [0, -5, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      expect(priceLine(unit, [], tiers, { quantity: q })).toEqual({ ok: false, error: "invalid_quantity" });
    }
  });
  it("rejects inactive products and inactive categories", () => {
    expect(priceLine({ ...unit, isActive: false }, [], [], { quantity: 100 })).toEqual({ ok: false, error: "product_unavailable" });
    expect(priceLine({ ...unit, categoryActive: false }, [], [], { quantity: 100 })).toEqual({ ok: false, error: "product_unavailable" });
  });
  it("refuses totals above the order cap", () => {
    const big = { ...unit, unitPrice: 1_000_000, minQuantity: 1, maxQuantity: null };
    expect(priceLine(big, [], [], { quantity: 1001 })).toEqual({ ok: false, error: "total_too_large" });
  });
});

describe("priceLine (package mode)", () => {
  it("prices whole packages", () => {
    expect(priceLine(pkgProduct, packages, [], { packageId: 12, quantity: 3 })).toEqual({ ok: true, unitPrice: 7000, quantity: 3, lineTotal: 21000 });
  });
  it("requires an active package that belongs to the product", () => {
    expect(priceLine(pkgProduct, packages, [], { packageId: null, quantity: 1 })).toEqual({ ok: false, error: "package_required" });
    expect(priceLine(pkgProduct, packages, [], { packageId: 13, quantity: 1 })).toEqual({ ok: false, error: "package_unavailable" });
    expect(priceLine(pkgProduct, packages, [], { packageId: 99, quantity: 1 })).toEqual({ ok: false, error: "package_unavailable" });
  });
  it("caps package quantity", () => {
    expect(quantityBounds(pkgProduct)).toEqual({ min: 1, max: 10 });
    expect(priceLine(pkgProduct, packages, [], { packageId: 11, quantity: 11 })).toEqual({ ok: false, error: "above_maximum" });
  });
});

describe("startingPrice and money", () => {
  it("shows the cheapest active package or min quantity total", () => {
    expect(startingPrice(pkgProduct, packages)).toBe(1);
    expect(startingPrice(pkgProduct, packages.filter((p) => p.productId === 2))).toBe(1500);
    expect(startingPrice(unit, [], tiers)).toBe(1000);
    expect(startingPrice({ ...unit, minQuantity: 1000 }, [], tiers)).toBe(8000);
  });
  it("formats IQD consistently in both locales", () => {
    expect(formatIQD(1234567, "ar")).toBe("1,234,567 د.ع");
    expect(formatIQD(1500, "en")).toBe("1,500 IQD");
  });
  it("validates IQD amounts", () => {
    expect(isValidIqdAmount(0)).toBe(true);
    expect(isValidIqdAmount(MAX_ORDER_TOTAL_IQD)).toBe(true);
    expect(isValidIqdAmount(MAX_ORDER_TOTAL_IQD + 1)).toBe(false);
    expect(isValidIqdAmount(1.5)).toBe(false);
    expect(isValidIqdAmount(-1)).toBe(false);
  });
});
