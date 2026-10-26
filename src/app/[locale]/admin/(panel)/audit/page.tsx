import { count, desc } from "drizzle-orm";
import { requireStaffPage } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/i18n";
import { pageNumber, resolveLocale, type LocaleParams } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { AdminTitle } from "@/components/admin/messages";

type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminAudit({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  await requireStaffPage(locale, "audit:read");
  const page = pageNumber((await searchParams).page);
  const pageSize = 50;
  const [rows, [total]] = await Promise.all([
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ n: count() }).from(auditLogs),
  ]);
  const a = t.admin.auditPage;
  return (
    <>
      <AdminTitle title={t.admin.audit} />
      {rows.length === 0 ? (
        <EmptyState icon="list" title={a.empty} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="border-b border-line text-xs text-fg-subtle">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{a.date}</th>
                <th className="px-4 py-3 text-start font-semibold">{a.actor}</th>
                <th className="px-4 py-3 text-start font-semibold">{a.action}</th>
                <th className="px-4 py-3 text-start font-semibold">{a.entity}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="ltr-nums px-4 py-2.5 text-xs whitespace-nowrap">{formatDateTime(r.createdAt, locale)}</td>
                  <td className="ltr-nums px-4 py-2.5" dir="ltr">{r.actorEmail ?? "system"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-2.5 font-mono text-xs" dir="ltr">
                    {r.entityType}{r.entityId ? `:${r.entityId.slice(0, 12)}` : ""}
                    {Object.keys(r.details).length ? <span className="block text-fg-subtle">{JSON.stringify(r.details).slice(0, 160)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Pagination page={page} pages={Math.max(1, Math.ceil((total?.n ?? 0) / pageSize))} basePath={`/${locale}/admin/audit`} params={{}} t={t} />
    </>
  );
}
