import { and, count, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { customRequests, files, orders, payments, users, type UserRole } from "@/lib/db/schema";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/auth/password";
import { invalidateUserSessions } from "@/lib/auth/session";
import { escapeLike } from "./catalog";
import { audit, type Actor } from "./audit";

export async function registerCustomer(
  input: { name: string; email: string; phone: string | null; password: string },
  conn: DbOrTx = db,
) {
  const passwordHash = await hashPassword(input.password);
  const rows = await conn
    .insert(users)
    .values({ name: input.name, email: input.email.toLowerCase(), phone: input.phone, passwordHash, role: "customer" })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, role: users.role });
  return rows[0] ?? null;
}

export type AuthResult =
  | { ok: true; user: { id: string; role: UserRole; email: string } }
  | { ok: false; reason: "invalid" | "suspended" };

/** Constant-ish time: a dummy hash is verified when the account does not exist. */
export async function authenticate(email: string, password: string, conn: DbOrTx = db): Promise<AuthResult> {
  const user = await conn.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (!user || user.anonymizedAt) {
    await burnPasswordCheck(password);
    return { ok: false, reason: "invalid" };
  }
  if (!(await verifyPassword(user.passwordHash, password))) return { ok: false, reason: "invalid" };
  if (user.status !== "active") return { ok: false, reason: "suspended" };
  await conn.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true, user: { id: user.id, role: user.role, email: user.email } };
}

/** Creates or promotes a staff/admin account (CLI bootstrap only — there is no web endpoint for this). */
export async function upsertStaffAccount(
  input: { email: string; name: string; password: string; role: "staff" | "admin" },
  conn: DbOrTx = db,
) {
  const passwordHash = await hashPassword(input.password);
  const email = input.email.toLowerCase();
  const [row] = await conn
    .insert(users)
    .values({ email, name: input.name, passwordHash, role: input.role })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash, role: input.role, name: input.name, status: "active" } })
    .returning({ id: users.id });
  await invalidateUserSessions(row!.id, conn);
  await audit(null, "staff.bootstrap", "user", row!.id, { role: input.role }, conn);
  return row!.id;
}

/* ------------------------------ Customers ------------------------------ */

export async function listCustomers(opts: { q?: string; page?: number }, conn: DbOrTx = db) {
  const pageSize = 25;
  const page = Math.max(opts.page ?? 1, 1);
  const q = opts.q?.trim().slice(0, 80);
  const conds = [sql`${users.anonymizedAt} IS NULL`];
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    conds.push(or(ilike(users.email, pattern), ilike(users.name, pattern), ...(digits.length >= 4 ? [ilike(users.phone, `%${digits}%`)] : []))!);
  }
  const where = sql.join(conds, sql` AND `);
  const [rows, totalRow] = await Promise.all([
    conn
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        orderCount: sql<number>`(SELECT count(*) FROM orders o WHERE o.user_id = "users"."id")`.mapWith(Number),
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    conn.select({ n: count() }).from(users).where(where),
  ]);
  return { rows, page, pages: Math.max(1, Math.ceil((totalRow[0]?.n ?? 0) / pageSize)) };
}

export async function getCustomer(id: string, conn: DbOrTx = db) {
  const user = await conn.query.users.findFirst({
    where: eq(users.id, id),
    columns: { passwordHash: false },
  });
  if (!user) return null;
  const list = await conn.query.orders.findMany({
    where: eq(orders.userId, id),
    orderBy: desc(orders.createdAt),
    columns: { id: true, reference: true, status: true, total: true, createdAt: true },
    limit: 100,
  });
  return { user, orders: list };
}

export async function setCustomerStatus(id: string, status: "active" | "suspended", actor: Actor, conn: DbOrTx = db) {
  await conn.transaction(async (tx) => {
    const target = await tx.query.users.findFirst({ where: eq(users.id, id) });
    // Staff/admin accounts are managed from the CLI, never suspended from the web UI.
    if (!target || target.role !== "customer") return;
    await tx.update(users).set({ status }).where(eq(users.id, id));
    if (status === "suspended") await invalidateUserSessions(id, tx);
    await audit(actor, `customer.${status === "suspended" ? "suspend" : "reactivate"}`, "user", id, {}, tx);
  });
}

const ERASED = "[deleted]";

/** Removes personal data from orders. Financial data (amounts, items, statuses) is kept. */
async function scrubOrders(tx: DbOrTx, orderIds: string[]) {
  if (orderIds.length === 0) return;
  const receiptIds = (
    await tx.select({ id: payments.receiptFileId }).from(payments).where(inArray(payments.orderId, orderIds))
  )
    .map((r) => r.id)
    .filter((x): x is string => !!x);
  await tx
    .update(orders)
    .set({ customerName: ERASED, customerPhone: "", customerEmail: null, customerNotes: "", userId: null, anonymizedAt: new Date() })
    .where(inArray(orders.id, orderIds));
  await tx.execute(sql`UPDATE order_items SET inputs = '[]'::jsonb WHERE order_id IN (${sql.join(orderIds.map((i) => sql`${i}::uuid`), sql`, `)})`);
  await tx.update(payments).set({ customerReference: null, receiptFileId: null }).where(inArray(payments.orderId, orderIds));
  if (receiptIds.length) await tx.delete(files).where(inArray(files.id, receiptIds));
}

/** Account deletion (by the customer or an admin): scrub linked orders, then delete the user row. */
export async function anonymizeCustomer(id: string, actor: Actor | null, conn: DbOrTx = db) {
  await conn.transaction(async (tx) => {
    const target = await tx.query.users.findFirst({ where: eq(users.id, id) });
    if (!target || target.role !== "customer") return;
    const linked = await tx.select({ id: orders.id }).from(orders).where(eq(orders.userId, id));
    await scrubOrders(tx, linked.map((o) => o.id));
    await tx.update(customRequests).set({ userId: null, name: ERASED, phone: "", email: null, anonymizedAt: new Date() }).where(eq(customRequests.userId, id));
    await tx.delete(users).where(eq(users.id, id));
    await audit(actor, "customer.erase", "user", id, { orders: linked.length }, tx);
  });
}

/** Retention job: scrub personal data from finished orders older than `days`. */
export async function runRetention(days: number, conn: DbOrTx = db) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return conn.transaction(async (tx) => {
    const old = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          inArray(orders.status, ["completed", "cancelled", "rejected", "refunded"]),
          lt(orders.updatedAt, cutoff),
          sql`${orders.anonymizedAt} IS NULL`,
        ),
      )
      .limit(5000);
    await scrubOrders(tx, old.map((o) => o.id));
    const reqs = await tx
      .update(customRequests)
      .set({ name: ERASED, phone: "", email: null, anonymizedAt: new Date() })
      .where(and(eq(customRequests.status, "closed"), lt(customRequests.updatedAt, cutoff), sql`${customRequests.anonymizedAt} IS NULL`))
      .returning({ id: customRequests.id });
    await audit(null, "retention.run", "system", null, { orders: old.length, requests: reqs.length, days }, tx);
    return { orders: old.length, requests: reqs.length };
  });
}
