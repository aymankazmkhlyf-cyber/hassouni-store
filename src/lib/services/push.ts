import { and, eq, sql } from "drizzle-orm";
import webpush from "web-push";
import { db, type DbOrTx } from "@/lib/db";
import { pushSubscriptions, storeSettings } from "@/lib/db/schema";

/*
 * Standard Web Push (VAPID). Works on Android/desktop browsers, and on iPhone
 * once the store is installed to the home screen (iOS 16.4+). No external
 * account is needed: the VAPID key pair is generated on first use and kept in
 * its own store_settings row — never in the public settings object.
 */

const VAPID_KEY = "vapid";
type VapidKeys = { publicKey: string; privateKey: string };

export async function getVapidKeys(conn: DbOrTx = db): Promise<VapidKeys> {
  const read = async () => {
    const row = await conn.query.storeSettings.findFirst({ where: eq(storeSettings.key, VAPID_KEY) });
    const v = row?.value as Partial<VapidKeys> | undefined;
    return v?.publicKey && v.privateKey ? { publicKey: v.publicKey, privateKey: v.privateKey } : null;
  };
  const existing = await read();
  if (existing) return existing;
  const keys = webpush.generateVAPIDKeys();
  // Concurrent first requests: only one insert wins, everyone reads the winner.
  await conn.insert(storeSettings).values({ key: VAPID_KEY, value: keys }).onConflictDoNothing();
  return (await read())!;
}

/**
 * The server POSTs to the subscription endpoint, so only real browser push
 * services are accepted (prevents using the store to reach arbitrary URLs).
 */
const PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:" || u.port || u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    return PUSH_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

/** At most this many devices per order. */
const MAX_PER_ORDER = 5;

export async function saveSubscription(orderId: string, sub: PushSubscriptionInput, locale: string, conn: DbOrTx = db) {
  if (!isAllowedPushEndpoint(sub.endpoint)) return false;
  return conn.transaction(async (tx) => {
    await tx
      .insert(pushSubscriptions)
      .values({ orderId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, locale })
      .onConflictDoUpdate({
        target: [pushSubscriptions.orderId, pushSubscriptions.endpoint],
        set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, locale, failures: 0 },
      });
    // Keep only the newest few devices for this order.
    await tx.execute(sql`DELETE FROM push_subscriptions WHERE order_id = ${orderId} AND id NOT IN (
      SELECT id FROM push_subscriptions WHERE order_id = ${orderId} ORDER BY created_at DESC, id DESC LIMIT ${MAX_PER_ORDER})`);
    return true;
  });
}

export async function removeSubscription(orderId: string, endpoint: string, conn: DbOrTx = db) {
  await conn.delete(pushSubscriptions).where(and(eq(pushSubscriptions.orderId, orderId), eq(pushSubscriptions.endpoint, endpoint)));
}

export type PushPayload = { title: string; body: string; url: string; tag: string; ref: string };

export type PushSender = (sub: webpush.PushSubscription, payload: string, options: webpush.RequestOptions) => Promise<{ statusCode: number }>;
const defaultSender: PushSender = (sub, payload, options) => webpush.sendNotification(sub, payload, options);

/** Sends to every device subscribed to the order. Gone subscriptions are removed. Never throws. */
export async function pushToOrder(orderId: string, payload: PushPayload, contact: string, opts: { send?: PushSender; conn?: DbOrTx } = {}) {
  const conn = opts.conn ?? db;
  const send = opts.send ?? defaultSender;
  let delivered = 0;
  try {
    const subs = await conn.select().from(pushSubscriptions).where(eq(pushSubscriptions.orderId, orderId));
    if (!subs.length) return 0;
    const keys = await getVapidKeys(conn);
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
            vapidDetails: { subject: contact, publicKey: keys.publicKey, privateKey: keys.privateKey },
            TTL: 3 * 24 * 60 * 60,
            urgency: "high",
            timeout: 5000,
          });
          delivered++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410 || s.failures >= 4) {
            await conn.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
          } else {
            await conn.update(pushSubscriptions).set({ failures: s.failures + 1 }).where(eq(pushSubscriptions.id, s.id));
          }
        }
      }),
    );
  } catch {
    console.error("push send failed");
  }
  return delivered;
}
