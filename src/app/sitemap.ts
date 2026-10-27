import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { siteUrl } from "@/lib/server/request";
import { GUIDES } from "@/lib/i18n/guides";

export const dynamic = "force-dynamic";

/** Public pages, active categories and active products in both languages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await siteUrl();
  const [cats, prods] = await Promise.all([
    db.select({ slug: categories.slug, updatedAt: categories.updatedAt }).from(categories).where(eq(categories.isActive, true)),
    db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(eq(products.isActive, true)),
  ]);
  const pages = ["", "/services", "/guides", "/custom-request", "/contact", "/faq", "/track", "/terms", "/privacy", "/refund-policy"];
  const both = (path: string, lastModified?: Date, priority = 0.6) =>
    (["ar", "en"] as const).map((l) => ({
      url: `${base}/${l}${path}`,
      lastModified,
      priority: l === "ar" ? priority : priority - 0.1,
      alternates: { languages: { ar: `${base}/ar${path}`, en: `${base}/en${path}` } },
    }));
  return [
    ...pages.flatMap((p) => both(p, undefined, p === "" ? 1 : 0.7)),
    ...cats.flatMap((c) => both(`/category/${c.slug}`, c.updatedAt, 0.8)),
    ...prods.flatMap((p) => both(`/services/${p.slug}`, p.updatedAt, 0.9)),
    ...GUIDES.flatMap((g) => both(`/guides/${g.slug}`, new Date(g.updated), 0.7)),
  ];
}
