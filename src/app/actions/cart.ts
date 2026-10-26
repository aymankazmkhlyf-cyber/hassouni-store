"use server";

import { z } from "zod";
import { cartItemSchema } from "@/lib/validation/schemas";
import { MAX_CART_LINES } from "@/lib/domain/cart";
import { quoteCart, type Quote } from "@/lib/services/quote";

const input = z.array(cartItemSchema).max(MAX_CART_LINES);

/** Read-only: returns server-calculated prices for the cart page. */
export async function quoteCartAction(items: unknown): Promise<Quote | { error: "cartInvalid" }> {
  const parsed = input.safeParse(items);
  if (!parsed.success) return { error: "cartInvalid" };
  if (parsed.data.length === 0) return { lines: [], total: 0, valid: false };
  return quoteCart(parsed.data);
}
