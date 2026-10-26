import { db, type DbOrTx } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export type Actor = { id: string; email: string; role: "customer" | "staff" | "admin" };

/** Records a sensitive action. Never pass secrets, passwords or full personal data in `details`. */
export async function audit(
  actor: Actor | null,
  action: string,
  entityType: string,
  entityId: string | number | null,
  details: Record<string, unknown> = {},
  conn: DbOrTx = db,
) {
  await conn.insert(auditLogs).values({
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? null,
    action,
    entityType,
    entityId: entityId == null ? null : String(entityId),
    details,
  });
}
