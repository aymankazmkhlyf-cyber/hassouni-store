"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { formatIQD } from "@/lib/domain/money";
import { priceLine, quantityBounds, type PriceErrorCode } from "@/lib/domain/pricing";
import { validateFieldValues, type FieldDef } from "@/lib/domain/fields";
import { fmt, type Locale } from "@/lib/i18n/config";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea, aria } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useCart } from "./cart-provider";

export type AddToCartProduct = {
  id: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  pricingMode: "unit" | "package";
  unitPrice: number | null;
  minQuantity: number;
  maxQuantity: number | null;
  packages: { id: number; labelAr: string; labelEn: string; price: number; compareAtPrice: number | null }[];
  tiers: { minQuantity: number; unitPrice: number }[];
  fields: (FieldDef & { helpAr: string; helpEn: string })[];
};

export type AddToCartStrings = {
  addToCart: string;
  added: string;
  goToCart: string;
  quantity: string;
  choosePackage: string;
  minMax: string;
  unitPrice: string;
  estimatedTotal: string;
  requiredInfo: string;
  noPasswords: string;
  optional: string;
  limitReached: string;
  wasPrice: string;
  errors: Record<string, string>;
};

export function AddToCart({ product, locale, s }: { product: AddToCartProduct; locale: Locale; s: AddToCartStrings }) {
  const uid = useId();
  const cart = useCart();
  const bounds = quantityBounds(product);
  const [packageId, setPackageId] = useState<number | null>(product.packages[0]?.id ?? null);
  const [quantity, setQuantity] = useState(bounds.min);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "added" | "full">("idle");

  const label = (o: { labelAr: string; labelEn: string }) => (locale === "ar" ? o.labelAr : o.labelEn);

  const priced = useMemo(
    () =>
      priceLine(
        { ...product, isActive: true, categoryActive: true },
        product.packages.map((p) => ({ ...p, productId: product.id, isActive: true })),
        product.tiers,
        { packageId, quantity },
      ),
    [product, packageId, quantity],
  );

  const errorText = (code: PriceErrorCode | string, field?: string) =>
    fmt(s.errors[code] ?? s.errors.validation ?? code, { field: field ?? "" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = validateFieldValues(product.fields, values);
    if (!res.ok) {
      const next: Record<string, string> = {};
      for (const err of res.errors) {
        const def = product.fields.find((f) => f.key === err.key);
        next[err.key] = errorText(err.code, def ? label(def) : err.key);
      }
      setErrors(next);
      document.getElementById(`${uid}-${res.errors[0]!.key}`)?.focus();
      return;
    }
    setErrors({});
    if (!priced.ok) return;
    const pkg = product.packages.find((p) => p.id === packageId);
    const ok = cart.add({
      productId: product.id,
      slug: product.slug,
      packageId: product.pricingMode === "package" ? packageId : null,
      quantity,
      inputs: Object.fromEntries(res.values.map((v) => [v.key, v.value])),
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      packageLabelAr: pkg?.labelAr ?? null,
      packageLabelEn: pkg?.labelEn ?? null,
      unitPriceHint: priced.unitPrice,
    });
    setStatus(ok ? "added" : "full");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {product.pricingMode === "package" ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{s.choosePackage}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {product.packages.map((p) => (
              <label
                key={p.id}
                className="relative flex cursor-pointer flex-col rounded-xl border border-line-strong bg-elevated p-3 transition has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:ring-2 has-[:checked]:ring-brand/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
              >
                <input type="radio" name="package" value={p.id} checked={packageId === p.id} onChange={() => setPackageId(p.id)} className="sr-only" />
                <span className="text-sm font-bold">{label(p)}</span>
                <span className="ltr-nums mt-1 text-sm font-bold text-brand" dir="ltr">{formatIQD(p.price, locale)}</span>
                {p.compareAtPrice != null && p.compareAtPrice > p.price ? (
                  <s className="ltr-nums text-xs text-fg-subtle" dir="ltr">
                    <span className="sr-only">{s.wasPrice}: </span>
                    {formatIQD(p.compareAtPrice, locale)}
                  </s>
                ) : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <Field id={`${uid}-qty`} label={s.quantity} hint={fmt(s.minMax, { min: bounds.min, max: bounds.max })} error={!priced.ok ? errorText(priced.error) : undefined}>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="size-11 shrink-0 px-0" aria-label="-" onClick={() => setQuantity((q) => Math.max(bounds.min, q - (q > 1000 ? 100 : 1)))}>
            <Icon name="minus" className="size-4" />
          </Button>
          <Input
            {...aria(`${uid}-qty`, !priced.ok ? "e" : undefined)}
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            step={1}
            value={Number.isFinite(quantity) ? quantity : ""}
            onChange={(e) => setQuantity(Math.trunc(Number(e.target.value)))}
            className="ltr-nums w-32 text-center"
          />
          <Button variant="outline" className="size-11 shrink-0 px-0" aria-label="+" onClick={() => setQuantity((q) => Math.min(bounds.max, q + (q >= 1000 ? 100 : 1)))}>
            <Icon name="plus" className="size-4" />
          </Button>
        </div>
      </Field>

      {product.fields.length ? (
        <fieldset className="space-y-4 rounded-2xl border border-line bg-muted/40 p-4">
          <legend className="px-1 text-sm font-bold">{s.requiredInfo}</legend>
          {product.fields.map((f) => {
            const id = `${uid}-${f.key}`;
            const help = locale === "ar" ? f.helpAr : f.helpEn;
            const common = {
              ...aria(id, errors[f.key], help),
              name: f.key,
              value: values[f.key] ?? "",
              required: f.required,
              maxLength: f.maxLength,
              autoComplete: "off",
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value })),
            };
            return (
              <Field key={f.key} id={id} label={label(f)} hint={help || undefined} error={errors[f.key]} required={f.required} optionalLabel={s.optional}>
                {f.type === "textarea" ? (
                  <Textarea {...common} rows={4} />
                ) : f.type === "select" ? (
                  <Select {...common}>
                    <option value="">—</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {label(o)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    {...common}
                    type={f.type === "url" ? "url" : f.type === "phone" ? "tel" : "text"}
                    inputMode={f.type === "number" ? "numeric" : f.type === "phone" ? "tel" : undefined}
                    dir={f.type === "url" || f.type === "number" || f.type === "phone" ? "ltr" : undefined}
                  />
                )}
              </Field>
            );
          })}
          <p className="flex items-center gap-2 text-xs text-fg-muted">
            <Icon name="lock" className="size-4 shrink-0 text-success" /> {s.noPasswords}
          </p>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-muted p-4">
        <div>
          <p className="text-xs text-fg-subtle">{s.estimatedTotal}</p>
          <p className="ltr-nums text-2xl font-black" dir="ltr" aria-live="polite">
            {priced.ok ? formatIQD(priced.lineTotal, locale) : "—"}
          </p>
          {priced.ok && product.pricingMode === "unit" ? (
            <p className="text-xs text-fg-muted">
              {s.unitPrice}: <span className="ltr-nums" dir="ltr">{formatIQD(priced.unitPrice, locale)}</span>
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" disabled={!priced.ok} className="min-w-44 flex-1 sm:flex-none">
          <Icon name="cart" className="size-5" /> {s.addToCart}
        </Button>
      </div>

      {status === "added" ? (
        <Alert tone="success" title={s.added}>
          <Link href={`/${locale}/cart`} className={buttonClass("primary", "sm", "mt-2")}>
            {s.goToCart}
          </Link>
        </Alert>
      ) : status === "full" ? (
        <Alert tone="warning" title={s.limitReached} />
      ) : null}
    </form>
  );
}
