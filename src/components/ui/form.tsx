import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const control =
  "w-full rounded-xl border border-line-strong bg-elevated px-3.5 text-fg placeholder:text-fg-subtle transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 aria-[invalid=true]:border-danger disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 pe-9", className)} {...props} />;
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm", className)}>
      <input type="checkbox" className="mt-1 size-4.5 shrink-0 accent-(--brand)" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Label + control + hint + error, wired with aria attributes. */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  optionalLabel,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-semibold">
        {label}
        {required ? <span className="text-danger" aria-hidden="true">*</span> : optionalLabel ? <span className="text-xs font-normal text-fg-subtle">({optionalLabel})</span> : null}
      </label>
      {children}
      {hint && !error ? <p id={`${id}-hint`} className="text-xs text-fg-subtle">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

/** Spreads the aria wiring for a control inside <Field>. */
export function aria(id: string, error?: string, hint?: string) {
  return {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}
