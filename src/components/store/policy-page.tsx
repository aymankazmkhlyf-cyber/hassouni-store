import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n";
import { RichText } from "@/components/ui/rich-text";
import { PageHeader } from "./product-card";

export function PolicyPage({ title, text, updatedAt, locale, t }: { title: string; text: string; updatedAt: string; locale: Locale; t: Dictionary }) {
  return (
    <>
      <PageHeader title={title} subtitle={updatedAt ? `${t.legal.lastUpdated}: ${formatDate(updatedAt, locale)}` : undefined} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <article className="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft sm:p-8">
          <RichText text={text} className="prose-policy" />
        </article>
      </div>
    </>
  );
}
