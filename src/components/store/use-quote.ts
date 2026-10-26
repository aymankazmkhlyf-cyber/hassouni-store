"use client";

import { useEffect, useRef, useState } from "react";
import type { CartLine } from "@/lib/domain/cart";
import type { Quote } from "@/lib/services/quote";
import { quoteCartAction } from "@/app/actions/cart";

/** Fetches the authoritative server quote whenever the cart changes (debounced). */
export function useServerQuote(lines: CartLine[], ready: boolean) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);
  const signature = JSON.stringify(lines.map((l) => [l.productId, l.packageId, l.quantity, l.inputs]));

  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0) {
      setQuote({ lines: [], total: 0, valid: false });
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await quoteCartAction(lines.map(({ productId, packageId, quantity, inputs }) => ({ productId, packageId, quantity, inputs })));
        if (id !== seq.current) return;
        if ("error" in res) {
          setFailed(true);
          setQuote(null);
        } else {
          setFailed(false);
          setQuote(res);
        }
      } catch {
        if (id === seq.current) setFailed(true);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature captures line content
  }, [signature, ready]);

  return { quote, loading, failed };
}
