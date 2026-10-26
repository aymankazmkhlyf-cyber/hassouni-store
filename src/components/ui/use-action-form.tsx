"use client";

import { createContext, startTransition, useActionState, type FormEvent } from "react";
import type { ActionState } from "@/app/actions/types";

/** Lets <SubmitButton> know a form submitted via useActionForm is pending. */
export const FormPendingContext = createContext<boolean | null>(null);

/**
 * useActionState + a submit handler that dispatches inside a transition.
 * React 19 resets uncontrolled fields after a `<form action>` completes, which
 * would wipe user input on validation errors; dispatching manually avoids that.
 * Keep `action={action}` on the form too so it still works before hydration.
 */
export function useActionForm(fn: (state: ActionState, fd: FormData) => Promise<ActionState>, initial: ActionState = {}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(fn, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => action(fd));
  };
  return { state, action, onSubmit, pending };
}
