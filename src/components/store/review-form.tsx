"use client";

import { useId, useState } from "react";
import { submitReviewAction } from "@/app/actions/reviews";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Textarea, aria } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormPendingContext, useActionForm } from "@/components/ui/use-action-form";
import { fmt } from "@/lib/i18n/config";

export type ReviewFormStrings = {
  rating: string;
  ratingLabels: string[];
  starsLabel: string;
  comment: string;
  commentHint: string;
  displayName: string;
  displayNameHint: string;
  submit: string;
  update: string;
  submitting: string;
  thanks: string;
  updated: string;
  hiddenNote: string;
  errors: Record<string, string>;
};

const STAR = "M12 2.8l2.85 5.9 6.45.85-4.75 4.45 1.2 6.4L12 17.3l-5.75 3.1 1.2-6.4L2.7 9.55l6.45-.85z";

export function ReviewForm({
  reference,
  accessKey,
  item,
  existing,
  defaultName,
  s,
}: {
  reference: string;
  accessKey: string | null;
  item: { id: number; name: string; packageLabel: string | null };
  existing: { rating: number; comment: string; displayName: string; hidden: boolean } | null;
  defaultName: string;
  s: ReviewFormStrings;
}) {
  const uid = useId();
  const { state, action, onSubmit, pending } = useActionForm(submitReviewAction, {});
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;
  const err = (k: string) => (state.fieldErrors?.[k] ? (s.errors[state.fieldErrors[k]] ?? s.errors.validation) : undefined);
  const saved = state.ok || existing;

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line p-4" data-testid={`review-form-${item.id}`}>
      <FormPendingContext.Provider value={pending}>
        <input type="hidden" name="reference" value={reference} />
        {accessKey ? <input type="hidden" name="key" value={accessKey} /> : null}
        <input type="hidden" name="orderItemId" value={item.id} />
        <p className="font-bold">
          {item.name}
          {item.packageLabel ? <span className="font-normal text-fg-muted"> · {item.packageLabel}</span> : null}
        </p>
        {existing?.hidden ? <Alert tone="warning" title={s.hiddenNote} /> : null}
        {state.ok ? <Alert tone="success" title={state.message === "updated" ? s.updated : s.thanks} /> : null}
        {state.error && !state.fieldErrors ? <Alert tone="danger" title={s.errors[state.error] ?? s.errors.generic} /> : null}

        <fieldset>
          <legend className="mb-1 text-sm font-semibold">
            {s.rating} <span className="text-danger">*</span>
          </legend>
          <div className="flex items-center gap-3" onMouseLeave={() => setHover(0)}>
            <div className="flex" dir="ltr">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer p-0.5 has-[:focus-visible]:rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand" onMouseEnter={() => setHover(n)}>
                  <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" aria-label={fmt(s.starsLabel, { n })} />
                  <svg viewBox="0 0 24 24" className={`size-8 transition ${n <= shown ? "text-amber-400" : "text-line-strong"}`} fill="currentColor" aria-hidden="true">
                    <path d={STAR} />
                  </svg>
                </label>
              ))}
            </div>
            <span className="text-sm font-semibold text-fg-muted" aria-live="polite">{shown ? s.ratingLabels[shown - 1] : ""}</span>
          </div>
          {err("rating") ? <p className="mt-1 text-sm text-danger">{err("rating")}</p> : null}
        </fieldset>

        <Field id={`${uid}-c`} label={s.comment} hint={s.commentHint} error={err("comment")}>
          <Textarea {...aria(`${uid}-c`, err("comment"), s.commentHint)} name="comment" rows={3} maxLength={1000} defaultValue={existing?.comment ?? ""} />
        </Field>
        <Field id={`${uid}-n`} label={s.displayName} hint={s.displayNameHint} error={err("displayName")} required>
          <Input {...aria(`${uid}-n`, err("displayName"), s.displayNameHint)} name="displayName" maxLength={40} required defaultValue={existing?.displayName ?? defaultName} autoComplete="given-name" />
        </Field>
        <SubmitButton pendingLabel={s.submitting}>{saved ? s.update : s.submit}</SubmitButton>
      </FormPendingContext.Provider>
    </form>
  );
}
