import { telegramHandle, telegramLink, whatsappLink } from "@/lib/domain/contact";
import type { StoreSettings } from "@/lib/services/settings";
import type { Dictionary } from "@/lib/i18n";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/components/ui/cn";

/**
 * Plain links: they open the app if installed, otherwise the website.
 * Nothing is sent automatically. rel=noreferrer keeps private page URLs out of referrers.
 */
export function ContactLinks({
  settings,
  t,
  message,
  variant = "cards",
}: {
  settings: StoreSettings;
  t: Dictionary;
  message?: string;
  variant?: "cards" | "icons";
}) {
  const items = [
    settings.whatsapp && {
      key: "whatsapp",
      label: t.contact.whatsapp,
      detail: settings.whatsapp,
      href: whatsappLink(settings.whatsapp, message),
      cls: "text-[#128c4a] dark:text-[#4ade80]",
    },
    settings.telegram && {
      key: "telegram",
      label: t.contact.telegram,
      detail: telegramHandle(settings.telegram),
      href: telegramLink(settings.telegram),
      cls: "text-[#1f87c7] dark:text-[#5cc0ff]",
    },
    settings.instagram && {
      key: "instagram",
      label: t.contact.instagram,
      detail: settings.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, ""),
      href: settings.instagram,
      cls: "text-[#c13584] dark:text-[#f472b6]",
    },
  ].filter(Boolean) as { key: string; label: string; detail: string; href: string; cls: string }[];

  if (variant === "icons") {
    return (
      <ul className="flex items-center gap-2">
        {items.map((i) => (
          <li key={i.key}>
            <a href={i.href} target="_blank" rel="noopener noreferrer" aria-label={i.label} className={cn("grid size-10 place-items-center rounded-xl bg-muted hover:brightness-95", i.cls)}>
              <Icon name={i.key} className="size-5" />
            </a>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <li key={i.key}>
          <a href={i.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-line bg-elevated p-4 transition hover:border-brand hover:shadow-soft">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl bg-muted", i.cls)}>
              <Icon name={i.key} className="size-6" />
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{i.label}</span>
              <span className="ltr-nums block truncate text-sm text-fg-muted" dir="ltr">{i.detail}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
