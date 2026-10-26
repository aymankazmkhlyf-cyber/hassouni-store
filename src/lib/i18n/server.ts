import "server-only";
import { notFound } from "next/navigation";
import { getDictionary } from "./index";
import { isLocale, type Locale } from "./config";

export type LocaleParams = { params: Promise<{ locale: string }> };

/** Resolves and validates the [locale] route param. */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<{ locale: Locale; t: ReturnType<typeof getDictionary> }> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { locale, t: getDictionary(locale) };
}

/** Normalizes a searchParams value to a single string. */
export function sp(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function pageNumber(value: string | string[] | undefined): number {
  const n = Number(sp(value));
  return Number.isSafeInteger(n) && n > 0 && n < 10_000 ? n : 1;
}
