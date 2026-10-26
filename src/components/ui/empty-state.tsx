import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export function EmptyState({ icon = "box", title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-(--radius-card) border border-dashed border-line-strong bg-elevated px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-soft-fg">
        <Icon name={icon} className="size-7" />
      </span>
      <h2 className="text-lg font-bold">{title}</h2>
      {body ? <p className="max-w-md text-sm text-fg-muted">{body}</p> : null}
      {action}
    </div>
  );
}
