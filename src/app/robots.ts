import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/server/request";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/*/admin", "/*/orders/", "/*/account", "/*/checkout", "/*/cart"] }],
    sitemap: `${await siteUrl()}/sitemap.xml`,
  };
}
