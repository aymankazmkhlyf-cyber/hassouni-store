import { formatIQD } from "@/lib/domain/money";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "./cn";

export function Price({ amount, locale, className }: { amount: number; locale: Locale; className?: string }) {
  return <span className={cn("ltr-nums font-bold tabular-nums", className)} dir="ltr">{formatIQD(amount, locale)}</span>;
}

/** Shows a struck-through compare price only when it is a genuine, higher configured price. */
export function PriceWithCompare({
  amount,
  compareAt,
  locale,
  wasLabel,
}: {
  amount: number;
  compareAt: number | null | undefined;
  locale: Locale;
  wasLabel: string;
}) {
  const showCompare = compareAt != null && compareAt > amount;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <Price amount={amount} locale={locale} />
      {showCompare ? (
        <s className="text-sm text-fg-subtle">
          <span className="sr-only">{wasLabel}: </span>
          <Price amount={compareAt} locale={locale} className="font-normal" />
        </s>
      ) : null}
    </span>
  );
}
