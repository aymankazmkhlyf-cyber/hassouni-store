"use client";

import Link from "next/link";
import { useId } from "react";
import { fmt, type Locale } from "@/lib/i18n/config";
import type { ActionState } from "@/app/actions/types";
import { trackOrderAction } from "@/app/actions/orders";
import { adminLoginAction, deleteOwnAccountAction, loginAction, registerAction } from "@/app/actions/auth";
import { customRequestAction } from "@/app/actions/custom";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea, aria } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormPendingContext, useActionForm } from "@/components/ui/use-action-form";

type Errors = Record<string, string>;
const msg = (errors: Errors, code?: string) => (code ? fmt(errors[code] ?? errors.validation ?? code, { field: "" }) : undefined);

export function TrackForm({ locale, s, errors, defaultReference }: { locale: Locale; s: { reference: string; accessKey: string; submit: string }; errors: Errors; defaultReference?: string }) {
  const uid = useId();
  const { state, action, onSubmit, pending } = useActionForm(trackOrderAction, {});
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <FormPendingContext.Provider value={pending}>
      <input type="hidden" name="locale" value={locale} />
      {state.error ? <Alert tone="danger" title={msg(errors, state.error)} /> : null}
      <Field id={`${uid}-ref`} label={s.reference} required>
        <Input {...aria(`${uid}-ref`)} name="reference" dir="ltr" placeholder="HDS-XXXX-XXXX-XX" autoComplete="off" required maxLength={40} defaultValue={defaultReference} />
      </Field>
      <Field id={`${uid}-key`} label={s.accessKey} required>
        <Input {...aria(`${uid}-key`)} name="key" dir="ltr" autoComplete="off" required maxLength={60} />
      </Field>
      <SubmitButton className="w-full">{s.submit}</SubmitButton>
      </FormPendingContext.Provider>
    </form>
  );
}

export function LoginForm({
  locale,
  next,
  mode,
  s,
  errors,
}: {
  locale: Locale;
  next?: string;
  mode: "customer" | "staff";
  s: { email: string; password: string; submit: string };
  errors: Errors;
}) {
  const uid = useId();
  const { state, action, onSubmit, pending } = useActionForm(mode === "staff" ? adminLoginAction : loginAction, {});
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <FormPendingContext.Provider value={pending}>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? <Alert tone="danger" title={msg(errors, state.error)} /> : null}
      <Field id={`${uid}-email`} label={s.email} required>
        <Input {...aria(`${uid}-email`)} name="email" type="email" dir="ltr" autoComplete="username" required maxLength={200} />
      </Field>
      <Field id={`${uid}-password`} label={s.password} required>
        <Input {...aria(`${uid}-password`)} name="password" type="password" dir="ltr" autoComplete="current-password" required maxLength={200} />
      </Field>
      <SubmitButton className="w-full">{s.submit}</SubmitButton>
      </FormPendingContext.Provider>
    </form>
  );
}

export function RegisterForm({
  locale,
  next,
  s,
  errors,
}: {
  locale: Locale;
  next?: string;
  s: { name: string; email: string; phone: string; password: string; passwordHint: string; submit: string };
  errors: Errors;
}) {
  const uid = useId();
  const { state, action, onSubmit, pending } = useActionForm(registerAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <FormPendingContext.Provider value={pending}>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? <Alert tone="danger" title={msg(errors, state.error)} /> : null}
      <Field id={`${uid}-name`} label={s.name} required error={msg(errors, fe.name)}>
        <Input {...aria(`${uid}-name`, fe.name)} name="name" autoComplete="name" required maxLength={80} />
      </Field>
      <Field id={`${uid}-email`} label={s.email} required error={msg(errors, fe.email)}>
        <Input {...aria(`${uid}-email`, fe.email)} name="email" type="email" dir="ltr" autoComplete="email" required maxLength={200} />
      </Field>
      <Field id={`${uid}-phone`} label={s.phone} error={msg(errors, fe.phone)}>
        <Input {...aria(`${uid}-phone`, fe.phone)} name="phone" type="tel" dir="ltr" autoComplete="tel" maxLength={30} />
      </Field>
      <Field id={`${uid}-password`} label={s.password} required hint={s.passwordHint} error={msg(errors, fe.password)}>
        <Input {...aria(`${uid}-password`, fe.password, s.passwordHint)} name="password" type="password" dir="ltr" autoComplete="new-password" required minLength={10} maxLength={200} />
      </Field>
      <SubmitButton className="w-full">{s.submit}</SubmitButton>
      </FormPendingContext.Provider>
    </form>
  );
}

export function DeleteAccountForm({ locale, s, errors }: { locale: Locale; s: { label: string; submit: string; confirm: string }; errors: Errors }) {
  const uid = useId();
  const { state, action, onSubmit, pending } = useActionForm(deleteOwnAccountAction, {});
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-3">
      <FormPendingContext.Provider value={pending}>
      <input type="hidden" name="locale" value={locale} />
      {state.error ? <Alert tone="danger" title={msg(errors, state.error)} /> : null}
      <Field id={`${uid}-c`} label={s.label}>
        <Input {...aria(`${uid}-c`)} name="confirm" dir="ltr" autoComplete="off" placeholder="DELETE" />
      </Field>
      <SubmitButton variant="danger" confirmMessage={s.confirm}>{s.submit}</SubmitButton>
      </FormPendingContext.Provider>
    </form>
  );
}

export function CustomRequestForm({
  locale,
  s,
  types,
  errors,
  defaults,
}: {
  locale: Locale;
  s: Record<"name" | "phone" | "email" | "serviceType" | "description" | "quantity" | "budget" | "referenceUrl" | "notes" | "submit" | "submitting" | "success" | "optional" | "home", string>;
  types: Record<string, string>;
  errors: Errors;
  defaults: { name: string; phone: string; email: string; serviceType?: string };
}) {
  const uid = useId();
  const { state, action, onSubmit, pending } = useActionForm(customRequestAction, {});
  const fe = state.fieldErrors ?? {};
  if (state.ok) {
    return (
      <Alert tone="success" title={fmt(s.success, { ref: String(state.data?.reference ?? "") })}>
        <Link href={`/${locale}`} className="font-semibold text-brand underline">{s.home}</Link>
      </Alert>
    );
  }
  const f = (name: string, label: string, el: React.ReactNode, opts: { required?: boolean } = {}) => (
    <Field id={`${uid}-${name}`} label={label} required={opts.required} optionalLabel={opts.required ? undefined : s.optional} error={msg(errors, fe[name])}>
      {el}
    </Field>
  );
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <FormPendingContext.Provider value={pending}>
      {state.error ? <Alert tone="danger" title={msg(errors, state.error)} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {f("name", s.name, <Input {...aria(`${uid}-name`, fe.name)} name="name" defaultValue={defaults.name} autoComplete="name" required maxLength={80} />, { required: true })}
        {f("phone", s.phone, <Input {...aria(`${uid}-phone`, fe.phone)} name="phone" type="tel" dir="ltr" defaultValue={defaults.phone} autoComplete="tel" required maxLength={30} />, { required: true })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {f("email", s.email, <Input {...aria(`${uid}-email`, fe.email)} name="email" type="email" dir="ltr" defaultValue={defaults.email} maxLength={200} />)}
        {f(
          "serviceType",
          s.serviceType,
          <Select {...aria(`${uid}-serviceType`, fe.serviceType)} name="serviceType" required defaultValue={defaults.serviceType && defaults.serviceType in types ? defaults.serviceType : "social"}>
            {Object.entries(types).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>,
          { required: true },
        )}
      </div>
      {f("description", s.description, <Textarea {...aria(`${uid}-description`, fe.description)} name="description" required minLength={10} maxLength={3000} rows={5} />, { required: true })}
      <div className="grid gap-4 sm:grid-cols-3">
        {f("quantity", s.quantity, <Input {...aria(`${uid}-quantity`, fe.quantity)} name="quantity" type="number" inputMode="numeric" min={1} dir="ltr" />)}
        {f("budget", s.budget, <Input {...aria(`${uid}-budget`, fe.budget)} name="budget" type="number" inputMode="numeric" min={0} dir="ltr" />)}
        {f("referenceUrl", s.referenceUrl, <Input {...aria(`${uid}-referenceUrl`, fe.referenceUrl)} name="referenceUrl" type="url" dir="ltr" maxLength={500} />)}
      </div>
      {f("notes", s.notes, <Textarea {...aria(`${uid}-notes`, fe.notes)} name="notes" maxLength={1000} rows={3} />)}
      <SubmitButton pendingLabel={s.submitting}>{s.submit}</SubmitButton>
      </FormPendingContext.Provider>
    </form>
  );
}
