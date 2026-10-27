"use client";

import { useEffect, useState } from "react";
import { subscribeOrderPushAction, unsubscribeOrderPushAction } from "@/app/actions/push";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { isIOS, isStandalone } from "./pwa";

export type OrderNotifyStrings = {
  title: string;
  body: string;
  enable: string;
  enabling: string;
  on: string;
  off: string;
  blocked: string;
  unsupported: string;
  iosHint: string;
  failed: string;
  emailOn: string;
};

type State = "loading" | "unsupported" | "ios" | "off" | "on" | "blocked" | "busy" | "failed";

const ORDERS_KEY = "hds_push_orders";
const ORDER_LINKS = "hds-order-links";

function readOrders(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeOrders(list: string[]) {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify([...new Set(list)].slice(-20)));
  } catch {
    /* ignore */
  }
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The service worker opens this device's own order link (with its key) when a notification is tapped. */
async function rememberOrderLink(reference: string) {
  try {
    const cache = await caches.open(ORDER_LINKS);
    await cache.put(`/__order-link/${encodeURIComponent(reference)}`, new Response(location.pathname + location.search));
  } catch {
    /* Cache API unavailable: the notification falls back to the track page. */
  }
}

export function OrderNotify({
  reference,
  accessKey,
  locale,
  vapidPublicKey,
  emailOn,
  s,
}: {
  reference: string;
  accessKey: string | null;
  locale: string;
  vapidPublicKey: string;
  emailOn: boolean;
  s: OrderNotifyStrings;
}) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      setState(isIOS() && !isStandalone() ? "ios" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    void (async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && readOrders().includes(reference) ? "on" : "off");
    })().catch(() => setState("off"));
  }, [reference]);

  async function enable() {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }));
      const json = sub.toJSON();
      const res = await subscribeOrderPushAction({ reference, key: accessKey ?? "", locale, subscription: { endpoint: json.endpoint, keys: json.keys } });
      if (!res.ok) {
        setState("failed");
        return;
      }
      writeOrders([...readOrders(), reference]);
      await rememberOrderLink(reference);
      setState("on");
    } catch {
      setState("failed");
    }
  }

  async function disable() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await unsubscribeOrderPushAction({ reference, key: accessKey ?? "", endpoint: sub.endpoint });
      const rest = readOrders().filter((r) => r !== reference);
      writeOrders(rest);
      // Other orders on this device may still use the same browser subscription.
      if (sub && rest.length === 0) await sub.unsubscribe();
    } finally {
      setState("off");
    }
  }

  return (
    <section className="space-y-3 rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft" data-testid="order-notify">
      <h2 className="flex items-center gap-2 font-bold"><Icon name="bell" className="size-5 text-brand" /> {s.title}</h2>
      <p className="text-sm text-fg-muted">
        {s.body} {emailOn ? s.emailOn : null}
      </p>
      {state === "on" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-success" role="status">{s.on}</p>
          <button type="button" onClick={() => void disable()} className="text-sm font-semibold text-fg-subtle underline hover:text-fg">{s.off}</button>
        </div>
      ) : state === "off" || state === "busy" || state === "failed" ? (
        <div className="space-y-2">
          <Button onClick={() => void enable()} disabled={state === "busy"}>
            <Icon name="bell" className="size-4.5" /> {state === "busy" ? s.enabling : s.enable}
          </Button>
          {state === "failed" ? <p className="text-sm text-danger" role="alert">{s.failed}</p> : null}
        </div>
      ) : state === "blocked" ? (
        <p className="text-sm text-warning" role="status">{s.blocked}</p>
      ) : state === "ios" ? (
        <p className="rounded-xl bg-muted p-3 text-sm">{s.iosHint}</p>
      ) : state === "unsupported" ? (
        <p className="text-sm text-fg-muted">{s.unsupported}</p>
      ) : null}
    </section>
  );
}
