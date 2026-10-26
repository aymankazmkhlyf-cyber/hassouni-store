import { z } from "zod";
import { normalizePhone } from "@/lib/domain/phone";
import { isSafeHttpUrl } from "@/lib/domain/contact";
import { MAX_CART_LINES } from "@/lib/domain/cart";

/*
 * Error messages are translation keys from `dictionary.errors`, so the same
 * schema produces Arabic or English messages in the UI.
 */

const trimmed = (max: number) => z.string().trim().max(max, "tooLong");

export const phoneSchema = z
  .string()
  .trim()
  .max(30, "invalidPhone")
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "invalidPhone" });
      return z.NEVER;
    }
    return p;
  });

export const optionalEmail = z
  .string()
  .trim()
  .max(200, "invalidEmail")
  .transform((v) => v.toLowerCase())
  .pipe(z.union([z.literal(""), z.email("invalidEmail")]))
  .transform((v) => (v === "" ? null : v));

export const requiredEmail = z.string().trim().toLowerCase().max(200, "invalidEmail").pipe(z.email("invalidEmail"));

export const optionalUrl = z
  .string()
  .trim()
  .max(500, "tooLong")
  .refine((v) => v === "" || isSafeHttpUrl(v), "invalidUrl")
  .transform((v) => (v === "" ? null : v));

export const cartItemSchema = z.object({
  productId: z.number().int().positive(),
  packageId: z.number().int().positive().nullable(),
  quantity: z.number().int().min(1).max(1_000_000),
  inputs: z
    .record(z.string().max(40), z.string().max(2000))
    .refine((o) => Object.keys(o).length <= 20, "tooLong"),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

export const cartSchema = z.array(cartItemSchema).min(1, "cartEmpty").max(MAX_CART_LINES, "cartInvalid");

export const checkoutSchema = z.object({
  idempotencyKey: z.uuid(),
  customerName: trimmed(80).min(2, "validation"),
  customerPhone: phoneSchema,
  customerEmail: optionalEmail,
  paymentMethodId: z.coerce.number().int().positive("paymentMethod"),
  customerNotes: trimmed(1000).default(""),
  acceptTerms: z.literal("on", { message: "termsRequired" }),
  locale: z.enum(["ar", "en"]).default("ar"),
  items: cartSchema,
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const trackSchema = z.object({
  reference: z.string().trim().min(5).max(40),
  key: z.string().trim().min(10).max(60),
});

export const paymentProofSchema = z.object({
  customerReference: trimmed(100).default(""),
});

export const loginSchema = z.object({
  email: requiredEmail,
  password: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  name: trimmed(80).min(2, "validation"),
  email: requiredEmail,
  phone: z
    .string()
    .trim()
    .max(30)
    .transform((v, ctx) => {
      if (v === "") return null;
      const p = normalizePhone(v);
      if (!p) {
        ctx.addIssue({ code: "custom", message: "invalidPhone" });
        return z.NEVER;
      }
      return p;
    }),
  password: z.string().min(10, "passwordShort").max(200, "tooLong"),
});

export const customRequestSchema = z.object({
  name: trimmed(80).min(2, "validation"),
  phone: phoneSchema,
  email: optionalEmail,
  serviceType: z.enum(["social", "promotion", "accounts", "numbers", "gaming", "subscription", "design", "other"]),
  description: trimmed(3000).min(10, "validation"),
  quantity: z.union([z.literal("").transform(() => null), z.coerce.number().int().min(1).max(10_000_000)]),
  budget: z.union([z.literal("").transform(() => null), z.coerce.number().int().min(0).max(1_000_000_000)]),
  referenceUrl: optionalUrl,
  notes: trimmed(1000).default(""),
});

/* ------------------------------- Admin ------------------------------- */

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "validation");

/** HTML checkbox: present ("on") when checked, absent from FormData when not. */
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.null()])
  .optional()
  .transform((v) => v === "on" || v === "true");

const optionalInt = (min = 0) =>
  z.union([z.literal("").transform(() => null), z.null().transform(() => null), z.coerce.number().int().min(min).max(1_000_000_000)]);

export const categorySchema = z.object({
  slug,
  nameAr: trimmed(80).min(1),
  nameEn: trimmed(80).min(1),
  descriptionAr: trimmed(500).default(""),
  descriptionEn: trimmed(500).default(""),
  icon: trimmed(30).default("spark"),
  sortOrder: z.coerce.number().int().min(-10000).max(10000).default(0),
  isActive: checkbox,
});

export const productSchema = z
  .object({
    categoryId: z.coerce.number().int().positive(),
    slug,
    nameAr: trimmed(120).min(1),
    nameEn: trimmed(120).min(1),
    summaryAr: trimmed(300).default(""),
    summaryEn: trimmed(300).default(""),
    descriptionAr: trimmed(5000).default(""),
    descriptionEn: trimmed(5000).default(""),
    icon: trimmed(30).default("spark"),
    pricingMode: z.enum(["unit", "package"]),
    unitPrice: optionalInt(0),
    compareAtPrice: optionalInt(0),
    minQuantity: z.coerce.number().int().min(1).max(1_000_000).default(1),
    maxQuantity: optionalInt(1),
    deliveryTimeAr: trimmed(120).default(""),
    deliveryTimeEn: trimmed(120).default(""),
    isActive: checkbox,
    isFeatured: checkbox,
    isSample: checkbox,
    sortOrder: z.coerce.number().int().min(-10000).max(10000).default(0),
    packages: trimmed(5000).default(""),
    tiers: trimmed(2000).default(""),
    fields: trimmed(5000).default(""),
    removeImage: checkbox,
  })
  .superRefine((v, ctx) => {
    if (v.pricingMode === "unit" && v.unitPrice == null)
      ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "validation" });
    if (v.maxQuantity != null && v.maxQuantity < v.minQuantity)
      ctx.addIssue({ code: "custom", path: ["maxQuantity"], message: "validation" });
    if (v.compareAtPrice != null && v.unitPrice != null && v.compareAtPrice <= v.unitPrice)
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "validation" });
  });
export type ProductFormInput = z.infer<typeof productSchema>;

export const paymentMethodSchema = z.object({
  nameAr: trimmed(80).min(1),
  nameEn: trimmed(80).min(1),
  instructionsAr: trimmed(3000).default(""),
  instructionsEn: trimmed(3000).default(""),
  accountDetails: trimmed(300).default(""),
  requiresReference: checkbox,
  allowsReceipt: checkbox,
  isEnabled: checkbox,
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
});

export const statusChangeSchema = z.object({
  orderId: z.uuid(),
  toStatus: z.enum(["pending_payment", "payment_review", "paid", "processing", "completed", "cancelled", "rejected", "refunded"]),
  note: trimmed(500).default(""),
});

export const paymentReviewSchema = z.object({
  paymentId: z.uuid(),
  decision: z.enum(["confirm", "reject"]),
  note: trimmed(500).default(""),
});

export const adminNotesSchema = z.object({ orderId: z.uuid(), adminNotes: trimmed(5000).default("") });

/** Turns a ZodError into { field: errorKey } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
