"use client";

import { useState } from "react";
import { Icon } from "./icon";

export function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable (insecure context) — the value is still visible to copy manually */
        }
      }}
    >
      <Icon name={copied ? "check" : "copy"} className="size-3.5" />
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
