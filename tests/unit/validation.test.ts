import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizePhone, maskPhone } from "@/lib/domain/phone";
import { validateFieldValues, isForbiddenFieldKey, type FieldDef } from "@/lib/domain/fields";
import { checkoutSchema, registerSchema, customRequestSchema } from "@/lib/validation/schemas";

describe("Iraqi phone normalization", () => {
  it.each([
    ["07701234567", "+9647701234567"],
    ["0770 123 4567", "+9647701234567"],
    ["7701234567", "+9647701234567"],
    ["9647701234567", "+9647701234567"],
    ["+964 770-123-4567", "+9647701234567"],
    ["009647701234567", "+9647701234567"],
    ["٠٧٧٠١٢٣٤٥٦٧", "+9647701234567"],
    ["+14155550123", "+14155550123"],
  ])("%s -> %s", (input, out) => expect(normalizePhone(input)).toBe(out));
  it.each(["", "123", "0770123456", "+96412345", "abc", "07701234567x"])("rejects %s", (input) => expect(normalizePhone(input)).toBeNull());
  it("masks phones", () => expect(maskPhone("+9647757382822")).toBe("+96477****2822"));
});

describe("product field validation", () => {
  const defs: FieldDef[] = [
    { key: "player_id", labelAr: "رقم", labelEn: "ID", type: "number", required: true, maxLength: 20, options: [] },
    { key: "link", labelAr: "رابط", labelEn: "Link", type: "url", required: false, maxLength: 300, options: [] },
    { key: "fmt", labelAr: "نوع", labelEn: "Format", type: "select", required: true, maxLength: 20, options: [{ value: "print", labelAr: "", labelEn: "" }] },
  ];
  it("accepts valid values and drops unknown keys", () => {
    const r = validateFieldValues(defs, { player_id: " 123 ", fmt: "print", extra: "smuggled" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.map((v) => [v.key, v.value])).toEqual([["player_id", "123"], ["fmt", "print"]]);
  });
  it("reports missing, invalid and too-long values", () => {
    const r = validateFieldValues(defs, { player_id: "12a", link: "javascript:alert(1)", fmt: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toEqual(["fieldInvalid", "fieldInvalid", "fieldInvalid"]);
    const r2 = validateFieldValues(defs, { player_id: "1".repeat(25) });
    if (!r2.ok) expect(r2.errors[0]).toEqual({ key: "player_id", code: "tooLong" });
  });
  it("refuses credential-like field keys", () => {
    for (const k of ["password", "account_pass", "otp_code", "cvv", "card_number", "pin"]) expect(isForbiddenFieldKey(k)).toBe(true);
    expect(isForbiddenFieldKey("player_id")).toBe(false);
    const r = validateFieldValues([{ ...defs[0]!, key: "password", required: true }], {});
    expect(r.ok).toBe(true); // forbidden field definitions are ignored entirely
  });
});

describe("checkout schema", () => {
  const valid = {
    idempotencyKey: randomUUID(),
    customerName: "Ali",
    customerPhone: "07701234567",
    customerEmail: "",
    paymentMethodId: "1",
    customerNotes: "",
    acceptTerms: "on",
    locale: "ar",
    items: [{ productId: 1, packageId: null, quantity: 1, inputs: {} }],
  };
  it("normalizes input", () => {
    const r = checkoutSchema.parse(valid);
    expect(r.customerPhone).toBe("+9647701234567");
    expect(r.customerEmail).toBeNull();
    expect(r.paymentMethodId).toBe(1);
  });
  it("requires terms acceptance, a valid phone and a non-empty cart", () => {
    expect(checkoutSchema.safeParse({ ...valid, acceptTerms: undefined }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, customerPhone: "123" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, idempotencyKey: "x" }).success).toBe(false);
  });
  it("has no price fields — anything price-like from the client is stripped", () => {
    const r = checkoutSchema.parse({ ...valid, total: 1, items: [{ ...valid.items[0], unitPrice: 1, lineTotal: 1 }] });
    expect(r).not.toHaveProperty("total");
    expect(r.items[0]).not.toHaveProperty("unitPrice");
  });
  it("rejects bad quantities in the payload", () => {
    for (const quantity of [0, -1, 1.5, "3"]) {
      expect(checkoutSchema.safeParse({ ...valid, items: [{ ...valid.items[0], quantity }] }).success).toBe(false);
    }
  });
});

describe("other schemas", () => {
  it("register requires a 10+ char password and valid email", () => {
    expect(registerSchema.safeParse({ name: "Ali", email: "a@b.co", phone: "", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ali", email: "nope", phone: "", password: "long-enough-pw" }).success).toBe(false);
    const ok = registerSchema.parse({ name: "Ali", email: "A@B.CO", phone: "", password: "long-enough-pw" });
    expect(ok.email).toBe("a@b.co");
    expect(ok.phone).toBeNull();
  });
  it("custom request rejects unsafe reference URLs", () => {
    const base = { name: "Ali", phone: "07701234567", email: "", serviceType: "design", description: "A poster for my shop", quantity: "", budget: "", referenceUrl: "", notes: "" };
    expect(customRequestSchema.safeParse(base).success).toBe(true);
    expect(customRequestSchema.safeParse({ ...base, referenceUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("admin form checkboxes", () => {
  it("unchecked checkboxes (absent from FormData) parse as false", async () => {
    const { categorySchema } = await import("@/lib/validation/schemas");
    const r = categorySchema.parse({ slug: "x-y", nameAr: "س", nameEn: "X" });
    expect(r.isActive).toBe(false);
    expect(categorySchema.parse({ slug: "x-y", nameAr: "س", nameEn: "X", isActive: "on" }).isActive).toBe(true);
  });
});
