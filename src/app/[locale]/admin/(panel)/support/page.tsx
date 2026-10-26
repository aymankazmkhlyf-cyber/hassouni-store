import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/i18n";
import { pageNumber, resolveLocale, sp, type LocaleParams } from "@/lib/i18n/server";
import { telegramConfigured } from "@/lib/services/notify";
import { getSettings } from "@/lib/services/settings";
import { listThreads, stripTag } from "@/lib/services/support";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { AdminTitle } from "@/components/admin/messages";
import { BrowserNotifyButton } from "@/components/admin/support-notifier";
import { TelegramLink } from "@/components/admin/telegram-link";

type Props = LocaleParams & { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminSupport({ params, searchParams }: Props) {
  const { locale, t } = await resolveLocale(params);
  const user = await requireStaffPage(locale, "support:manage");
  const q = await searchParams;
  const status = sp(q.status) === "closed" ? "closed" : sp(q.status) === "open" ? "open" : undefined;
  const [{ rows, page, pages }, settings] = await Promise.all([listThreads({ page: pageNumber(q.page), status }), getSettings()]);
  const s = t.admin.supportPage;
  const tabs = [
    { key: undefined, label: s.all },
    { key: "open", label: s.open },
    { key: "closed", label: s.closed },
  ];
  return (
    <>
      <AdminTitle title={t.admin.support} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div>
          <nav className="mb-3 flex gap-1" aria-label={s.all}>
            {tabs.map((tab) => (
              <Link
                key={tab.label}
                href={`/${locale}/admin/support${tab.key ? `?status=${tab.key}` : ""}`}
                aria-current={status === tab.key ? "page" : undefined}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-fg-muted hover:bg-muted aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          {rows.length === 0 ? (
            <EmptyState icon="chat" title={s.empty} />
          ) : (
            <Card>
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link href={`/${locale}/admin/support/${r.id}`} className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-muted">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-bold">
                          {r.name}
                          {r.unreadForStaff > 0 ? <Badge tone="danger">{r.unreadForStaff} {s.unread}</Badge> : null}
                          {r.status === "closed" ? <Badge>{s.closed}</Badge> : null}
                        </span>
                        <span className="block truncate text-sm text-fg-muted">{r.preview ? stripTag(r.preview) : ""}</span>
                      </span>
                      <span className="ltr-nums shrink-0 text-xs text-fg-subtle">{formatDateTime(r.lastMessageAt, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Pagination page={page} pages={pages} basePath={`/${locale}/admin/support`} params={{ status }} t={t} />
        </div>

        <Card>
          <CardHeader title={s.notifications} />
          <div className="space-y-5 p-5">
            <BrowserNotifyButton enable={s.browserEnable} on={s.browserOn} blocked={s.browserBlocked} />
            <div className="space-y-2">
              <p className="text-sm font-bold">{s.telegram}</p>
              {settings.telegramChatId && telegramConfigured() ? <p className="text-sm text-success">{s.telegramLinked}</p> : null}
              <p className="text-sm whitespace-pre-line text-fg-muted">{s.telegramSteps}</p>
              {hasPermission(user.role, "settings:write") ? <TelegramLink label={s.telegramLink} done={s.telegramDone} errors={{ ...s.telegramErrors }} /> : null}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
