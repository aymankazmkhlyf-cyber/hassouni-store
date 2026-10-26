import type { FaqItem } from "@/lib/i18n/content";
import { Icon } from "@/components/ui/icon";

/** Native <details> accordion: keyboard accessible and works without JavaScript. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line bg-elevated shadow-soft">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold hover:bg-muted [&::-webkit-details-marker]:hidden">
            {item.q}
            <Icon name="chevron-down" className="size-5 shrink-0 text-fg-subtle transition group-open:rotate-180" />
          </summary>
          <p className="px-5 pb-5 text-fg-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
