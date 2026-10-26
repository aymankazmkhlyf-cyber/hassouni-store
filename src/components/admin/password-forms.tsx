"use client";

import Link from "next/link";
import { useId } from "react";
import { changeWithCodeAction, requestChangeAction, requestResetAction, resetWithCodeAction } from "@/app/actions/password";
import { fmt } from "@/lib/i18n/config";
import { Alert } from "@/components/ui/alert";
import { Field, Input, aria } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormPendingContext, useActionForm } from "@/components/ui/use-action-form";

export type PasswordStrings = Record<
  "forgotBody" | "email" | "sendCode" | "codeSent" | "code" | "newPassword" | "confirm" | "resetSubmit" | "changeBody" | "current" | "resend" | "back",
  string
> & { errors: Record<string, string> };

function CodeAndPassword({ uid, s }: { uid: string; s: PasswordStrings }) {
  return (
    <>
      <Field id={`${uid}-code`} label={s.code} required>
        <Input {...aria(`${uid}-code`)} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} dir="ltr" required className="text-center text-lg tracking-[0.5em]" />
      </Field>
      <Field id={`${uid}-pw`} label={s.newPassword} required>
        <Input {...aria(`${uid}-pw`)} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={200} dir="ltr" required />
      </Field>
      <Field id={`${uid}-confirm`} label={s.confirm} required>
        <Input {...aria(`${uid}-confirm`)} name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={200} dir="ltr" required />
      </Field>
    </>
  );
}

/** Forgot password: step 1 asks for the email, step 2 takes the code + new password. */
export function ForgotPasswordForm({ locale, s }: { locale: string; s: PasswordStrings }) {
  const uid = useId();
  const request = useActionForm(requestResetAction);
  const reset = useActionForm(resetWithCodeAction);
  const sentTo = (reset.state.data?.email ?? request.state.data?.email) as string | undefined;
  const err = (code?: string) => (code ? (s.errors[code] ?? code) : null);

  if (!sentTo) {
    return (
      <form action={request.action} onSubmit={request.onSubmit} className="space-y-4">
        <FormPendingContext.Provider value={request.pending}>
          <p className="text-sm text-fg-muted">{s.forgotBody}</p>
          {err(request.state.error) ? <Alert tone="danger" title={err(request.state.error)!} /> : null}
          <Field id={`${uid}-email`} label={s.email} required>
            <Input {...aria(`${uid}-email`)} name="email" type="email" autoComplete="username" dir="ltr" required maxLength={200} />
          </Field>
          <SubmitButton className="w-full">{s.sendCode}</SubmitButton>
          <p className="text-center text-sm"><Link href={`/${locale}/admin/login`} className="text-brand hover:underline">{s.back}</Link></p>
        </FormPendingContext.Provider>
      </form>
    );
  }
  return (
    <form action={reset.action} onSubmit={reset.onSubmit} className="space-y-4">
      <FormPendingContext.Provider value={reset.pending}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="email" value={sentTo} />
        <Alert tone="info" title={s.codeSent} />
        {err(reset.state.error) ? <Alert tone="danger" title={err(reset.state.error)!} /> : null}
        <CodeAndPassword uid={uid} s={s} />
        <SubmitButton className="w-full">{s.resetSubmit}</SubmitButton>
        <p className="text-center text-sm"><Link href={`/${locale}/admin/forgot-password`} className="text-brand hover:underline">{s.resend}</Link></p>
      </FormPendingContext.Provider>
    </form>
  );
}

/** Logged-in change: current password -> emailed code -> new password. */
export function ChangePasswordForm({ locale, email, s }: { locale: string; email: string; s: PasswordStrings }) {
  const uid = useId();
  const request = useActionForm(requestChangeAction);
  const change = useActionForm(changeWithCodeAction);
  const onCodeStep = request.state.data?.step === "code" || change.state.data?.step === "code";
  const err = (code?: string) => (code ? (s.errors[code] ?? code) : null);

  if (!onCodeStep) {
    return (
      <form action={request.action} onSubmit={request.onSubmit} className="space-y-4">
        <FormPendingContext.Provider value={request.pending}>
          <p className="text-sm text-fg-muted">{fmt(s.changeBody, { email })}</p>
          {err(request.state.error) ? <Alert tone="danger" title={err(request.state.error)!} /> : null}
          <Field id={`${uid}-current`} label={s.current} required>
            <Input {...aria(`${uid}-current`)} name="current" type="password" autoComplete="current-password" dir="ltr" required maxLength={200} />
          </Field>
          <SubmitButton>{s.sendCode}</SubmitButton>
        </FormPendingContext.Provider>
      </form>
    );
  }
  return (
    <form action={change.action} onSubmit={change.onSubmit} className="space-y-4">
      <FormPendingContext.Provider value={change.pending}>
        <input type="hidden" name="locale" value={locale} />
        <Alert tone="info" title={fmt(s.changeBody, { email })} />
        {err(change.state.error) ? <Alert tone="danger" title={err(change.state.error)!} /> : null}
        <CodeAndPassword uid={uid} s={s} />
        <SubmitButton>{s.resetSubmit}</SubmitButton>
      </FormPendingContext.Provider>
    </form>
  );
}
