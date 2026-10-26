import type { Locale } from "@/lib/i18n/config";

/** Upper bound for any single order (IQD). Keeps totals well inside a 32-bit integer column. */
export const MAX_ORDER_TOTAL_IQD = 1_000_000_000;

export function isValidIqdAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_ORDER_TOTAL_IQD;
}

const grouping = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Formats a whole-dinar amount. Western digits are used in both languages,
 * which is the common convention for prices and phone numbers in Iraq.
 */
export function formatIQD(amount: number, locale: Locale): string {
  const n = grouping.format(Math.round(amount));
  return locale === "ar" ? `${n} د.ع` : `${n} IQD`;
}
