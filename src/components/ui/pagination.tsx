import Link from "next/link";
import { fmt, type Dictionary } from "@/lib/i18n";
import { Icon } from "./icon";
import { buttonClass } from "./button";

/** Server-rendered pagination that preserves the existing query string. */
export function Pagination({
  page,
  pages,
  basePath,
  params,
  t,
}: {
  page: number;
  pages: number;
  basePath: string;
  params: Record<string, string | undefined>;
  t: Dictionary;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    else qs.delete("page");
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav aria-label={fmt(t.common.page, { page, pages })} className="mt-8 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClass("outline", "sm")} rel="prev">
          <Icon name="chevron-start" className="size-4" /> {t.common.previous}
        </Link>
      ) : null}
      <span className="text-sm text-fg-muted">{fmt(t.common.page, { page, pages })}</span>
      {page < pages ? (
        <Link href={href(page + 1)} className={buttonClass("outline", "sm")} rel="next">
          {t.common.next} <Icon name="chevron-end" className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
