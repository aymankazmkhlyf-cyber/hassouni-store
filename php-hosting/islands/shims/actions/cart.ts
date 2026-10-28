import type { Quote } from "@/lib/services/quote";
import { jsonAction } from "./client";
export const quoteCartAction = jsonAction<Quote | { error: "cartInvalid" }>("cart.quote");
