"use client";

import Link from "next/link";
import { formatIQD } from "@/lib/domain/money";
import { fmt, type Locale } from "@/lib/i18n/config";
import type { CartLine } from "@/lib/domain/cart";
import type { QuotedLine } from "@/lib/services/quote";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { useCart } from "./cart-provider";
import { useServerQuote } from "./use-quote";

export type CartStrings = {
  title: string;
  empty: string;
  emptyBody: string;
  continue: string;
  checkout: string;
  remove: string;
  total: string;
  unitPrice: string;
  quantity: string;
  updating: string;
  fixErrors: string;
  serverPrices: string;
  sample: string;
  generic: string;
  errors: Record<string, string>;
};

export function lineErrorText(line: Extract<QuotedLine, { ok: false }>, locale: Locale, errors: Record<string, string>) {
  if (line.error === "fields" && line.fieldErrors?.length) {
    return line.fieldErrors
      .map((f) => fmt(errors[f.code] ?? errors.validation ?? "", { field: locale === "ar" ? f.labelAr : f.labelEn }))
      .join(" ");
  }
  return errors[line.error] ?? errors.cartInvalid ?? "";
}

export function CartView({ locale, s }: { locale: Locale; s: CartStrings }) {
  const { lines, ready, update, remove } = useCart();
  const { quote, loading, failed } = useServerQuote(lines, ready);

  if (!ready) {
    return (
      <div className="flex justify-center py-20 text-fg-muted" role="status">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (lines.length === 0) {
    return (
      <EmptyState
        icon="cart"
        title={s.empty}
        body={s.emptyBody}
        action={<ButtonLink href={`/${locale}/services`}>{s.continue}</ButtonLink>}
      />
    );
  }

  const name = (l: CartLine) => (locale === "ar" ? l.nameAr : l.nameEn);
  const pkg = (l: CartLine) => (locale === "ar" ? l.packageLabelAr : l.packageLabelEn);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <ul className="space-y-3" aria-busy={loading}>
        {lines.map((line, index) => {
          const q = quote?.lines[index];
          const inputs = Object.entries(line.inputs);
          return (
            <li key={line.key} className="rounded-(--radius-card) border border-line bg-elevated p-4 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/${locale}/services/${line.slug}`} className="font-bold hover:text-brand">
                    {name(line)}
                  </Link>
                  {pkg(line) ? <p className="text-sm text-fg-muted">{pkg(line)}</p> : null}
                  {q?.ok && q.isSample ? <Badge tone="warning" className="mt-1">{s.sample}</Badge> : null}
                  {inputs.length ? (
                    <dl className="mt-2 space-y-0.5 text-xs text-fg-subtle">
                      {inputs.map(([k, v]) => (
                        <div key={k} className="flex gap-1">
                          <dt className="font-semibold">{q?.ok ? (q.inputs.find((i) => i.key === k)?.[locale === "ar" ? "labelAr" : "labelEn"] ?? k) : k}:</dt>
                          <dd className="truncate" dir="auto">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
                <div className="text-end">
                  <p className="text-xs text-fg-subtle">{s.unitPrice}</p>
                  <p className="ltr-nums font-bold" dir="ltr">{q?.ok ? formatIQD(q.unitPrice, locale) : "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{s.quantity}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    defaultValue={line.quantity}
                    onBlur={(e) => {
                      const n = Math.trunc(Number(e.target.value));
                      if (n >= 1 && n !== line.quantity) update(line.key, n);
                      else e.target.value = String(line.quantity);
                    }}
                    className="ltr-nums h-10 w-28 rounded-xl border border-line-strong bg-elevated px-3 text-center focus:border-brand focus:outline-none"
                  />
                </label>
                <div className="flex items-center gap-3">
                  <span className="ltr-nums text-lg font-black" dir="ltr">{q?.ok ? formatIQD(q.lineTotal, locale) : "—"}</span>
                  <Button variant="ghost" size="sm" onClick={() => remove(line.key)} aria-label={`${s.remove}: ${name(line)}`}>
                    <Icon name="trash" className="size-4" /> {s.remove}
                  </Button>
                </div>
              </div>
              {q && !q.ok ? (
                <Alert tone="danger" className="mt-3">
                  {lineErrorText(q, locale, s.errors)}
                </Alert>
              ) : null}
            </li>
          );
        })}
      </ul>

      <aside className="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft lg:sticky lg:top-20">
        <div className="flex items-center justify-between">
          <span className="font-bold">{s.total}</span>
          <span className="ltr-nums text-2xl font-black" dir="ltr" aria-live="polite">
            {loading ? <Spinner className="size-5" /> : quote ? formatIQD(quote.total, locale) : "—"}
          </span>
        </div>
        <p className="mt-2 text-xs text-fg-subtle">{loading ? s.updating : s.serverPrices}</p>
        {failed ? <Alert tone="danger" className="mt-3">{s.generic}</Alert> : null}
        {quote && !quote.valid && !loading ? <Alert tone="warning" className="mt-3">{s.fixErrors}</Alert> : null}
        <ButtonLink
          href={`/${locale}/checkout`}
          size="lg"
          className="mt-4 w-full aria-disabled:pointer-events-none aria-disabled:opacity-55"
          aria-disabled={!quote?.valid || loading}
          tabIndex={!quote?.valid || loading ? -1 : undefined}
        >
          {s.checkout}
        </ButtonLink>
        <ButtonLink href={`/${locale}/services`} variant="ghost" className="mt-2 w-full">
          {s.continue}
        </ButtonLink>
      </aside>
    </div>
  );
}
