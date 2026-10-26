import { notFound } from "next/navigation";
import { setThreadStatusAction } from "@/app/actions/support";
import { requireStaffPage } from "@/lib/auth/current-user";
import { whatsappLink } from "@/lib/domain/contact";
import { formatDateTime, getDictionary, isLocale } from "@/lib/i18n";
import { getThread, listMessages, markReadByStaff } from "@/lib/services/support";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AdminTitle } from "@/components/admin/messages";
import { SupportThreadView } from "@/components/admin/support-thread";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminSupportThread({ params }: Props) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  await requireStaffPage(locale, "support:manage");
  const thread = await getThread(id);
  if (!thread) notFound();
  const messages = await listMessages(thread.id);
  await markReadByStaff(thread.id);
  const s = t.admin.supportPage;
  return (
    <>
      <AdminTitle
        title={thread.name}
        subtitle={formatDateTime(thread.createdAt, locale)}
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={thread.status === "open" ? "success" : "neutral"}>{thread.status === "open" ? s.open : s.closed}</Badge>
            {thread.phone ? (
              <a href={whatsappLink(thread.phone)} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "sm")}>
                <Icon name="whatsapp" className="size-4" /> <span className="ltr-nums" dir="ltr">{thread.phone}</span>
              </a>
            ) : null}
            <form action={setThreadStatusAction}>
              <input type="hidden" name="id" value={thread.id} />
              <input type="hidden" name="status" value={thread.status === "open" ? "closed" : "open"} />
              <Button type="submit" size="sm" variant="ghost">{thread.status === "open" ? s.close : s.reopen}</Button>
            </form>
          </span>
        }
      />
      <SupportThreadView
        threadId={thread.id}
        initial={messages}
        locale={locale}
        s={{ customer: thread.name, bot: t.support.bot, staff: t.support.staff, reply: s.reply, send: s.send, error: t.support.error }}
      />
    </>
  );
}
