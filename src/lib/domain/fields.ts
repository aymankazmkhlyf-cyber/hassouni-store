import { normalizePhone } from "./phone";
import { isSafeHttpUrl } from "./contact";

export type FieldDef = {
  key: string;
  labelAr: string;
  labelEn: string;
  type: "text" | "textarea" | "url" | "number" | "select" | "phone";
  required: boolean;
  maxLength: number;
  options: { value: string; labelAr: string; labelEn: string }[];
};

export type FieldError = { key: string; code: "fieldRequired" | "fieldInvalid" | "tooLong" };

/** Keys that must never be collected (credentials / card data). Enforced on admin save AND on checkout. */
const FORBIDDEN_KEY = /(pass|pwd|otp|cvv|cvc|pin|card|secret|token|code_?verif|2fa)/i;

export function isForbiddenFieldKey(key: string): boolean {
  return FORBIDDEN_KEY.test(key);
}

/**
 * Validates customer-provided values against the product's field definitions.
 * Unknown keys are dropped so customers cannot attach arbitrary data.
 */
export function validateFieldValues(
  defs: FieldDef[],
  raw: Record<string, unknown>,
): { ok: true; values: { key: string; labelAr: string; labelEn: string; value: string }[] } | { ok: false; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const values: { key: string; labelAr: string; labelEn: string; value: string }[] = [];

  for (const def of defs) {
    if (isForbiddenFieldKey(def.key)) continue;
    const input = raw[def.key];
    let value = typeof input === "string" ? input.trim() : "";
    if (!value) {
      if (def.required) errors.push({ key: def.key, code: "fieldRequired" });
      continue;
    }
    if (value.length > Math.min(def.maxLength, 2000)) {
      errors.push({ key: def.key, code: "tooLong" });
      continue;
    }
    switch (def.type) {
      case "url":
        if (!isSafeHttpUrl(value)) errors.push({ key: def.key, code: "fieldInvalid" });
        break;
      case "number":
        if (!/^\d{1,30}$/.test(value)) errors.push({ key: def.key, code: "fieldInvalid" });
        break;
      case "phone": {
        const p = normalizePhone(value);
        if (!p) errors.push({ key: def.key, code: "fieldInvalid" });
        else value = p;
        break;
      }
      case "select":
        if (!def.options.some((o) => o.value === value)) errors.push({ key: def.key, code: "fieldInvalid" });
        break;
      default:
        break;
    }
    values.push({ key: def.key, labelAr: def.labelAr, labelEn: def.labelEn, value });
  }
  return errors.length ? { ok: false, errors } : { ok: true, values };
}
