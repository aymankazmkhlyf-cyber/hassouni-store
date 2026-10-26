import { count, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { db, type DbOrTx } from "@/lib/db";
import { customRequests, type RequestStatus } from "@/lib/db/schema";
import { randomBase32 } from "@/lib/domain/tokens";
import type { customRequestSchema } from "@/lib/validation/schemas";
import { audit, type Actor } from "./audit";

export async function createCustomRequest(input: z.infer<typeof customRequestSchema>, userId: string | null, conn: DbOrTx = db) {
  const r = randomBase32(8);
  const reference = `REQ-${r.slice(0, 4)}-${r.slice(4)}`;
  await conn.insert(customRequests).values({ ...input, reference, userId });
  return reference;
}

export async function listCustomRequests(opts: { status?: RequestStatus; page?: number }, conn: DbOrTx = db) {
  const pageSize = 20;
  const page = Math.max(opts.page ?? 1, 1);
  const where = opts.status ? eq(customRequests.status, opts.status) : undefined;
  const [rows, totalRow] = await Promise.all([
    conn.select().from(customRequests).where(where).orderBy(desc(customRequests.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    conn.select({ n: count() }).from(customRequests).where(where),
  ]);
  return { rows, page, pages: Math.max(1, Math.ceil((totalRow[0]?.n ?? 0) / pageSize)) };
}

export async function updateCustomRequest(id: string, status: RequestStatus, adminNotes: string, actor: Actor, conn: DbOrTx = db) {
  await conn.update(customRequests).set({ status, adminNotes }).where(eq(customRequests.id, id));
  await audit(actor, "custom_request.update", "custom_request", id, { status }, conn);
}
