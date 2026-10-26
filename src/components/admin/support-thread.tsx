"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { staffReplyAction } from "@/app/actions/support";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { MessageBody, timeOf, type ChatMessage } from "@/components/support/message-body";

/** Live conversation view for staff; polls every 4 seconds. */
export function SupportThreadView({
  threadId,
  initial,
  locale,
  s,
}: {
  threadId: string;
  initial: ChatMessage[];
  locale: string;
  s: { customer: string; bot: string; staff: string; reply: string; send: string; error: string };
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const lastId = useRef(initial.at(-1)?.id ?? 0);
  const listRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/support/${threadId}/messages?after=${lastId.current}`, { cache: "no-store" });
      if (!res.ok) return;
      const { messages: fresh } = (await res.json()) as { messages: ChatMessage[] };
      if (fresh.length) {
        lastId.current = fresh.at(-1)!.id;
        setMessages((prev) => [...prev, ...fresh.filter((m) => !prev.some((p) => p.id === m.id))]);
      }
    } catch {
      /* retry */
    }
  }, [threadId]);

  useEffect(() => {
    const t = setInterval(() => !document.hidden && void refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");
    const r = await staffReplyAction(threadId, text);
    setSending(false);
    if (!r.ok) return setError(s.error);
    setText("");
    await refresh();
  }

  return (
    <div className="flex h-[70dvh] flex-col overflow-hidden rounded-(--radius-card) border border-line bg-elevated shadow-soft">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-bg p-4" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "staff" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                m.sender === "staff" ? "bg-brand text-brand-fg" : m.sender === "bot" ? "border border-dashed border-line-strong bg-muted text-fg-muted" : "border border-line bg-elevated"
              }`}
            >
              <p className={`mb-0.5 text-[0.68rem] font-semibold ${m.sender === "staff" ? "text-brand-fg/80" : "text-fg-subtle"}`}>
                {m.sender === "customer" ? s.customer : m.sender === "bot" ? s.bot : s.staff} · <span className="ltr-nums">{timeOf(m.createdAt, locale)}</span>
              </p>
              <MessageBody body={m.body} linkify={false} />
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
        <label className="flex-1">
          <span className="sr-only">{s.reply}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            maxLength={1000}
            placeholder={s.reply}
            className="w-full resize-none rounded-xl border border-line-strong bg-elevated px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </label>
        <button type="submit" disabled={sending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-brand-fg disabled:opacity-60">
          {sending ? <Spinner /> : <Icon name="chevron-end" className="size-4 rtl:rotate-180" />} {s.send}
        </button>
      </form>
      {error ? <p className="px-3 pb-3 text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
