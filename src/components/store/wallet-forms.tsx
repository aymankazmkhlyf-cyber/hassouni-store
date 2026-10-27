"use client";

import { useId, useState } from "react";
import { requestTopupAction, setUsernameAction } from "@/app/actions/wallet";
import { Alert } from "@/components/ui/alert";
import { Field, Input, aria } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormPendingContext, useActionForm } from "@/components/ui/use-action-form";
import type { Locale } from "@/lib/i18n/config";
import { PaymentDetails, type PaymentDetailsStrings, type PaymentMethodInfo } from "./payment-details";

type Errors = Record<string, string>;

export function SetUsernameForm({ s, errors }: { s: { username: string; usernameHint: string; save: string }; errors: Errors }) {
  const uid = useId();
  const { state, action, onSubmit, pending } = useActionForm(setUsernameAction, {});
  const fe = state.fieldErrors?.username;
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-3">
      <FormPendingContext.Provider value={pending}>
        <Field id={`${uid}-u`} label={s.username} required hint={s.usernameHint} error={fe ? (errors[fe] ?? errors.validation) : undefined}>
          <Input {...aria(`${uid}-u`, fe, s.usernameHint)} name="username" dir="ltr" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={21} />
        </Field>
        {state.error && !fe ? <Alert tone="danger" title={errors[state.error] ?? errors.generic} /> : null}
        <SubmitButton size="sm">{s.save}</SubmitButton>
      </FormPendingContext.Provider>
    </form>
  );
}

export type TopupStrings = {
  amount: string;
  quick: string;
  method: string;
  reference: string;
  receipt: string;
  proofNote: string;
  submit: string;
  submitting: string;
  submitted: string;
};

const QUICK = [10000, 25000, 50000, 100000];

export function TopupForm({
  locale,
  methods,
  s,
  pay,
  errors,
}: {
  locale: Locale;
  methods: (PaymentMethodInfo & { id: number; allowsReceipt: boolean })[];
  s: TopupStrings;
  pay: PaymentDetailsStrings;
  errors: Errors;
}) {
  const uid = useId();
  const { state, action, onSubmit, pending } = useActionForm(requestTopupAction, {});
  const [amount, setAmount] = useState<number>(25000);
  const [methodId, setMethodId] = useState<number | null>(methods[0]?.id ?? null);
  const method = methods.find((m) => m.id === methodId);

  if (state.ok) return <Alert tone="success" title={s.submitted} />;

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4" data-testid="topup-form">
      <FormPendingContext.Provider value={pending}>
        {state.error ? <Alert tone="danger" title={errors[state.error] ?? errors.generic} /> : null}
        <Field id={`${uid}-a`} label={s.amount} required>
          <Input
            {...aria(`${uid}-a`)}
            name="amount"
            type="number"
            inputMode="numeric"
            min={1000}
            max={5000000}
            step={250}
            required
            dir="ltr"
            value={Number.isFinite(amount) && amount > 0 ? amount : ""}
            onChange={(e) => setAmount(Math.trunc(Number(e.target.value)))}
            className="ltr-nums"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={s.quick}>
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(q)}
              aria-pressed={amount === q}
              className="ltr-nums rounded-full border border-line-strong px-3 py-1.5 text-sm font-semibold aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand-soft-fg"
            >
              {q.toLocaleString("en-US")}
            </button>
          ))}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{s.method}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {methods.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                <input type="radio" name="methodId" value={m.id} checked={methodId === m.id} onChange={() => setMethodId(m.id)} className="size-4 accent-(--brand)" />
                <span className="font-semibold">{locale === "ar" ? m.nameAr : m.nameEn}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <PaymentDetails method={method} amount={amount >= 1000 ? amount : null} locale={locale} s={pay} />

        <Field id={`${uid}-r`} label={s.reference}>
          <Input {...aria(`${uid}-r`)} name="customerReference" maxLength={100} dir="ltr" autoComplete="off" />
        </Field>
        {method?.allowsReceipt !== false ? (
          <Field id={`${uid}-f`} label={s.receipt}>
            <input
              id={`${uid}-f`}
              name="receipt"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-soft-fg"
            />
          </Field>
        ) : null}
        <p className="text-xs text-fg-muted">{s.proofNote}</p>
        <SubmitButton pendingLabel={s.submitting}>{s.submit}</SubmitButton>
      </FormPendingContext.Provider>
    </form>
  );
}
