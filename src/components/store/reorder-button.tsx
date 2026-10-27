"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCart } from "./cart-provider";

export type ReorderItem = {
  productId: number;
  slug: string;
  packageId: number | null;
  quantity: number;
  inputs: Record<string, string>;
  nameAr: string;
  nameEn: string;
  packageLabelAr: string | null;
  packageLabelEn: string | null;
  unitPrice: number;
};

/** Puts the same services (same package, quantity and details) back in the cart; the cart re-prices them. */
export function ReorderButton({ items, locale, label }: { items: ReorderItem[]; locale: Locale; label: string }) {
  const cart = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!items.length) return null;
  return (
    <Button
      variant="secondary"
      disabled={busy}
      data-testid="reorder"
      onClick={() => {
        setBusy(true);
        for (const i of items) {
          cart.add({
            productId: i.productId,
            slug: i.slug,
            packageId: i.packageId,
            quantity: i.quantity,
            inputs: i.inputs,
            nameAr: i.nameAr,
            nameEn: i.nameEn,
            packageLabelAr: i.packageLabelAr,
            packageLabelEn: i.packageLabelEn,
            unitPriceHint: i.unitPrice,
          });
        }
        router.push(`/${locale}/cart`);
      }}
    >
      <Icon name="repeat" className="size-4.5" /> {label}
    </Button>
  );
}
