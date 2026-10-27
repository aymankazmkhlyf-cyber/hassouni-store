"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isLocale } from "@/lib/i18n/config";
import { clientIp } from "@/lib/server/request";
import { getOrderByAccessKey, getOrderForUser } from "@/lib/services/orders";
import { removeSubscription, saveSubscription } from "@/lib/services/push";
import { consumeRateLimit } from "@/lib/services/rate-limit";

const b64url = (max: number) => z.string().min(8).max(max).regex(/^[A-Za-z0-9_-]+=*$/);

const subscribeSchema = z.object({
  reference: z.string().trim().min(5).max(40),
  key: z.string().max(60).default(""),
  locale: z.string().max(5),
  subscription: z.object({
    endpoint: z.url().max(1000),
    keys: z.object({ p256dh: b64url(200), auth: b64url(64) }),
  }),
});

async function findOrder(reference: string, key: string) {
  const user = await getCurrentUser();
  return key ? getOrderByAccessKey(reference, key) : user ? getOrderForUser(reference, user.id) : null;
}

/** Stores this device's push subscription for one order (same access rule as the order page). */
export async function subscribeOrderPushAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (!(await consumeRateLimit("pushSubscribe", await clientIp()))) return { ok: false, error: "rateLimited" };
  const order = await findOrder(parsed.data.reference, parsed.data.key);
  if (!order) return { ok: false, error: "notFoundOrder" };
  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : order.locale;
  const saved = await saveSubscription(order.id, parsed.data.subscription, locale);
  return saved ? { ok: true } : { ok: false, error: "validation" };
}

export async function unsubscribeOrderPushAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = subscribeSchema.pick({ reference: true, key: true }).extend({ endpoint: z.url().max(1000) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const order = await findOrder(parsed.data.reference, parsed.data.key);
  if (!order) return { ok: false };
  await removeSubscription(order.id, parsed.data.endpoint);
  return { ok: true };
}
