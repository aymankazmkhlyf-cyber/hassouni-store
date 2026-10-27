"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export type PwaStrings = {
  installTitle: string;
  installBody: string;
  install: string;
  later: string;
  getApp: string;
  installed: string;
  iosTitle: string;
  iosSteps: string[];
  iosNote: string;
  otherTitle: string;
  otherSteps: string[];
  close: string;
};

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "hds_install_dismissed";
const DISMISS_DAYS = 14;
const OPEN_EVENT = "hds:install";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Registers the service worker (production only, so development hot reload is unaffected). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

/**
 * "Install the app" banner. Uses the browser's own install prompt where it
 * exists (Android / desktop Chrome, Edge) and shows the Add-to-Home-Screen
 * steps on iPhone. Also opens when <InstallAppButton> is pressed.
 */
export function InstallPrompt({ s }: { s: PwaStrings }) {
  const pathname = usePathname();
  const deferred = useRef<InstallEvent | null>(null);
  const [banner, setBanner] = useState(false);
  const [guide, setGuide] = useState<"ios" | "other" | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as InstallEvent;
      if (!dismissedRecently()) setBanner(true);
    };
    const onInstalled = () => {
      deferred.current = null;
      setBanner(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // iPhone has no install event: offer the steps after a short delay on the first visits.
    const timer = isIOS() && !dismissedRecently() ? window.setTimeout(() => setBanner(true), 4000) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onOpen = () => void install();
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  });

  async function install() {
    setBanner(false);
    if (deferred.current) {
      const e = deferred.current;
      deferred.current = null;
      await e.prompt();
      await e.userChoice.catch(() => undefined);
      return;
    }
    setGuide(isIOS() ? "ios" : "other");
  }

  function later() {
    setBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!guide) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setGuide(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [guide]);

  // Never cover the checkout or payment steps.
  const hideBanner = /\/(checkout|orders|admin)(\/|$)/.test(pathname);

  return (
    <>
      {banner && !hideBanner ? (
        <section
          aria-label={s.installTitle}
          data-testid="install-banner"
          className="animate-pop fixed start-3 end-[5.5rem] bottom-3 z-40 flex items-center gap-3 rounded-2xl border border-line bg-elevated p-3 shadow-lift sm:end-auto sm:w-[25rem]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static app icon */}
          <img src="/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{s.installTitle}</p>
            <p className="line-clamp-2 text-xs text-fg-muted">{s.installBody}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Button size="sm" onClick={() => void install()}>{s.install}</Button>
            <button type="button" onClick={later} className="text-xs font-semibold text-fg-subtle hover:text-fg">{s.later}</button>
          </div>
        </section>
      ) : null}

      {guide ? (
        <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label={guide === "ios" ? s.iosTitle : s.otherTitle}>
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={s.close} tabIndex={-1} onClick={() => setGuide(null)} />
          <div className="animate-pop relative m-3 w-[calc(100%-1.5rem)] max-w-sm rounded-3xl bg-elevated p-5 shadow-lift">
            <div className="mb-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- static app icon */}
              <img src="/icon-192.png" alt="" className="size-12 rounded-xl" />
              <p className="flex-1 font-bold">{guide === "ios" ? s.iosTitle : s.otherTitle}</p>
              <button type="button" onClick={() => setGuide(null)} aria-label={s.close} className="grid size-9 place-items-center rounded-xl hover:bg-muted">
                <Icon name="close" className="size-5" />
              </button>
            </div>
            <ol className="space-y-2">
              {(guide === "ios" ? s.iosSteps : s.otherSteps).map((step, i) => (
                <li key={step} className="flex items-center gap-3 rounded-xl bg-muted p-3 text-sm">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-fg">{i + 1}</span>
                  <span className="flex-1">{step}</span>
                  {guide === "ios" && i === 0 ? <Icon name="share" className="size-5 text-brand" /> : null}
                </li>
              ))}
            </ol>
            {guide === "ios" ? <p className="mt-3 text-xs text-fg-subtle">{s.iosNote}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Footer / menu button that opens the install flow. Hidden when already running as the installed app. */
export function InstallAppButton({ s, className }: { s: Pick<PwaStrings, "getApp" | "installed">; className?: string }) {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => setStandalone(isStandalone()), []);
  if (standalone) return <p className="text-sm text-fg-muted">{s.installed}</p>;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className={className}>
      <Icon name="smartphone" className="size-4.5" /> {s.getApp}
    </button>
  );
}
