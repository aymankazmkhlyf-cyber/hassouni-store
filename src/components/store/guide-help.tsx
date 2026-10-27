import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Guide } from "@/lib/i18n/guides";
import { Icon } from "@/components/ui/icon";
import { GuideArt } from "./guide-art";

/** Collapsible "how do I…?" help with the guide's illustration and steps (no JavaScript needed). */
export function GuideHelp({ guide, locale, summary, readMore, open = false }: { guide: Guide; locale: Locale; summary: string; readMore: string; open?: boolean }) {
  const art = guide.art;
  return (
    <details className="group rounded-2xl border border-brand/30 bg-brand-soft/40 p-3 open:bg-elevated" open={open} data-testid="guide-help">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-brand-soft-fg [&::-webkit-details-marker]:hidden">
        <Icon name="info" className="size-4.5 shrink-0" />
        <span className="flex-1">{summary}</span>
        <Icon name="plus" className="size-4 transition group-open:rotate-45" />
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-[11rem_1fr] sm:items-start">
        <GuideArt
          variant={art.variant}
          labels={{ title: art.title[locale], a: art.a?.[locale], b: art.b?.[locale] }}
          className="mx-auto w-44 max-w-full"
        />
        <div className="space-y-2 text-sm">
          <ol className="list-decimal space-y-1.5 ps-5">
            {guide.steps[locale].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {guide.tips[locale][0] ? <p className="text-xs text-fg-muted">💡 {guide.tips[locale][0]}</p> : null}
          <Link href={`/${locale}/guides/${guide.slug}`} className="inline-block text-xs font-semibold text-brand hover:underline">{readMore}</Link>
        </div>
      </div>
    </details>
  );
}
