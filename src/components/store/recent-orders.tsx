"use client";

import { useEffect } from "react";

const KEY = "hds_recent_orders";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type Recent = { ref: string; key: string; at: number };

export function readRecentOrders(): Recent[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is Recent => !!x && typeof x.ref === "string" && typeof x.key === "string" && typeof x.at === "number")
      .filter((x) => Date.now() - x.at < MAX_AGE_MS)
      .slice(0, 5);
  } catch {
    return [];
  }
}

/** Remembers this device's own order link so checkout can warn about orders still in progress. */
export function RememberOrder({ reference, accessKey }: { reference: string; accessKey: string }) {
  useEffect(() => {
    try {
      const rest = readRecentOrders().filter((r) => r.ref !== reference);
      localStorage.setItem(KEY, JSON.stringify([{ ref: reference, key: accessKey, at: Date.now() }, ...rest].slice(0, 5)));
    } catch {
      /* storage unavailable */
    }
  }, [reference, accessKey]);
  return null;
}
