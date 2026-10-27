import { and, count, desc, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { files, paymentMethods, users, walletTopups, walletTransactions, type TopupStatus, type WalletTxType } from "@/lib/db/schema";
import { normalizePhone } from "@/lib/domain/phone";
import { sha256 } from "@/lib/domain/tokens";
import { audit, type Actor } from "./audit";
import { ServiceError } from "./orders";

/*
 * Customer wallet. The balance lives on users.wallet_balance and is only ever
 * changed inside a transaction that locks the user row and appends one
 * wallet_transactions row, so the ledger always explains the balance.
 * Money comes in two ways: staff approve a top-up request (the customer paid
 * through a manual method and sent proof), or an admin credits it directly.
 */

export const WALLET_MIN_TOPUP = 1000;
export const WALLET_MAX_TOPUP = 5_000_000;
/** Open (unreviewed) top-up requests a customer may have at once. */
const MAX_OPEN_TOPUPS = 3;

/* ------------------------------ Usernames ------------------------------ */

export const USERNAME_RE = /^[a-z][a-z0-9_.]{2,19}$/;
const RESERVED = new Set(["admin", "administrator", "root", "support", "staff", "hassouni", "hsony", "store", "wallet", "system", "help", "info", "owner"]);

export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

/** null when valid, otherwise an error key. */
export function usernameProblem(username: string): string | null {
  if (!USERNAME_RE.test(username) || username.includes("..")) return "usernameInvalid";
  if (RESERVED.has(username)) return "usernameTaken";
  return null;
}

/** Sets the wallet ID once; it cannot be changed afterwards (staff top up by it). */
export async function setUsername(userId: string, raw: string, conn: DbOrTx = db) {
  const username = normalizeUsername(raw);
  const problem = usernameProblem(username);
  if (problem) throw new ServiceError(problem);
  const updated = await conn
    .update(users)
    .set({ username })
    .where(and(eq(users.id, userId), sql`${users.username} IS NULL`, sql`NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.username = ${username})`))
    .returning({ id: users.id });
  if (!updated[0]) {
    const me = await conn.query.users.findFirst({ where: eq(users.id, userId), columns: { username: true } });
    throw new ServiceError(me?.username ? "usernameLocked" : "usernameTaken");
  }
  return username;
}

/* ------------------------------- Ledger -------------------------------- */

type Change = {
  userId: string;
  amount: number;
  type: WalletTxType;
  orderId?: string | null;
  topupId?: string | null;
  staffId?: string | null;
  note?: string;
};

/** Applies one balance change inside the caller's transaction. Throws insufficientBalance on overdraft. */
export async function applyWalletChange(tx: DbOrTx, c: Change): Promise<number> {
  if (!Number.isSafeInteger(c.amount) || c.amount === 0) throw new ServiceError("validation");
  const [user] = await tx
    .select({ balance: users.walletBalance, role: users.role, anonymizedAt: users.anonymizedAt })
    .from(users)
    .where(eq(users.id, c.userId))
    .for("update");
  if (!user || user.role !== "customer" || user.anonymizedAt) throw new ServiceError("notFound");
  const next = user.balance + c.amount;
  if (next < 0) throw new ServiceError("insufficientBalance");
  await tx.update(users).set({ walletBalance: next }).where(eq(users.id, c.userId));
  await tx.insert(walletTransactions).values({
    userId: c.userId,
    type: c.type,
    amount: c.amount,
    balanceAfter: next,
    orderId: c.orderId ?? null,
    topupId: c.topupId ?? null,
    staffId: c.staffId ?? null,
    note: c.note ?? "",
  });
  return next;
}

export async function getWallet(userId: string, conn: DbOrTx = db) {
  const user = await conn.query.users.findFirst({ where: eq(users.id, userId), columns: { walletBalance: true, username: true } });
  if (!user) return null;
  const [transactions, topups] = await Promise.all([
    conn.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.id)).limit(50),
    conn
      .select({
        id: walletTopups.id,
        amount: walletTopups.amount,
        status: walletTopups.status,
        methodNameAr: walletTopups.methodNameAr,
        methodNameEn: walletTopups.methodNameEn,
        reviewNote: walletTopups.reviewNote,
        createdAt: walletTopups.createdAt,
      })
      .from(walletTopups)
      .where(eq(walletTopups.userId, userId))
      .orderBy(desc(walletTopups.createdAt))
      .limit(20),
  ]);
  return { balance: user.walletBalance, username: user.username, transactions, topups };
}

/* ------------------------- Customer top-up requests --------------------- */

export async function createTopup(
  userId: string,
  input: { amount: number; methodId: number; customerReference: string | null; receipt: { mime: string; bytes: Buffer } | null },
  conn: DbOrTx = db,
) {
  if (!Number.isSafeInteger(input.amount) || input.amount < WALLET_MIN_TOPUP || input.amount > WALLET_MAX_TOPUP) throw new ServiceError("topupAmount");
  if (!input.customerReference && !input.receipt) throw new ServiceError("proofNeedOne");
  return conn.transaction(async (tx) => {
    const [user] = await tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).for("update");
    if (!user || user.role !== "customer") throw new ServiceError("forbidden");
    const [open] = await tx.select({ n: count() }).from(walletTopups).where(and(eq(walletTopups.userId, userId), eq(walletTopups.status, "submitted")));
    if ((open?.n ?? 0) >= MAX_OPEN_TOPUPS) throw new ServiceError("topupTooMany");
    const method = await tx.query.paymentMethods.findFirst({ where: and(eq(paymentMethods.id, input.methodId), eq(paymentMethods.isEnabled, true)) });
    if (!method) throw new ServiceError("paymentMethod");
    if (input.receipt && !method.allowsReceipt) throw new ServiceError("file_type");

    let receiptFileId: string | null = null;
    if (input.receipt) {
      const [file] = await tx
        .insert(files)
        .values({ kind: "receipt", mimeType: input.receipt.mime, size: input.receipt.bytes.length, sha256: sha256(input.receipt.bytes.toString("base64")), data: input.receipt.bytes })
        .returning({ id: files.id });
      receiptFileId = file!.id;
    }
    const [row] = await tx
      .insert(walletTopups)
      .values({
        userId,
        amount: input.amount,
        methodCode: method.code,
        methodNameAr: method.nameAr,
        methodNameEn: method.nameEn,
        customerReference: input.customerReference,
        receiptFileId,
      })
      .returning({ id: walletTopups.id });
    return { id: row!.id, methodNameAr: method.nameAr };
  });
}

/** Staff approve (credits the wallet) or reject a submitted top-up. */
export async function reviewTopup(id: string, decision: "approve" | "reject", note: string, actor: Actor, conn: DbOrTx = db) {
  return conn.transaction(async (tx) => {
    const [topup] = await tx.select().from(walletTopups).where(eq(walletTopups.id, id)).for("update");
    if (!topup) throw new ServiceError("notFound");
    if (topup.status !== "submitted") throw new ServiceError("invalidTransition");
    if (decision === "reject" && !note.trim()) throw new ServiceError("reasonRequired");
    if (!topup.userId) throw new ServiceError("notFound");
    const now = new Date();
    await tx
      .update(walletTopups)
      .set({ status: decision === "approve" ? "approved" : "rejected", reviewedById: actor.id, reviewedAt: now, reviewNote: note.trim() || null })
      .where(eq(walletTopups.id, id));
    let balance: number | null = null;
    if (decision === "approve") {
      balance = await applyWalletChange(tx, { userId: topup.userId, amount: topup.amount, type: "topup", topupId: id, staffId: actor.id, note: note.trim() });
    }
    await audit(actor, `wallet.topup_${decision}`, "wallet_topup", id, { amount: topup.amount, method: topup.methodCode }, tx);
    return { userId: topup.userId, amount: topup.amount, balance };
  });
}

/* ------------------------------- Admin ---------------------------------- */

/** Finds a customer by wallet ID (username), email or phone number. */
export async function findCustomer(identifier: string, conn: DbOrTx = db) {
  const q = identifier.trim();
  if (!q) return null;
  const conds = [eq(users.username, normalizeUsername(q)), eq(users.email, q.toLowerCase())];
  const phone = normalizePhone(q);
  if (phone) conds.push(eq(users.phone, phone));
  const rows = await conn
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, username: users.username, walletBalance: users.walletBalance, status: users.status })
    .from(users)
    .where(and(eq(users.role, "customer"), sql`${users.anonymizedAt} IS NULL`, sql`(${sql.join(conds, sql` OR `)})`))
    .limit(2);
  // An ambiguous match (e.g. shared phone) is refused rather than guessed.
  return rows.length === 1 ? rows[0]! : null;
}

/** Direct credit (positive) or debit (negative) by an admin, e.g. cash received in person. */
export async function adminAdjustWallet(userId: string, amount: number, note: string, actor: Actor, conn: DbOrTx = db) {
  if (!note.trim()) throw new ServiceError("reasonRequired");
  return conn.transaction(async (tx) => {
    const balance = await applyWalletChange(tx, { userId, amount, type: amount > 0 ? "admin_credit" : "admin_debit", staffId: actor.id, note: note.trim() });
    await audit(actor, amount > 0 ? "wallet.credit" : "wallet.debit", "user", userId, { amount, balance }, tx);
    return balance;
  });
}

export async function listTopupsAdmin(f: { status?: TopupStatus; page?: number }, conn: DbOrTx = db) {
  const pageSize = 25;
  const page = Math.max(f.page ?? 1, 1);
  const where = f.status ? eq(walletTopups.status, f.status) : undefined;
  const [rows, totalRow] = await Promise.all([
    conn
      .select({
        id: walletTopups.id,
        amount: walletTopups.amount,
        status: walletTopups.status,
        methodNameAr: walletTopups.methodNameAr,
        methodNameEn: walletTopups.methodNameEn,
        customerReference: walletTopups.customerReference,
        receiptFileId: walletTopups.receiptFileId,
        reviewNote: walletTopups.reviewNote,
        createdAt: walletTopups.createdAt,
        userId: users.id,
        userName: users.name,
        username: users.username,
        email: users.email,
        balance: users.walletBalance,
      })
      .from(walletTopups)
      .leftJoin(users, eq(users.id, walletTopups.userId))
      .where(where)
      .orderBy(sql`${walletTopups.status} = 'submitted' DESC`, desc(walletTopups.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    conn.select({ n: count() }).from(walletTopups).where(where),
  ]);
  return { rows, page, pages: Math.max(1, Math.ceil((totalRow[0]?.n ?? 0) / pageSize)) };
}

export async function openTopupCount(conn: DbOrTx = db) {
  const [row] = await conn.select({ n: count() }).from(walletTopups).where(eq(walletTopups.status, "submitted"));
  return row?.n ?? 0;
}

export async function recentWalletTransactions(userId: string, conn: DbOrTx = db) {
  return conn.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.id)).limit(20);
}
