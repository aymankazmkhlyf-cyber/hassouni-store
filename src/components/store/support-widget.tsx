"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { sendSupportMessageAction } from "@/app/actions/support";
import type { Locale } from "@/lib/i18n/config";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { MessageBody, timeOf, type ChatMessage } from "@/components/support/message-body";

export type SupportStrings = Record<
  "open" | "title" | "subtitle" | "close" | "name" | "phone" | "phoneHint" | "placeholder" | "start" | "send" | "you" | "bot" | "staff" | "privacy" | "validation" | "error" | "rateLimited" | "invalidPhone",
  string
>;

type Poll = { thread: boolean; unread?: number; messages?: ChatMessage[] };

/** Floating live-support chat. Polls lightly: every 4 s while open, every 30 s while closed. */
export function SupportWidget({ locale, s }: { locale: Locale; s: SupportStrings }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [hasThread, setHasThread] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const lastId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async (read: boolean) => {
    try {
      const res = await fetch(`/api/support/messages?after=${lastId.current}${read ? "&read=1" : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Poll;
      setHasThread(data.thread);
      if (!data.thread) return;
      setUnread(data.unread ?? 0);
      if (data.messages?.length) {
        lastId.current = data.messages[data.messages.length - 1]!.id;
        setMessages((prev) => [...prev, ...data.messages!.filter((m) => !prev.some((p) => p.id === m.id))]);
      }
    } catch {
      /* offline — try again on the next tick */
    }
  }, []);

  useEffect(() => {
    void poll(false);
  }, [poll]);

  useEffect(() => {
    if (!open && !hasThread) return;
    const tick = () => {
      if (!document.hidden) void poll(open);
    };
    if (open) tick();
    const timer = setInterval(tick, open ? 4000 : 30000);
    return () => clearInterval(timer);
  }, [open, hasThread, poll]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || (!hasThread && name.trim().length < 2)) {
      setError(s.validation);
      return;
    }
    setSending(true);
    setError("");
    const res = await sendSupportMessageAction({ name, phone, message, locale });
    setSending(false);
    if (!res.ok) {
      setError(res.error === "rateLimited" ? s.rateLimited : res.error === "invalidPhone" ? s.invalidPhone : res.error === "validation" ? s.validation : s.error);
      return;
    }
    setText("");
    setHasThread(true);
    await poll(true);
  }

  const who = (m: ChatMessage) => (m.sender === "customer" ? s.you : m.sender === "bot" ? s.bot : s.staff);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        aria-label={unread ? `${s.open} (${unread})` : s.open}
        className="fixed bottom-4 end-4 z-40 grid size-14 place-items-center rounded-full bg-brand text-brand-fg shadow-lift transition hover:scale-105"
      >
        <Icon name={open ? "close" : "chat"} className="size-6.5" />
        {unread > 0 && !open ? (
          <span className="absolute -top-1 -end-1 grid min-w-6 place-items-center rounded-full bg-danger px-1.5 text-xs font-bold text-white" aria-hidden="true">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          id={`${uid}-panel`}
          role="dialog"
          aria-label={s.title}
          className="animate-in fixed inset-x-0 bottom-0 z-40 flex h-[82dvh] flex-col overflow-hidden rounded-t-3xl border border-line bg-elevated shadow-lift sm:inset-x-auto sm:end-4 sm:bottom-22 sm:h-[34rem] sm:w-[23rem] sm:rounded-3xl"
        >
          <header className="hero-gradient flex items-start justify-between gap-3 px-4 py-3.5 text-white">
            <div>
              <h2 className="font-extrabold">{s.title}</h2>
              <p className="text-xs text-white/85">{s.subtitle}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={s.close} className="grid size-9 place-items-center rounded-xl hover:bg-white/15">
              <Icon name="close" className="size-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-bg p-4" aria-live="polite">
            {hasThread === null ? (
              <div className="flex justify-center py-10"><Spinner className="size-5" /></div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "customer" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                      m.sender === "customer" ? "bg-brand text-brand-fg" : m.sender === "bot" ? "border border-line bg-muted" : "border border-accent/30 bg-accent-soft"
                    }`}
                  >
                    <p className={`mb-0.5 text-[0.68rem] font-semibold ${m.sender === "customer" ? "text-brand-fg/80" : "text-fg-subtle"}`}>
                      {who(m)} · <span className="ltr-nums">{timeOf(m.createdAt, locale)}</span>
                    </p>
                    <MessageBody body={m.body} linkify={m.sender === "bot"} />
                  </div>
                </div>
              ))
            )}
            {hasThread === false ? <p className="text-center text-xs text-fg-subtle">{s.privacy}</p> : null}
          </div>

          <form onSubmit={send} className="space-y-2 border-t border-line p-3">
            {hasThread === false ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">
                  <span className="sr-only">{s.name}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={s.name} autoComplete="name" className="h-10 w-full rounded-xl border border-line-strong bg-elevated px-3 text-sm focus:border-brand focus:outline-none" />
                </label>
                <label className="text-xs font-semibold">
                  <span className="sr-only">{s.phone}</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder={s.phone} title={s.phoneHint} type="tel" dir="ltr" autoComplete="tel" className="h-10 w-full rounded-xl border border-line-strong bg-elevated px-3 text-sm focus:border-brand focus:outline-none" />
                </label>
              </div>
            ) : null}
            {error ? <p className="text-xs font-semibold text-danger" role="alert">{error}</p> : null}
            <div className="flex items-end gap-2">
              <label className="flex-1">
                <span className="sr-only">{s.placeholder}</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={1}
                  maxLength={1000}
                  placeholder={s.placeholder}
                  className="max-h-28 min-h-11 w-full resize-none rounded-xl border border-line-strong bg-elevated px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
                />
              </label>
              <button type="submit" disabled={sending} aria-label={hasThread ? s.send : s.start} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-fg disabled:opacity-60">
                {sending ? <Spinner className="size-5" /> : <Icon name="chevron-end" className="size-5 rtl:rotate-180" />}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
