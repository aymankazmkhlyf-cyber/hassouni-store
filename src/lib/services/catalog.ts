import { and, asc, count, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { categories, priceTiers, productFields, productPackages, products } from "@/lib/db/schema";

export type ProductSort = "featured" | "price_asc" | "price_desc" | "newest";

/*
 * Correlated subqueries use explicitly qualified column names: inside raw sql``
 * fragments in a select list Drizzle renders `${products.id}` as a bare "id",
 * which would bind to the inner table instead of the outer `products` row.
 */

/** "From" price computed in SQL so listings can sort by it. */
const startingPriceSql = sql<number | null>`(CASE "products"."pricing_mode"
  WHEN 'unit' THEN "products"."min_quantity" * COALESCE(
    (SELECT t.unit_price FROM price_tiers t WHERE t.product_id = "products"."id" AND t.min_quantity <= "products"."min_quantity"
     ORDER BY t.min_quantity DESC LIMIT 1), "products"."unit_price")
  ELSE (SELECT min(pp.price) FROM product_packages pp WHERE pp.product_id = "products"."id" AND pp.is_active)
END)`;

/** A genuine configured discount: a compare-at price strictly above the current price. */
const hasOfferSql = sql<boolean>`(
  ("products"."pricing_mode" = 'unit' AND "products"."compare_at_price" IS NOT NULL AND "products"."compare_at_price" > "products"."unit_price")
  OR EXISTS (SELECT 1 FROM product_packages pp WHERE pp.product_id = "products"."id" AND pp.is_active
             AND pp.compare_at_price IS NOT NULL AND pp.compare_at_price > pp.price)
)`;

/** Published verified-buyer ratings, shown on cards only when at least one exists. */
const ratingAvgSql = sql<number | null>`(SELECT round(avg(r.rating)::numeric, 1) FROM reviews r WHERE r.product_id = "products"."id" AND r.status = 'published')`;
const ratingCountSql = sql<number>`(SELECT count(*) FROM reviews r WHERE r.product_id = "products"."id" AND r.status = 'published')`;

export type ProductCard = {
  id: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  summaryAr: string;
  summaryEn: string;
  icon: string;
  imageFileId: string | null;
  isSample: boolean;
  isFeatured: boolean;
  startingPrice: number | null;
  compareAtPrice: number | null;
  hasOffer: boolean;
  pricingMode: "unit" | "package";
  categorySlug: string;
  categoryNameAr: string;
  categoryNameEn: string;
  ratingAvg: number | null;
  ratingCount: number;
};

const cardColumns = {
  id: products.id,
  slug: products.slug,
  nameAr: products.nameAr,
  nameEn: products.nameEn,
  summaryAr: products.summaryAr,
  summaryEn: products.summaryEn,
  icon: products.icon,
  imageFileId: products.imageFileId,
  isSample: products.isSample,
  isFeatured: products.isFeatured,
  startingPrice: startingPriceSql,
  compareAtPrice: products.compareAtPrice,
  hasOffer: hasOfferSql,
  pricingMode: products.pricingMode,
  categorySlug: categories.slug,
  categoryNameAr: categories.nameAr,
  categoryNameEn: categories.nameEn,
  ratingAvg: ratingAvgSql,
  ratingCount: ratingCountSql,
};

export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listCategories(opts: { activeOnly?: boolean } = {}, conn: DbOrTx = db) {
  const visibleProducts = opts.activeOnly
    ? sql<number>`count("products"."id") FILTER (WHERE "products"."is_active")`
    : sql<number>`count("products"."id")`;
  return conn
    .select({
      id: categories.id,
      slug: categories.slug,
      nameAr: categories.nameAr,
      nameEn: categories.nameEn,
      descriptionAr: categories.descriptionAr,
      descriptionEn: categories.descriptionEn,
      icon: categories.icon,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      productCount: visibleProducts.mapWith(Number),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(opts.activeOnly ? eq(categories.isActive, true) : undefined)
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.id));
}

export async function getActiveCategoryBySlug(slug: string, conn: DbOrTx = db) {
  return conn.query.categories.findFirst({ where: and(eq(categories.slug, slug), eq(categories.isActive, true)) });
}

export type ListProductsOptions = {
  categoryId?: number;
  q?: string;
  featuredOnly?: boolean;
  offersOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  excludeId?: number;
};

export async function listProducts(opts: ListProductsOptions = {}, conn: DbOrTx = db) {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 12, 1), 48);
  const page = Math.max(opts.page ?? 1, 1);

  const where: SQL[] = [eq(products.isActive, true), eq(categories.isActive, true)];
  if (opts.categoryId) where.push(eq(products.categoryId, opts.categoryId));
  if (opts.featuredOnly) where.push(eq(products.isFeatured, true));
  if (opts.offersOnly) where.push(hasOfferSql);
  if (opts.excludeId) where.push(ne(products.id, opts.excludeId));
  const q = opts.q?.trim().slice(0, 80);
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    where.push(
      sql`(${products.nameAr} ILIKE ${pattern} OR ${products.nameEn} ILIKE ${pattern}
        OR ${products.summaryAr} ILIKE ${pattern} OR ${products.summaryEn} ILIKE ${pattern}
        OR ${categories.nameAr} ILIKE ${pattern} OR ${categories.nameEn} ILIKE ${pattern})`,
    );
  }
  const condition = and(...where);

  const order = (() => {
    switch (opts.sort) {
      case "price_asc":
        return [sql`${startingPriceSql} ASC NULLS LAST`, asc(products.id)];
      case "price_desc":
        return [sql`${startingPriceSql} DESC NULLS LAST`, asc(products.id)];
      case "newest":
        return [desc(products.createdAt), desc(products.id)];
      default:
        return [desc(products.isFeatured), asc(categories.sortOrder), asc(products.sortOrder), asc(products.id)];
    }
  })();

  const [items, totalRow] = await Promise.all([
    conn
      .select(cardColumns)
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(condition)
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    conn
      .select({ n: count() })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(condition),
  ]);

  const total = totalRow[0]?.n ?? 0;
  return {
    items: items.map((i) => ({
      ...i,
      startingPrice: i.startingPrice == null ? null : Number(i.startingPrice),
      ratingAvg: i.ratingAvg == null ? null : Number(i.ratingAvg),
      ratingCount: Number(i.ratingCount),
    })) as ProductCard[],
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Storefront product detail; null when the product or its category is inactive. */
export async function getProductDetail(slug: string, conn: DbOrTx = db) {
  const product = await conn.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.isActive, true)),
    with: {
      category: true,
      packages: { where: eq(productPackages.isActive, true), orderBy: [asc(productPackages.sortOrder), asc(productPackages.price)] },
      tiers: { orderBy: asc(priceTiers.minQuantity) },
      fields: { orderBy: [asc(productFields.sortOrder), asc(productFields.id)] },
    },
  });
  if (!product || !product.category.isActive) return null;
  return product;
}
export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;

/** Loads everything needed to price a set of products. */
export async function loadPricingData(productIds: number[], conn: DbOrTx = db) {
  if (productIds.length === 0) return [];
  return conn.query.products.findMany({
    where: inArray(products.id, [...new Set(productIds)]),
    with: { category: true, packages: true, tiers: true, fields: { orderBy: asc(productFields.sortOrder) } },
  });
}
