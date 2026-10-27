import type { MetadataRoute } from "next";

/** Lets customers "Add to Home Screen" and open the store like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/ar",
    name: "متجر حسوني لخدمات السوشل ميديا",
    short_name: "حسوني",
    description: "خدمات رقمية في العراق: سوشل ميديا، شحن ألعاب، اشتراكات وتصاميم.",
    start_url: "/ar",
    scope: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#f6f6fb",
    theme_color: "#5a3ff0",
    orientation: "portrait",
    categories: ["shopping", "business"],
    shortcuts: [
      { name: "كل الخدمات", short_name: "الخدمات", url: "/ar/services", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "السلة", url: "/ar/cart", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "تتبع طلب", url: "/ar/track", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
