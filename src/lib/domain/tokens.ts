import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Crockford base32 without I, L, O, U — unambiguous when read aloud or typed.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomBase32(length: number): string {
  // 32 divides 256 evenly, so `byte % 32` has no modulo bias.
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % 32];
  return out;
}

/** Public order reference, e.g. HDS-7K2M-Q9XD-4T (50 bits of randomness). */
export function generateOrderReference(prefix = "HDS"): string {
  const r = randomBase32(10);
  return `${prefix}-${r.slice(0, 4)}-${r.slice(4, 8)}-${r.slice(8)}`;
}

/** Customer access key for an order (120 bits). Shown once; only the hash is stored. */
export function generateAccessKey(): string {
  return randomBase32(24);
}

export function normalizeAccessKey(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function normalizeReference(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string, secret = process.env.APP_SECRET ?? ""): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
