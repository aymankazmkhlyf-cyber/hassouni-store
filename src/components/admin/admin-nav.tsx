"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export function AdminNav({ links }: { links: { href: string; label: string; icon: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {links.map((l) => {
          const active = l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap text-fg-muted hover:bg-muted hover:text-fg aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-soft-fg"
              >
                <Icon name={l.icon} className="size-4.5" />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
