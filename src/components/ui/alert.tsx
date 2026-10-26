import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

const tones = {
  info: { box: "border-info/30 bg-info-soft text-info", icon: "info" },
  success: { box: "border-success/30 bg-success-soft text-success", icon: "check" },
  warning: { box: "border-warning/30 bg-warning-soft text-warning", icon: "alert" },
  danger: { box: "border-danger/30 bg-danger-soft text-danger", icon: "alert" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", t.box, className)}>
      <Icon name={t.icon} className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className="text-fg-muted [&_strong]:text-fg">{children}</div> : null}
      </div>
    </div>
  );
}
