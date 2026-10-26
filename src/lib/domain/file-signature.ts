export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type AllowedMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/**
 * Detects the real file type from magic bytes. The browser-supplied MIME type
 * and file name are never trusted. SVG is deliberately not accepted (it can carry script).
 */
export function detectFileType(buf: Uint8Array): AllowedMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  )
    return "image/png";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return "image/webp";
  if (buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d)
    return "application/pdf";
  return null;
}

export type UploadCheck =
  | { ok: true; mime: AllowedMime; bytes: Buffer }
  | { ok: false; error: "file_missing" | "file_too_large" | "file_type" };

export async function checkUpload(file: unknown, allowed: readonly AllowedMime[]): Promise<UploadCheck> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "file_missing" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "file_too_large" };
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = detectFileType(bytes);
  if (!mime || !allowed.includes(mime)) return { ok: false, error: "file_type" };
  return { ok: true, mime, bytes };
}
