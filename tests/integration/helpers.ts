import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentMethods, products, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import type { CheckoutInput } from "@/lib/validation/schemas";
import type { Actor } from "@/lib/services/audit";

export const hasDb = !!process.env.TEST_DATABASE_URL;

export async function productBySlug(slug: string) {
  const p = await db.query.products.findFirst({ where: eq(products.slug, slug), with: { packages: true, tiers: true, fields: true } });
  if (!p) throw new Error(`seed product ${slug} missing`);
  return p;
}

export async function enabledMethodId(code = "zain_cash") {
  const m = await db.query.paymentMethods.findFirst({ where: eq(paymentMethods.code, code) });
  if (!m) throw new Error("payment method missing");
  return m.id;
}

export async function checkoutInput(overrides: Partial<CheckoutInput> = {}): Promise<CheckoutInput> {
  const pubg = await productBySlug("pubg-mobile-uc");
  return {
    idempotencyKey: randomUUID(),
    customerName: "Test Customer",
    // A fresh phone per order, so tests do not trip the "same order already in progress" guard.
    customerPhone: `+96477${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
    customerEmail: null,
    paymentMethodId: await enabledMethodId(),
    customerNotes: "",
    acceptTerms: "on",
    locale: "ar",
    items: [{ productId: pubg.id, packageId: pubg.packages[1]!.id, quantity: 2, inputs: { player_id: "5123456789" } }],
    ...overrides,
  };
}

export async function makeUser(role: "customer" | "staff" | "admin", email = `${role}-${randomUUID()}@example.test`): Promise<Actor & { password: string }> {
  const password = "a-strong-test-password";
  const [u] = await db.insert(users).values({ email, name: role, passwordHash: await hashPassword(password), role }).returning();
  return { id: u!.id, email: u!.email, role, password };
}
