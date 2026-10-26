/**
 * Normalizes Iraqi mobile numbers to E.164 (+9647XXXXXXXXX).
 * Accepts 07XXXXXXXXX, 7XXXXXXXXX, 9647XXXXXXXXX, +9647XXXXXXXXX, 009647XXXXXXXXX,
 * Arabic-Indic digits, spaces and dashes. Other international numbers are
 * accepted in +<8–15 digits> form. Returns null when the input is not a phone number.
 */
export function normalizePhone(input: string): string | null {
  const ascii = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-().]/g, "");

  let digits = ascii;
  let hadPlus = false;
  if (digits.startsWith("+")) {
    hadPlus = true;
    digits = digits.slice(1);
  } else if (digits.startsWith("00")) {
    hadPlus = true;
    digits = digits.slice(2);
  }
  if (!/^\d+$/.test(digits)) return null;

  if (!hadPlus) {
    if (/^07\d{9}$/.test(digits)) return `+964${digits.slice(1)}`;
    if (/^7\d{9}$/.test(digits)) return `+964${digits}`;
    if (/^9647\d{9}$/.test(digits)) return `+${digits}`;
    return null;
  }
  if (digits.startsWith("964")) return /^9647\d{9}$/.test(digits) ? `+${digits}` : null;
  return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
}

/** Masks a phone for low-privilege displays: +96477****2822 */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return "****";
  return `${phone.slice(0, 6)}****${phone.slice(-4)}`;
}
