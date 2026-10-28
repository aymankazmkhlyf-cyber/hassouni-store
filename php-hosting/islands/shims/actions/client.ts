/*
 * Server actions → PHP endpoints. Form actions POST the FormData to
 * /_action/<name>; JSON actions POST {args}. The PHP side answers with
 * { state, redirect?, refresh? } exactly like the original actions returned.
 */
import type { ActionState } from "@/app/actions/types";

type Reply<T> = { state: T; redirect?: string; refresh?: number };

const never = <T,>() => new Promise<T>(() => undefined);

async function send<T>(name: string, body: BodyInit, json: boolean): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/_action/${name}`, {
      method: "POST",
      body,
      credentials: "same-origin",
      headers: { "X-Requested-With": "fetch", ...(json ? { "Content-Type": "application/json" } : {}) },
    });
  } catch {
    return { error: "generic" } as T;
  }
  let reply: Reply<T>;
  try {
    reply = (await res.json()) as Reply<T>;
  } catch {
    return { error: res.status === 413 ? "file_too_large" : "generic" } as T;
  }
  if (reply.redirect) {
    window.location.assign(reply.redirect);
    return never<T>();
  }
  if (reply.refresh != null) window.setTimeout(() => window.location.reload(), reply.refresh);
  return reply.state;
}

export function formAction(name: string) {
  return (_prev: ActionState, fd: FormData) => send<ActionState>(name, fd, false);
}

export function jsonAction<T>(name: string) {
  return (...args: unknown[]) => send<T>(name, JSON.stringify({ args }), true);
}
