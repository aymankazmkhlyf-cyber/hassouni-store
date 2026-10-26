import type { FieldDef } from "./fields";
import { isForbiddenFieldKey } from "./fields";

/*
 * The admin product form edits packages, tiers and customer fields as
 * pipe-separated lines (works well on mobile). These parsers are strict and
 * report the first bad line.
 */

export type ParsedPackage = { labelAr: string; labelEn: string; price: number; compareAtPrice: number | null };
export type ParsedTier = { minQuantity: number; unitPrice: number };
export type ParseResult<T> = { ok: true; value: T[] } | { ok: false; line: number; reason: string };

const intOf = (s: string | undefined) => (s && /^\d{1,10}$/.test(s.trim()) ? Number(s.trim()) : null);

function lines(text: string) {
  return text
    .split(/\r?\n/)
    .map((l, i) => ({ line: i + 1, text: l.trim() }))
    .filter((l) => l.text !== "");
}

export function parsePackages(text: string): ParseResult<ParsedPackage> {
  const out: ParsedPackage[] = [];
  for (const { line, text: t } of lines(text)) {
    const [ar, en, price, compare] = t.split("|").map((p) => p.trim());
    const p = intOf(price);
    if (!ar || !en || p == null) return { ok: false, line, reason: "format" };
    const c = compare ? intOf(compare) : null;
    if (compare && (c == null || c <= p)) return { ok: false, line, reason: "compare_price" };
    out.push({ labelAr: ar.slice(0, 120), labelEn: en.slice(0, 120), price: p, compareAtPrice: c });
  }
  return { ok: true, value: out.slice(0, 50) };
}

export function parseTiers(text: string): ParseResult<ParsedTier> {
  const out: ParsedTier[] = [];
  for (const { line, text: t } of lines(text)) {
    const [min, price] = t.split("|").map((p) => p.trim());
    const m = intOf(min);
    const p = intOf(price);
    if (m == null || m < 1 || p == null) return { ok: false, line, reason: "format" };
    if (out.some((x) => x.minQuantity === m)) return { ok: false, line, reason: "duplicate" };
    out.push({ minQuantity: m, unitPrice: p });
  }
  return { ok: true, value: out.sort((a, b) => a.minQuantity - b.minQuantity).slice(0, 20) };
}

const TYPES = ["text", "textarea", "url", "number", "select", "phone"] as const;

export function parseFields(text: string): ParseResult<Omit<FieldDef, "maxLength"> & { maxLength: number }> {
  const out: FieldDef[] = [];
  for (const { line, text: t } of lines(text)) {
    const [key, ar, en, type = "text", req = "required", opts = ""] = t.split("|").map((p) => p.trim());
    if (!key || !/^[a-z][a-z0-9_]{0,39}$/.test(key) || !ar || !en) return { ok: false, line, reason: "format" };
    if (isForbiddenFieldKey(key) || /كلمة\s*(ال)?سر|كلمة\s*المرور|password|otp/i.test(`${ar} ${en}`))
      return { ok: false, line, reason: "forbidden" };
    if (!(TYPES as readonly string[]).includes(type)) return { ok: false, line, reason: "type" };
    if (out.some((f) => f.key === key)) return { ok: false, line, reason: "duplicate" };
    const options =
      type === "select"
        ? opts
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
            .map((o) => ({ value: o, labelAr: o, labelEn: o }))
        : [];
    if (type === "select" && options.length === 0) return { ok: false, line, reason: "options" };
    out.push({
      key,
      labelAr: ar.slice(0, 120),
      labelEn: en.slice(0, 120),
      type: type as FieldDef["type"],
      required: req !== "optional",
      maxLength: type === "textarea" ? 2000 : 200,
      options,
    });
  }
  return { ok: true, value: out.slice(0, 15) };
}

export function serializePackages(p: ParsedPackage[]): string {
  return p.map((x) => [x.labelAr, x.labelEn, x.price, x.compareAtPrice ?? ""].join(" | ").replace(/ \| $/, "")).join("\n");
}
export function serializeTiers(t: ParsedTier[]): string {
  return t.map((x) => `${x.minQuantity} | ${x.unitPrice}`).join("\n");
}
export function serializeFields(f: FieldDef[]): string {
  return f
    .map((x) =>
      [x.key, x.labelAr, x.labelEn, x.type, x.required ? "required" : "optional", x.options.map((o) => o.value).join(",")]
        .join(" | ")
        .replace(/ \| $/, ""),
    )
    .join("\n");
}
