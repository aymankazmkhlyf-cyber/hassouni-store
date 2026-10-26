import { describe, expect, it } from "vitest";
import ar from "@/lib/i18n/dictionaries/ar";
import en from "@/lib/i18n/dictionaries/en";
import { dirFor, fmt, formatDateTime, isLocale, localized, otherLocale, switchLocalePath } from "@/lib/i18n/config";
import { faq } from "@/lib/i18n/content";

function shape(o: unknown, prefix = ""): string[] {
  if (typeof o !== "object" || o === null) return [prefix];
  if (Array.isArray(o)) return [`${prefix}[${o.length}]`, ...o.flatMap((v, i) => shape(v, `${prefix}[${i}]`))];
  return Object.entries(o).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
}

describe("localization", () => {
  it("Arabic and English dictionaries have identical keys", () => {
    expect(shape(en).sort()).toEqual(shape(ar).sort());
  });
  it("no translation is empty", () => {
    const empties = (d: unknown, p = ""): string[] =>
      typeof d === "string" ? (d.trim() ? [] : [p]) : Object.entries(d as object).flatMap(([k, v]) => empties(v, `${p}.${k}`));
    expect(empties(ar)).toEqual([]);
    expect(empties(en)).toEqual([]);
  });
  it("English strings contain no Arabic script and the Arabic UI is actually Arabic", () => {
    const strings = (d: unknown): string[] => (typeof d === "string" ? [d] : Object.values(d as object).flatMap(strings));
    // The language switcher label is the one intentional exception.
    const offenders = strings(en).filter((s) => /[؀-ۿ]/.test(s) && s !== "العربية");
    expect(offenders).toEqual([]);
    expect(/[؀-ۿ]/.test(ar.nav.home)).toBe(true);
  });
  it("FAQ exists in both languages with the same length", () => {
    expect(faq.ar.length).toBe(faq.en.length);
  });
  it("RTL for Arabic, LTR for English", () => {
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
    expect(otherLocale("ar")).toBe("en");
    expect(isLocale("fr")).toBe(false);
  });
  it("language switch preserves path and query", () => {
    expect(switchLocalePath("/ar/services/pubg-mobile-uc", "sort=price_asc", "en")).toBe("/en/services/pubg-mobile-uc?sort=price_asc");
    expect(switchLocalePath("/en", "", "ar")).toBe("/ar");
    expect(switchLocalePath("/en/orders/HDS-1", "?key=ABC", "ar")).toBe("/ar/orders/HDS-1?key=ABC");
    expect(switchLocalePath("/", "", "en")).toBe("/en/");
  });
  it("interpolates and picks bilingual fields", () => {
    expect(fmt("Page {page} of {pages}", { page: 2, pages: 5 })).toBe("Page 2 of 5");
    expect(fmt("{missing}", {})).toBe("{missing}");
    expect(localized({ nameAr: "س", nameEn: "X" }, "name", "en")).toBe("X");
  });
  it("formats dates in Baghdad time", () => {
    // 21:30 UTC is 00:30 the next day in Baghdad (UTC+3).
    expect(formatDateTime("2026-01-01T21:30:00Z", "en")).toContain("2 Jan 2026");
    expect(formatDateTime("2026-01-01T21:30:00Z", "en")).toContain("00:30");
  });
});
