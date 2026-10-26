"use client";

import { useId } from "react";
import { submitProofAction } from "@/app/actions/orders";
import type { ActionState } from "@/app/actions/types";
import { Alert } from "@/components/ui/alert";
import { Field, Input, aria } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormPendingContext, useActionForm } from "@/components/ui/use-action-form";

export function PaymentProofForm({
  reference,
  accessKey,
  requiresReference,
  allowsReceipt,
  s,
}: {
  reference: string;
  accessKey: string | null;
  requiresReference: boolean;
  allowsReceipt: boolean;
  s: { title: string; ref: string; receipt: string; submit: string; submitting: string; submitted: string; note: string; errors: Record<string, string> };
}) {
  const uid = useId();
  const { state, action, onSubmit, pending } = useActionForm(submitProofAction, {});
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <FormPendingContext.Provider value={pending}>
      <input type="hidden" name="reference" value={reference} />
      {accessKey ? <input type="hidden" name="key" value={accessKey} /> : null}
      {state.ok ? <Alert tone="success" title={s.submitted} /> : null}
      {state.error ? <Alert tone="danger" title={s.errors[state.error] ?? s.errors.generic} /> : null}
      <Field id={`${uid}-ref`} label={s.ref} required={requiresReference}>
        <Input {...aria(`${uid}-ref`)} name="customerReference" maxLength={100} dir="ltr" autoComplete="off" required={requiresReference} />
      </Field>
      {allowsReceipt ? (
        <Field id={`${uid}-file`} label={s.receipt}>
          <input
            id={`${uid}-file`}
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-soft-fg"
          />
        </Field>
      ) : null}
      <p className="text-xs text-fg-muted">{s.note}</p>
      <SubmitButton pendingLabel={s.submitting}>{s.submit}</SubmitButton>
      </FormPendingContext.Provider>
    </form>
  );
}
