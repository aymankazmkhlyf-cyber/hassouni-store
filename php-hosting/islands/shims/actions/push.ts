import { jsonAction } from "./client";
export const subscribeOrderPushAction = jsonAction<{ ok: boolean; error?: string }>("push.subscribe");
export const unsubscribeOrderPushAction = jsonAction<{ ok: boolean }>("push.unsubscribe");
