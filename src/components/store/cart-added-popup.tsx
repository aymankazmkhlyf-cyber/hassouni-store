"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatIQD } from "@/lib/domain/money";
import { fmt, type Locale } from "@/lib/i18n/config";
import { Button, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export type AddedItem = {
  /** Changes on every add so the popup restarts even for the same product. */
  id: number;
  name: string;
  packageLabel: string | null;
  quantity: number;
  /** Quantity of this line in the cart after the add (differs when merged into an existing line). */
  inCartQuantity: number;
  lineTotal: number;
  details: { label: string; value: string }[];
};

export type CartAddedStrings = {
  added: string;
  goToCart: string;
  continueShopping: string;
  undo: string;
  undone: string;
  inCartNow: string;
  quantity: string;
  close: string;
};

const AUTO_CLOSE_MS = 8000;

/**
 * Confirmation shown right after something is added to the cart, so the
 * customer sees exactly what went in and can undo a mistaken add.
 */
export function CartAddedPopup({
  item,
  locale,
  s,
  onUndo,
  onClose,
}: {
  item: AddedItem;
  locale: Locale;
  s: CartAddedStrings;
  onUndo: () => void;
  onClose: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [undone, setUndone] = useState(false);
  const remaining = useRef(AUTO_CLOSE_MS);
  const startedAt = useRef(0);

  // Auto-close, paused while the customer hovers or focuses the popup.
  useEffect(() => {
    if (paused) return;
    const ms = undone ? 2500 : remaining.current;
    startedAt.current = Date.now();
    const timer = window.setTimeout(onClose, ms);
    return () => {
      window.clearTimeout(timer);
      if (!undone) remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, undone, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section
      aria-label={s.added}
      data-testid="cart-added-popup"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      className="animate-pop fixed inset-x-3 bottom-3 z-50 overflow-hidden rounded-2xl border border-line bg-elevated shadow-lift sm:inset-x-auto sm:end-4 sm:top-20 sm:bottom-auto sm:w-[23rem]"
    >
      <div className="flex items-start gap-3 p-4">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${undone ? "bg-muted text-fg-muted" : "bg-success-soft text-success"}`}>
          <Icon name={undone ? "close" : "check"} className="size-5" />
        </span>
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <p className="font-bold">{undone ? s.undone : s.added}</p>
          {undone ? null : (
            <>
              <p className="mt-1 truncate text-sm font-semibold">{item.name}</p>
              <p className="text-sm text-fg-muted">
                {item.packageLabel ? `${item.packageLabel} × ` : `${s.quantity}: `}
                <span className="ltr-nums" dir="ltr">{item.quantity.toLocaleString("en-US")}</span>
              </p>
              {item.details.map((d) => (
                <p key={d.label} className="truncate text-xs text-fg-subtle">
                  {d.label}: <span dir="auto">{d.value}</span>
                </p>
              ))}
              {item.inCartQuantity !== item.quantity ? (
                <p className="mt-1 text-xs font-semibold text-warning">{fmt(s.inCartNow, { qty: item.inCartQuantity.toLocaleString("en-US") })}</p>
              ) : null}
              <p className="ltr-nums mt-1.5 font-black text-brand" dir="ltr">{formatIQD(item.lineTotal, locale)}</p>
            </>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label={s.close} className="-m-1 grid size-9 shrink-0 place-items-center rounded-xl text-fg-subtle hover:bg-muted">
          <Icon name="close" className="size-4.5" />
        </button>
      </div>

      {undone ? null : (
        <div className="space-y-2 px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/${locale}/cart`} className={buttonClass("primary", "sm", "w-full")}>
              <Icon name="cart" className="size-4" /> {s.goToCart}
            </Link>
            <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
              {s.continueShopping}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              onUndo();
              setUndone(true);
            }}
            className="mx-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-danger hover:bg-danger-soft"
          >
            <Icon name="close" className="size-4" /> {s.undo}
          </button>
        </div>
      )}

      <span
        key={`${item.id}-${undone}`}
        aria-hidden="true"
        className="animate-drain absolute inset-x-0 bottom-0 block h-1 bg-brand/60"
        style={{ animationDuration: `${undone ? 2500 : AUTO_CLOSE_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
      />
    </section>
  );
}
