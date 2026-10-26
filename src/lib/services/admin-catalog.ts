import { asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import {
  categories,
  orderItems,
  paymentMethods,
  priceTiers,
  productFields,
  productPackages,
  products,
} from "@/lib/db/schema";
import { parseFields, parsePackages, parseTiers } from "@/lib/domain/admin-parse";
import type { ProductFormInput } from "@/lib/validation/schemas";
import type { z } from "zod";
import type { categorySchema, paymentMethodSchema } from "@/lib/validation/schemas";
import { audit, type Actor } from "./audit";
import { ServiceError } from "./orders";
import { escapeLike } from "./catalog";

/* ------------------------------- Products ------------------------------ */

export async function adminListProducts(opts: { q?: string; page?: number }, conn: DbOrTx = db) {
  const pageSize = 25;
  const page = Math.max(opts.page ?? 1, 1);
  const q = opts.q?.trim().slice(0, 80);
  const pattern = q ? `%${escapeLike(q)}%` : "";
  const where = q ? or(ilike(products.nameAr, pattern), ilike(products.nameEn, pattern), ilike(products.slug, pattern)) : undefined;
  const [rows, totalRow] = await Promise.all([
    conn
      .select({
        id: products.id,
        slug: products.slug,
        nameAr: products.nameAr,
        nameEn: products.nameEn,
        pricingMode: products.pricingMode,
        unitPrice: products.unitPrice,
        isActive: products.isActive,
        isFeatured: products.isFeatured,
        isSample: products.isSample,
        categoryNameAr: categories.nameAr,
        categoryNameEn: categories.nameEn,
        packageCount: sql<number>`(SELECT count(*) FROM product_packages pp WHERE pp.product_id = "products"."id")`.mapWith(Number),
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(where)
      .orderBy(asc(categories.sortOrder), asc(products.sortOrder), asc(products.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    conn.select({ n: count() }).from(products).where(where),
  ]);
  const total = totalRow[0]?.n ?? 0;
  return { rows, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function adminGetProduct(id: number, conn: DbOrTx = db) {
  return conn.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      packages: { orderBy: [asc(productPackages.sortOrder), asc(productPackages.id)] },
      tiers: { orderBy: asc(priceTiers.minQuantity) },
      fields: { orderBy: [asc(productFields.sortOrder), asc(productFields.id)] },
    },
  });
}

export type ProductSaveError = { field: "packages" | "tiers" | "fields" | "slug" | "categoryId"; line?: number; reason: string };

/**
 * Creates or updates a product with its packages, tiers and fields in one transaction.
 * Packages are updated in place by position so existing order-item links survive edits.
 */
export async function saveProduct(
  id: number | null,
  input: ProductFormInput,
  image: { fileId: string | null; remove: boolean },
  actor: Actor,
  conn: DbOrTx = db,
): Promise<{ ok: true; id: number } | { ok: false; error: ProductSaveError }> {
  const pk = parsePackages(input.packages);
  if (!pk.ok) return { ok: false, error: { field: "packages", line: pk.line, reason: pk.reason } };
  const tiers = parseTiers(input.tiers);
  if (!tiers.ok) return { ok: false, error: { field: "tiers", line: tiers.line, reason: tiers.reason } };
  const fields = parseFields(input.fields);
  if (!fields.ok) return { ok: false, error: { field: "fields", line: fields.line, reason: fields.reason } };
  if (input.pricingMode === "package" && pk.value.length === 0)
    return { ok: false, error: { field: "packages", reason: "required" } };

  return conn.transaction(async (tx) => {
    const cat = await tx.query.categories.findFirst({ where: eq(categories.id, input.categoryId) });
    if (!cat) return { ok: false as const, error: { field: "categoryId" as const, reason: "missing" } };
    const clash = await tx.query.products.findFirst({ where: eq(products.slug, input.slug) });
    if (clash && clash.id !== id) return { ok: false as const, error: { field: "slug" as const, reason: "taken" } };

    const values = {
      categoryId: input.categoryId,
      slug: input.slug,
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      summaryAr: input.summaryAr,
      summaryEn: input.summaryEn,
      descriptionAr: input.descriptionAr,
      descriptionEn: input.descriptionEn,
      icon: input.icon,
      pricingMode: input.pricingMode,
      unitPrice: input.unitPrice,
      compareAtPrice: input.pricingMode === "unit" ? input.compareAtPrice : null,
      minQuantity: input.pricingMode === "unit" ? input.minQuantity : 1,
      maxQuantity: input.maxQuantity,
      deliveryTimeAr: input.deliveryTimeAr,
      deliveryTimeEn: input.deliveryTimeEn,
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      isSample: input.isSample,
      sortOrder: input.sortOrder,
      ...(image.fileId ? { imageFileId: image.fileId } : image.remove ? { imageFileId: null } : {}),
    };

    let productId: number;
    if (id == null) {
      const [row] = await tx.insert(products).values(values).returning({ id: products.id });
      productId = row!.id;
    } else {
      const [row] = await tx.update(products).set(values).where(eq(products.id, id)).returning({ id: products.id });
      if (!row) throw new ServiceError("notFound");
      productId = row.id;
    }

    // Packages: update by position, insert extras, delete leftovers (order items keep snapshots).
    const existing = await tx
      .select({ id: productPackages.id })
      .from(productPackages)
      .where(eq(productPackages.productId, productId))
      .orderBy(asc(productPackages.sortOrder), asc(productPackages.id));
    for (let i = 0; i < pk.value.length; i++) {
      const p = pk.value[i]!;
      const row = { labelAr: p.labelAr, labelEn: p.labelEn, price: p.price, compareAtPrice: p.compareAtPrice, sortOrder: i, isActive: true };
      const current = existing[i];
      if (current) await tx.update(productPackages).set(row).where(eq(productPackages.id, current.id));
      else await tx.insert(productPackages).values({ ...row, productId });
    }
    for (const leftover of existing.slice(pk.value.length)) {
      await tx.delete(productPackages).where(eq(productPackages.id, leftover.id));
    }

    await tx.delete(priceTiers).where(eq(priceTiers.productId, productId));
    if (input.pricingMode === "unit" && tiers.value.length)
      await tx.insert(priceTiers).values(tiers.value.map((t) => ({ ...t, productId })));

    await tx.delete(productFields).where(eq(productFields.productId, productId));
    if (fields.value.length)
      await tx.insert(productFields).values(fields.value.map((f, i) => ({ ...f, productId, sortOrder: i })));

    await audit(actor, id == null ? "product.create" : "product.update", "product", productId, { slug: input.slug }, tx);
    return { ok: true as const, id: productId };
  });
}

/** Deletes a product, or deactivates it when historical orders reference it. */
export async function deleteProduct(id: number, actor: Actor, conn: DbOrTx = db): Promise<"deleted" | "deactivated"> {
  return conn.transaction(async (tx) => {
    const [used] = await tx.select({ n: count() }).from(orderItems).where(eq(orderItems.productId, id));
    if ((used?.n ?? 0) > 0) {
      await tx.update(products).set({ isActive: false, isFeatured: false }).where(eq(products.id, id));
      await audit(actor, "product.deactivate", "product", id, {}, tx);
      return "deactivated" as const;
    }
    await tx.delete(products).where(eq(products.id, id));
    await audit(actor, "product.delete", "product", id, {}, tx);
    return "deleted" as const;
  });
}

/* ------------------------------ Categories ----------------------------- */

type CategoryInput = z.infer<typeof categorySchema>;

export async function saveCategory(id: number | null, input: CategoryInput, actor: Actor, conn: DbOrTx = db) {
  return conn.transaction(async (tx) => {
    const clash = await tx.query.categories.findFirst({ where: eq(categories.slug, input.slug) });
    if (clash && clash.id !== id) return { ok: false as const, error: "slug" };
    if (id == null) {
      const [row] = await tx.insert(categories).values(input).returning({ id: categories.id });
      await audit(actor, "category.create", "category", row!.id, { slug: input.slug }, tx);
      return { ok: true as const, id: row!.id };
    }
    const [row] = await tx.update(categories).set(input).where(eq(categories.id, id)).returning({ id: categories.id });
    if (!row) throw new ServiceError("notFound");
    await audit(actor, "category.update", "category", id, { slug: input.slug, isActive: input.isActive }, tx);
    return { ok: true as const, id };
  });
}

/** Swaps sort order with the neighbouring category. */
export async function moveCategory(id: number, direction: "up" | "down", actor: Actor, conn: DbOrTx = db) {
  await conn.transaction(async (tx) => {
    const all = await tx.select({ id: categories.id, sortOrder: categories.sortOrder }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
    // Normalize to 0..n so swaps are always meaningful.
    const idx = all.findIndex((c) => c.id === id);
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapWith < 0 || swapWith >= all.length) return;
    const order = all.map((c) => c.id);
    [order[idx], order[swapWith]] = [order[swapWith]!, order[idx]!];
    for (let i = 0; i < order.length; i++) {
      await tx.update(categories).set({ sortOrder: i * 10 }).where(eq(categories.id, order[i]!));
    }
    await audit(actor, "category.reorder", "category", id, { direction }, tx);
  });
}

export async function deleteCategory(id: number, actor: Actor, conn: DbOrTx = db): Promise<"deleted" | "has_products"> {
  return conn.transaction(async (tx) => {
    const [n] = await tx.select({ n: count() }).from(products).where(eq(products.categoryId, id));
    if ((n?.n ?? 0) > 0) return "has_products" as const;
    await tx.delete(categories).where(eq(categories.id, id));
    await audit(actor, "category.delete", "category", id, {}, tx);
    return "deleted" as const;
  });
}

/* ---------------------------- Payment methods -------------------------- */

export async function listPaymentMethods(opts: { enabledOnly?: boolean } = {}, conn: DbOrTx = db) {
  return conn
    .select()
    .from(paymentMethods)
    .where(opts.enabledOnly ? eq(paymentMethods.isEnabled, true) : undefined)
    .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.id));
}

export async function updatePaymentMethod(id: number, input: z.infer<typeof paymentMethodSchema>, actor: Actor, conn: DbOrTx = db) {
  const [row] = await conn.update(paymentMethods).set(input).where(eq(paymentMethods.id, id)).returning({ code: paymentMethods.code });
  if (!row) throw new ServiceError("notFound");
  await audit(actor, "payment_method.update", "payment_method", id, { code: row.code, enabled: input.isEnabled }, conn);
}
