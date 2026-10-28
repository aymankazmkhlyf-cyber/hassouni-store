import { jsonAction } from "./client";
export type SupportSendResult = { ok: true } | { ok: false; error: "validation" | "rateLimited" | "invalidPhone" | "generic" };
export type LinkTelegramResult = { ok: true; name: string } | { ok: false; error: "notConfigured" | "noChat" | "sendFailed" | "forbidden" };
export const sendSupportMessageAction = jsonAction<SupportSendResult>("support.send");
export const staffReplyAction = jsonAction<{ ok: boolean; error?: string }>("support.staffReply");
export const linkTelegramAction = jsonAction<LinkTelegramResult>("support.linkTelegram");
