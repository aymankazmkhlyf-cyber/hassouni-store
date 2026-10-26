"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* audio unavailable */
  }
}

/** Header badge for unread support messages; alerts (notification + sound) when the count rises. */
export function SupportNotifier({ href, label, newMessage }: { href: string; label: string; newMessage: string }) {
  const [unread, setUnread] = useState(0);
  const last = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.hidden && last.current !== null) return;
      try {
        const res = await fetch("/api/admin/support/unread", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const { unread: n } = (await res.json()) as { unread: number };
        if (last.current !== null && n > last.current) {
          beep();
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(newMessage, { body: `${n}`, tag: "hds-support" });
          }
        }
        last.current = n;
        setUnread(n);
      } catch {
        /* retry next tick */
      }
    };
    void check();
    const t = setInterval(check, 15000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [newMessage]);

  return (
    <Link href={href} className="relative grid size-10 place-items-center rounded-xl hover:bg-muted" aria-label={unread ? `${label} (${unread})` : label}>
      <Icon name="chat" className="size-5" />
      {unread > 0 ? (
        <span className="absolute -top-0.5 -end-0.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[0.68rem] font-bold text-white" aria-hidden="true">
          {unread}
        </span>
      ) : null}
    </Link>
  );
}

export function BrowserNotifyButton({ enable, on, blocked }: { enable: string; on: string; blocked: string }) {
  const [state, setState] = useState<NotificationPermission | "unsupported" | null>(null);
  useEffect(() => setState("Notification" in window ? Notification.permission : "unsupported"), []);
  if (state === null || state === "unsupported") return null;
  if (state === "granted") return <p className="text-sm text-success">{on}</p>;
  if (state === "denied") return <p className="text-sm text-warning">{blocked}</p>;
  return (
    <button
      type="button"
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-soft px-4 text-sm font-semibold text-brand-soft-fg"
      onClick={async () => {
        setState(await Notification.requestPermission());
        beep();
      }}
    >
      <Icon name="alert" className="size-4" /> {enable}
    </button>
  );
}
