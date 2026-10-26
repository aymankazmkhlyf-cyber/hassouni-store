"use client";

import { useState, useTransition } from "react";
import { linkTelegramAction } from "@/app/actions/support";
import { fmt } from "@/lib/i18n/config";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function TelegramLink({ label, done, errors }: { label: string; done: string; errors: Record<string, string> }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await linkTelegramAction();
            setMsg(r.ok ? { ok: true, text: fmt(done, { name: r.name }) } : { ok: false, text: errors[r.error] ?? r.error });
          })
        }
      >
        {pending ? <Spinner /> : null} {label}
      </Button>
      {msg ? <Alert tone={msg.ok ? "success" : "danger"} title={msg.text} /> : null}
    </div>
  );
}
