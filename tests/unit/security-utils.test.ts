import { describe, expect, it } from "vitest";
import { buildOrderSupportMessage, isSafeHttpUrl, telegramHandle, telegramLink, whatsappLink } from "@/lib/domain/contact";
import { csvCell, toCsv } from "@/lib/domain/csv";
import { detectFileType } from "@/lib/domain/file-signature";
import { generateAccessKey, generateOrderReference, normalizeAccessKey, safeEqualHex, sha256 } from "@/lib/domain/tokens";
import { parseFields, parsePackages, parseTiers, serializeFields, serializePackages } from "@/lib/domain/admin-parse";

describe("contact links", () => {
  it("builds the store's WhatsApp, Telegram and Instagram links", () => {
    expect(whatsappLink("+9647757382822")).toBe("https://wa.me/9647757382822");
    expect(telegramLink("@h_gms")).toBe("https://t.me/h_gms");
    expect(telegramHandle("h_gms")).toBe("@h_gms");
    expect(isSafeHttpUrl("https://www.instagram.com/1q3v_")).toBe(true);
  });
  it("URL-encodes Arabic and newlines in prefilled messages", () => {
    const url = whatsappLink("+9647757382822", "مرحباً\nطلب: HDS-1&x=2");
    expect(url.startsWith("https://wa.me/9647757382822?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]!);
    expect(text).toBe("مرحباً\nطلب: HDS-1&x=2");
    expect(url).not.toContain("&x=2");
  });
  it("rejects invalid telegram handles and unsafe URLs", () => {
    expect(telegramLink("bad handle!")).toBe("https://t.me/");
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,x")).toBe(false);
  });
  it("support message contains only reference, status, total and items", () => {
    const msg = buildOrderSupportMessage({ reference: "HDS-AAAA-BBBB-CC", status: "Pending", total: "7,000 IQD", items: [{ name: "PUBG", quantity: 2 }] }, "en");
    expect(msg).toContain("HDS-AAAA-BBBB-CC");
    expect(msg).toContain("PUBG × 2");
    expect(msg).not.toMatch(/key|password|card/i);
  });
});

describe("tokens", () => {
  it("references and access keys are random and well-formed", () => {
    const refs = new Set(Array.from({ length: 500 }, () => generateOrderReference()));
    expect(refs.size).toBe(500);
    for (const r of refs) expect(r).toMatch(/^HDS-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{2}$/);
    expect(generateAccessKey()).toMatch(/^[0-9A-HJKMNP-TV-Z]{24}$/);
  });
  it("normalizes user-typed keys and compares hashes in constant time", () => {
    const k = generateAccessKey();
    expect(normalizeAccessKey(` ${k.toLowerCase().slice(0, 12)}-${k.toLowerCase().slice(12)} `)).toBe(k);
    expect(safeEqualHex(sha256(k), sha256(k))).toBe(true);
    expect(safeEqualHex(sha256(k), sha256(k + "x"))).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
});

describe("CSV export", () => {
  it("neutralizes spreadsheet formulas and escapes quotes", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+123")).toBe("'+123");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell(null)).toBe("");
  });
  it("starts with a BOM for Arabic in Excel", () => {
    expect(toCsv(["a"], [["ب"]])).toBe("﻿a\r\nب\r\n");
  });
});

describe("upload signature detection", () => {
  it("identifies real file types from magic bytes", () => {
    expect(detectFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectFileType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectFileType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
  });
  it("rejects HTML/SVG/executables disguised as images", () => {
    expect(detectFileType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectFileType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(detectFileType(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });
});

describe("admin product form parsers", () => {
  it("parses and round-trips packages", () => {
    const r = parsePackages("60 شدة | 60 UC | 1500\n325 شدة | 325 UC | 7000 | 8000\n");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual([
        { labelAr: "60 شدة", labelEn: "60 UC", price: 1500, compareAtPrice: null },
        { labelAr: "325 شدة", labelEn: "325 UC", price: 7000, compareAtPrice: 8000 },
      ]);
      expect(parsePackages(serializePackages(r.value))).toEqual(r);
    }
  });
  it("rejects fake discounts and bad lines with a line number", () => {
    expect(parsePackages("a | b | 1000 | 900")).toEqual({ ok: false, line: 1, reason: "compare_price" });
    expect(parsePackages("ok | ok | 10\nbroken")).toEqual({ ok: false, line: 2, reason: "format" });
    expect(parseTiers("1000 | 8\n1000 | 7")).toEqual({ ok: false, line: 2, reason: "duplicate" });
    expect(parseTiers("x | 8").ok).toBe(false);
  });
  it("refuses password / OTP fields", () => {
    expect(parseFields("password | كلمة المرور | Password | text | required")).toMatchObject({ ok: false, reason: "forbidden" });
    expect(parseFields("login | كلمة السر | Login | text | required")).toMatchObject({ ok: false, reason: "forbidden" });
    expect(parseFields("otp | رمز | OTP code | text | required")).toMatchObject({ ok: false, reason: "forbidden" });
  });
  it("parses select options and round-trips", () => {
    const r = parseFields("player_id | رقم اللاعب | Player ID | number | required\nfmt | نوع | Format | select | optional | print,digital");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value[1]).toMatchObject({ key: "fmt", required: false, options: [{ value: "print" }, { value: "digital" }] });
      expect(parseFields(serializeFields(r.value))).toEqual(r);
    }
    expect(parseFields("fmt | a | b | select | required")).toMatchObject({ ok: false, reason: "options" });
  });
});
