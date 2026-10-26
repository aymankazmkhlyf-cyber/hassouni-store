import { db, type DbOrTx } from "@/lib/db";
import type { OrderItemInput } from "@/lib/db/schema";
import { MAX_ORDER_TOTAL_IQD } from "@/lib/domain/money";
import { priceLine, type PriceErrorCode } from "@/lib/domain/pricing";
import { validateFieldValues, type FieldError } from "@/lib/domain/fields";
import type { CartItemInput } from "@/lib/validation/schemas";
import { loadPricingData } from "./catalog";

export type QuotedLine =
  | {
      ok: true;
      index: number;
      productId: number;
      packageId: number | null;
      slug: string;
      nameAr: string;
      nameEn: string;
      packageLabelAr: string | null;
      packageLabelEn: string | null;
      isSample: boolean;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
      inputs: OrderItemInput[];
    }
  | {
      ok: false;
      index: number;
      productId: number;
      error: PriceErrorCode | "fields";
      fieldErrors?: (FieldError & { labelAr: string; labelEn: string })[];
    };

export type Quote = { lines: QuotedLine[]; total: number; valid: boolean };

/**
 * Re-prices a cart from the database. This is the ONLY place totals come from:
 * the cart page displays it and order creation persists it.
 */
export async function quoteCart(items: CartItemInput[], conn: DbOrTx = db): Promise<Quote> {
  const data = await loadPricingData(
    items.map((i) => i.productId),
    conn,
  );
  const byId = new Map(data.map((p) => [p.id, p]));

  const lines: QuotedLine[] = items.map((item, index) => {
    const product = byId.get(item.productId);
    if (!product) return { ok: false, index, productId: item.productId, error: "product_unavailable" };

    const priced = priceLine(
      { ...product, categoryActive: product.category.isActive },
      product.packages,
      product.tiers,
      { packageId: item.packageId, quantity: item.quantity },
    );
    if (!priced.ok) return { ok: false, index, productId: product.id, error: priced.error };

    const fields = validateFieldValues(product.fields, item.inputs);
    if (!fields.ok) {
      return {
        ok: false,
        index,
        productId: product.id,
        error: "fields",
        fieldErrors: fields.errors.map((e) => {
          const def = product.fields.find((f) => f.key === e.key);
          return { ...e, labelAr: def?.labelAr ?? e.key, labelEn: def?.labelEn ?? e.key };
        }),
      };
    }

    const pkg = product.pricingMode === "package" ? product.packages.find((p) => p.id === item.packageId) : undefined;
    return {
      ok: true,
      index,
      productId: product.id,
      packageId: pkg?.id ?? null,
      slug: product.slug,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      packageLabelAr: pkg?.labelAr ?? null,
      packageLabelEn: pkg?.labelEn ?? null,
      isSample: product.isSample,
      unitPrice: priced.unitPrice,
      quantity: priced.quantity,
      lineTotal: priced.lineTotal,
      inputs: fields.values,
    };
  });

  const total = lines.reduce((sum, l) => (l.ok ? sum + l.lineTotal : sum), 0);
  const valid = lines.length > 0 && lines.every((l) => l.ok) && total <= MAX_ORDER_TOTAL_IQD;
  return { lines, total, valid };
}
