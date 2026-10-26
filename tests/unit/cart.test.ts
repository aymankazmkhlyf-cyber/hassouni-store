import { describe, expect, it } from "vitest";
import { addLine, hintTotal, lineKey, MAX_CART_LINES, parseStoredCart, removeLine, setQuantity, type CartLine } from "@/lib/domain/cart";

const base = { productId: 1, slug: "x", packageId: 5, quantity: 1, inputs: { player_id: "1" }, nameAr: "س", nameEn: "X", packageLabelAr: null, packageLabelEn: null, unitPriceHint: 1500 };

describe("cart", () => {
  it("merges identical lines and keeps different inputs separate", () => {
    let c: CartLine[] = [];
    c = addLine(c, base);
    c = addLine(c, { ...base, quantity: 2 });
    expect(c).toHaveLength(1);
    expect(c[0]!.quantity).toBe(3);
    c = addLine(c, { ...base, inputs: { player_id: "2" } });
    expect(c).toHaveLength(2);
  });
  it("line keys are independent of input key order", () => {
    expect(lineKey(1, null, { a: "1", b: "2" })).toBe(lineKey(1, null, { b: "2", a: "1" }));
  });
  it("updates and removes lines, ignoring invalid quantities", () => {
    let c = addLine([], base);
    const key = c[0]!.key;
    c = setQuantity(c, key, 4);
    expect(c[0]!.quantity).toBe(4);
    expect(setQuantity(c, key, 0)).toBe(c);
    expect(setQuantity(c, key, 2.5)).toBe(c);
    expect(removeLine(c, key)).toEqual([]);
  });
  it("calculates a display hint total", () => {
    const c = addLine(addLine([], base), { ...base, packageId: 6, unitPriceHint: 7000, quantity: 2 });
    expect(hintTotal(c)).toBe(1500 + 14000);
  });
  it("limits the number of lines", () => {
    let c: CartLine[] = [];
    for (let i = 0; i < MAX_CART_LINES + 5; i++) c = addLine(c, { ...base, productId: i });
    expect(c).toHaveLength(MAX_CART_LINES);
  });
  it("survives corrupted localStorage", () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart("{not json")).toEqual([]);
    expect(parseStoredCart('{"a":1}')).toEqual([]);
    expect(parseStoredCart('[{"productId":"1"}]')).toEqual([]);
    const ok = addLine([], base);
    expect(parseStoredCart(JSON.stringify(ok))).toEqual(ok);
  });
});
