"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { formatIQD } from "@/lib/domain/money";
import { fmt, type Locale } from "@/lib/i18n/config";
import { placeOrderAction } from "@/app/actions/checkout";
import { openOrdersAction } from "@/app/actions/orders";
import type { ActionState } from "@/app/actions/types";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea, aria } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormPendingContext, useActionForm } from "@/components/ui/use-action-form";
import { useCart } from "./cart-provider";
import { useServerQuote } from "./use-quote";
import { lineErrorText } from "./cart-view";
import { readRecentOrders } from "./recent-orders";

export type CheckoutMethod = { id: number; name: string; instructions: string };

export type CheckoutStrings = Record<
  | "contactInfo" | "name" | "phone" | "phoneHint" | "email" | "paymentMethod" | "manualNote" | "noMethods" | "notes"
  | "acceptTerms" | "terms" | "refund" | "placeOrder" | "placing" | "summary" | "loginSuggestion" | "login" | "noCardData"
  | "total" | "empty" | "continue" | "optional" | "fixErrors" | "backToCart"
  | "openInProgress" | "walletName" | "walletAvailable" | "walletInsufficient" | "walletTopup" | "walletInstant" | "walletLogin",
  string
> & { errors: Record<string, string> };

/** Logged-in customer's wallet, or null for guests and staff. */
export type CheckoutWallet = { balance: number } | null;

const KEY_STORE = "hds_checkout_attempt";

/** One idempotency key per (cart contents) attempt, persisted so a retry after a network error reuses it. */
function attemptKey(signature: string): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY_STORE) ?? "null") as { sig: string; key: string } | null;
    if (saved && saved.sig === signature) return saved.key;
    const key = crypto.randomUUID();
    sessionStorage.setItem(KEY_STORE, JSON.stringify({ sig: signature, key }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function CheckoutForm({
  locale,
  methods,
  defaults,
  loggedIn,
  ordersEnabled,
  wallet,
  s,
}: {
  locale: Locale;
  methods: CheckoutMethod[];
  defaults: { name: string; phone: string; email: string };
  loggedIn: boolean;
  ordersEnabled: boolean;
  wallet: CheckoutWallet;
  s: CheckoutStrings;
}) {
  const uid = useId();
  const router = useRouter();
  const { lines, ready, clear } = useCart();
  const { quote, loading } = useServerQuote(lines, ready);
  const { state, action, onSubmit, pending } = useActionForm(placeOrderAction, {});
  const [methodId, setMethodId] = useState<number | "wallet" | null>(wallet && wallet.balance > 0 ? "wallet" : (methods[0]?.id ?? null));
  const [idempotencyKey, setKey] = useState("");
  const [open, setOpen] = useState<{ inProgress: string[]; keys: Record<string, string> }>({ inProgress: [], keys: {} });

  // Warn only when the cart repeats a service for the same account as an order still in progress.
  const targets = JSON.stringify(lines.map(({ productId, inputs }) => ({ productId, inputs })));
  useEffect(() => {
    const recent = readRecentOrders();
    if ((!recent.length && !loggedIn) || !ready) return;
    let alive = true;
    openOrdersAction({ recent: recent.map(({ ref, key }) => ({ ref, key })), lines: JSON.parse(targets) })
      .then((r) => alive && setOpen({ inProgress: r.inProgress, keys: Object.fromEntries(recent.map((x) => [x.ref, x.key])) }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [loggedIn, ready, targets]);
  const orderHref = (ref: string) => `/${locale}/orders/${ref}${open.keys[ref] ? `?key=${open.keys[ref]}` : ""}`;
  const refLinks = (refs: string[]) =>
    refs.map((r, i) => (
      <span key={r}>
        {i ? "، " : ""}
        <Link href={orderHref(r)} className="ltr-nums font-bold underline" dir="ltr">{r}</Link>
      </span>
    ));

  const payload = JSON.stringify(lines.map(({ productId, packageId, quantity, inputs }) => ({ productId, packageId, quantity, inputs })));
  useEffect(() => {
    if (ready && lines.length) setKey(attemptKey(payload));
  }, [ready, payload, lines.length]);

  // Runs exactly once per successful order (clearing the cart re-renders this component).
  const redirected = useRef(false);
  useEffect(() => {
    const to = state.ok ? (state.data?.redirectTo as string | undefined) : undefined;
    if (to && !redirected.current) {
      redirected.current = true;
      clear();
      try {
        sessionStorage.removeItem(KEY_STORE);
      } catch {
        /* ignore */
      }
      router.replace(to);
    }
  }, [state, clear, router]);

  if (!ready) return <div className="flex justify-center py-20" role="status"><Spinner className="size-6" /></div>;
  if (state.ok) return <div className="flex justify-center py-20" role="status"><Spinner className="size-6" /></div>;
  if (lines.length === 0) {
    return <EmptyState icon="cart" title={s.empty} action={<ButtonLink href={`/${locale}/services`}>{s.continue}</ButtonLink>} />;
  }

  const fe = state.fieldErrors ?? {};
  const err = (k: string) => (fe[k] ? fmt(s.errors[fe[k]!] ?? s.errors.validation ?? "", { field: "" }) : undefined);
  const selected = methods.find((m) => m.id === methodId);
  const payByWallet = methodId === "wallet" && !!wallet;
  const shortfall = payByWallet && quote?.valid ? Math.max(0, quote.total - wallet.balance) : 0;
  const canSubmit = ordersEnabled && (methods.length > 0 || !!wallet) && !!quote?.valid && !loading && !!idempotencyKey && shortfall === 0;

  return (
    <form action={action} onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start" noValidate>
      <FormPendingContext.Provider value={pending}>
      <input type="hidden" name="items" value={payload} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-6">
        {state.error ? (
          <Alert tone="danger" title={s.errors[state.error] ?? s.errors.generic}>
            {state.error === "cartInvalid" ? <Link href={`/${locale}/cart`} className="font-semibold underline">{s.backToCart}</Link> : null}
            {state.error === "activeOrderExists" && typeof state.data?.reference === "string" ? <p>{refLinks([state.data.reference])}</p> : null}
          </Alert>
        ) : null}
        {open.inProgress.length ? (
          <Alert tone="warning" title={s.openInProgress} className="animate-in">
            <p>{refLinks(open.inProgress)}</p>
          </Alert>
        ) : null}
        {!loggedIn ? (
          <p className="text-sm text-fg-muted">
            {s.loginSuggestion}{" "}
            <Link href={`/${locale}/login?next=/${locale}/checkout`} className="font-semibold text-brand hover:underline">{s.login}</Link>
          </p>
        ) : null}

        <section className="space-y-4 rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
          <h2 className="font-bold">{s.contactInfo}</h2>
          <Field id={`${uid}-name`} label={s.name} required error={err("customerName")}>
            <Input {...aria(`${uid}-name`, err("customerName"))} name="customerName" defaultValue={defaults.name} autoComplete="name" maxLength={80} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${uid}-phone`} label={s.phone} required hint={s.phoneHint} error={err("customerPhone")}>
              <Input {...aria(`${uid}-phone`, err("customerPhone"), s.phoneHint)} name="customerPhone" type="tel" inputMode="tel" dir="ltr" defaultValue={defaults.phone} autoComplete="tel" maxLength={30} required />
            </Field>
            <Field id={`${uid}-email`} label={s.email} optionalLabel={s.optional} error={err("customerEmail")}>
              <Input {...aria(`${uid}-email`, err("customerEmail"))} name="customerEmail" type="email" dir="ltr" defaultValue={defaults.email} autoComplete="email" maxLength={200} />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
          <h2 className="font-bold">{s.paymentMethod}</h2>
          {methods.length === 0 && !wallet ? (
            <Alert tone="warning">{s.noMethods}</Alert>
          ) : (
            <fieldset>
              <legend className="sr-only">{s.paymentMethod}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {wallet ? (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong p-3.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand sm:col-span-2">
                    <input type="radio" name="paymentMethodId" value="wallet" checked={methodId === "wallet"} onChange={() => setMethodId("wallet")} className="size-4 accent-(--brand)" />
                    <Icon name="wallet" className="size-5 text-brand" />
                    <span className="flex-1">
                      <span className="block font-semibold">{s.walletName}</span>
                      <span className="ltr-nums block text-xs text-fg-muted">{fmt(s.walletAvailable, { amount: formatIQD(wallet.balance, locale) })}</span>
                    </span>
                  </label>
                ) : null}
                {methods.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong p-3.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
                    <input type="radio" name="paymentMethodId" value={m.id} checked={methodId === m.id} onChange={() => setMethodId(m.id)} className="size-4 accent-(--brand)" />
                    <Icon name="card" className="size-5 text-fg-subtle" />
                    <span className="font-semibold">{m.name}</span>
                  </label>
                ))}
              </div>
              {err("paymentMethodId") ? <p className="mt-2 text-xs font-semibold text-danger">{err("paymentMethodId")}</p> : null}
            </fieldset>
          )}
          {payByWallet ? (
            shortfall > 0 ? (
              <Alert tone="warning" title={fmt(s.walletInsufficient, { amount: formatIQD(shortfall, locale) })}>
                <Link href={`/${locale}/account/wallet#topup`} className="font-semibold underline">{s.walletTopup}</Link>
              </Alert>
            ) : (
              <Alert tone="success">{s.walletInstant}</Alert>
            )
          ) : (
            <>
              {selected?.instructions ? <p className="rounded-xl bg-muted p-3 text-sm whitespace-pre-line text-fg-muted">{selected.instructions}</p> : null}
              <Alert tone="info">{s.manualNote}</Alert>
              {!loggedIn ? <p className="text-xs text-fg-muted">{s.walletLogin}</p> : null}
            </>
          )}
          <p className="flex items-center gap-2 text-xs text-fg-muted">
            <Icon name="shield" className="size-4 shrink-0 text-success" /> {s.noCardData}
          </p>
        </section>

        <section className="space-y-4 rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
          <Field id={`${uid}-notes`} label={s.notes} optionalLabel={s.optional} error={err("customerNotes")}>
            <Textarea {...aria(`${uid}-notes`, err("customerNotes"))} name="customerNotes" maxLength={1000} rows={3} />
          </Field>
          <Checkbox
            name="acceptTerms"
            required
            aria-invalid={err("acceptTerms") ? true : undefined}
            label={
              <>
                {s.acceptTerms} (
                <Link href={`/${locale}/terms`} target="_blank" className="text-brand underline">{s.terms}</Link>
                {locale === "ar" ? "، " : ", "}
                <Link href={`/${locale}/refund-policy`} target="_blank" className="text-brand underline">{s.refund}</Link>)
              </>
            }
          />
          {err("acceptTerms") ? <p className="text-xs font-semibold text-danger">{err("acceptTerms")}</p> : null}
        </section>
      </div>

      <aside className="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft lg:sticky lg:top-20">
        <h2 className="mb-3 font-bold">{s.summary}</h2>
        <ul className="space-y-2 text-sm">
          {lines.map((l, i) => {
            const q = quote?.lines[i];
            return (
              <li key={l.key} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{locale === "ar" ? l.nameAr : l.nameEn}</span>
                  <span className="text-xs text-fg-subtle">
                    {(locale === "ar" ? l.packageLabelAr : l.packageLabelEn) ?? ""} × <span className="ltr-nums">{l.quantity}</span>
                  </span>
                  {q && !q.ok ? <span className="block text-xs text-danger">{lineErrorText(q, locale, s.errors)}</span> : null}
                </span>
                <span className="ltr-nums shrink-0 font-bold" dir="ltr">{q?.ok ? formatIQD(q.lineTotal, locale) : "—"}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <span className="font-bold">{s.total}</span>
          <span className="ltr-nums text-2xl font-black" dir="ltr">{loading || !quote ? <Spinner className="size-5" /> : formatIQD(quote.total, locale)}</span>
        </div>
        {quote && !quote.valid && !loading ? <Alert tone="warning" className="mt-3">{s.fixErrors}</Alert> : null}
        <SubmitButton size="lg" className="mt-4 w-full" disabled={!canSubmit} pendingLabel={s.placing}>
          {s.placeOrder}
        </SubmitButton>
      </aside>
      </FormPendingContext.Provider>
    </form>
  );
}
