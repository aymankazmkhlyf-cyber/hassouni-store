"use client";

import type { ActionState } from "@/app/actions/types";
import { fmt } from "@/lib/i18n/config";
import { Alert } from "@/components/ui/alert";
import { FormPendingContext, useActionForm } from "@/components/ui/use-action-form";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Generic admin form: runs a server action and shows its result. Field errors
 * are listed using `labels` so server-side validation is visible even though
 * the form body itself is server-rendered.
 */
export function ActionForm({
  action,
  children,
  className,
  messages,
  labels = {},
  resetOnSuccess = false,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  messages: Record<string, string>;
  labels?: Record<string, string>;
  resetOnSuccess?: boolean;
}) {
  const { state, action: formAction, onSubmit, pending } = useActionForm(action, {});
  const describe = (field: string, code: string) => {
    const m = /^line:(\d+):(\w+)$/.exec(code);
    if (m) return fmt(messages.lineError ?? "{field} {line}", { field: labels[field] ?? field, line: m[1]!, reason: m[2]! });
    const text = messages[code] ?? messages.validation ?? code;
    return `${labels[field] ?? field}: ${fmt(text, { field: labels[field] ?? field })}`;
  };
  return (
    <form action={formAction} onSubmit={onSubmit} className={className} key={resetOnSuccess && state.ok ? String(Date.now()) : undefined}>
      <FormPendingContext.Provider value={pending}>
      {state.error ? (
        <Alert tone="danger" title={messages[state.error] ?? messages.generic} className="mb-4">
          {state.fieldErrors ? (
            <ul className="list-disc ps-4">
              {Object.entries(state.fieldErrors).map(([f, c]) => (
                <li key={f}>{describe(f, c)}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {state.ok && state.message ? <Alert tone="success" title={messages[state.message] ?? state.message} className="mb-4" /> : null}
      {children}
      </FormPendingContext.Provider>
    </form>
  );
}
