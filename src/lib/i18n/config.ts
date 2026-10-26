export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";
export const LOCALE_COOKIE = "hds_locale";
export const TIME_ZONE = "Asia/Baghdad";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}

/** Swap the locale prefix of a pathname while keeping the rest (and the query string) intact. */
export function switchLocalePath(pathname: string, search: string, to: Locale): string {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  const path = parts.join("/") || `/${to}`;
  return search ? `${path}${search.startsWith("?") ? search : `?${search}`}` : path;
}

/** Picks a bilingual field: localized(row, "name", "en") -> row.nameEn */
export function localized<T extends Record<string, unknown>, K extends string>(
  row: T & Record<`${K}Ar` | `${K}En`, unknown>,
  field: K,
  locale: Locale,
): string {
  const v = row[`${field}${locale === "ar" ? "Ar" : "En"}` as `${K}Ar`];
  return typeof v === "string" ? v : "";
}

export function formatDateTime(date: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ-u-nu-latn" : "en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDate(date: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ-u-nu-latn" : "en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/** Replaces {name} placeholders. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
