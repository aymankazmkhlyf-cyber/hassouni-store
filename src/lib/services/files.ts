import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { sha256 } from "@/lib/domain/tokens";

/*
 * Files live in Postgres (bytea), never in the public web root. This keeps the
 * app deployable on platforms without persistent disks, and lets every read go
 * through an authorization check in /api/files/[id]. Uploads are capped at 5 MB.
 */

export async function storeFile(
  kind: "product_image" | "receipt" | "logo",
  mime: string,
  bytes: Buffer,
  uploadedById: string | null,
  conn: DbOrTx = db,
): Promise<string> {
  const [row] = await conn
    .insert(files)
    .values({ kind, mimeType: mime, size: bytes.length, sha256: sha256(bytes.toString("base64")), data: bytes, uploadedById })
    .returning({ id: files.id });
  return row!.id;
}

export async function readFile(id: string, conn: DbOrTx = db) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return conn.query.files.findFirst({ where: eq(files.id, id) });
}

export async function deleteFile(id: string, conn: DbOrTx = db) {
  await conn.delete(files).where(eq(files.id, id));
}
