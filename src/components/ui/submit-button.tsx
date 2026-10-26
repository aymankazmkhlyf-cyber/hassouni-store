"use client";

import { useFormStatus } from "react-dom";
import { useContext, type ComponentProps } from "react";
import { FormPendingContext } from "./use-action-form";
import { Button } from "./button";
import { Spinner } from "./spinner";

/** Submit button that disables itself while the form is pending (prevents double submits). */
export function SubmitButton({
  children,
  pendingLabel,
  confirmMessage,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & { pendingLabel?: string; confirmMessage?: string }) {
  const status = useFormStatus();
  const ctx = useContext(FormPendingContext);
  const pending = ctx ?? status.pending;
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      aria-disabled={pending || props.disabled}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
        props.onClick?.(e);
      }}
      {...props}
    >
      {pending ? (
        <>
          <Spinner />
          <span>{pendingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
