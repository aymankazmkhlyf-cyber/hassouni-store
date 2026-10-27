import { and, asc, desc, eq, gt, inArray, or } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import {
  files,
  orderItems,
  orderStatusHistory,
  orders,
  paymentMethods,
  payments,
  type OrderStatus,
} from "@/lib/db/schema";
import { canTransition, customerCanSubmitPayment } from "@/lib/domain/order-status";
import {
  generateAccessKey,
  generateOrderReference,
  normalizeAccessKey,
  normalizeReference,
  safeEqualHex,
  sha256,
} from "@/lib/domain/tokens";
import type { CheckoutInput } from "@/lib/validation/schemas";
import { audit, type Actor } from "./audit";
import { applyWalletChange } from "./wallet";
import { quoteCart, type QuotedLine } from "./quote";
import { loadSettings } from "./settings";

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly extra?: unknown,
  ) {
    super(code);
  }
}

/** Customer access keys stay valid for a year; logged-in owners can always see their orders. */
export const ACCESS_KEY_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** A repeated submission with the same idempotency key within this window gets the same order back. */
const IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000;

export type CreateOrderResult = {
  orderId: string;
  reference: string;
  accessKey: string;
  duplicate: boolean;
};

/**
 * Creates an order inside one transaction. Totals are computed from the
 * database (quoteCart); nothing price-related from the browser is used.
 * The idempotency key makes double-clicks / retries return the same order.
 */
export async function createOrder(
  input: CheckoutInput,
  ctx: { userId: string | null },
  conn: DbOrTx = db,
): Promise<CreateOrderResult> {
  return conn.transaction(async (tx) => {
    // Fast path for retries: same browser attempt -> same order.
    const existing = await tx.query.orders.findFirst({ where: eq(orders.idempotencyKey, input.idempotencyKey) });
    if (existing) return rotateDuplicate(tx, existing);

    const settings = await loadSettings(tx);
    if (!settings.ordersEnabled) throw new ServiceError("product_unavailable");

    const viaWallet = input.paymentMethodId === "wallet";
    if (viaWallet && !ctx.userId) throw new ServiceError("walletLoginRequired");
    const method = viaWallet
      ? WALLET_METHOD
      : await tx.query.paymentMethods.findFirst({
          where: and(eq(paymentMethods.id, input.paymentMethodId as number), eq(paymentMethods.isEnabled, true)),
        });
    if (!method) throw new ServiceError("paymentMethod");

    const quote = await quoteCart(input.items, tx);
    if (!quote.valid) throw new ServiceError("cartInvalid", quote.lines.filter((l) => !l.ok));
    const quotedLines = quote.lines.filter((l): l is Extract<QuotedLine, { ok: true }> => l.ok);
    const active = await activeDuplicate(tx, quotedLines, input.customerPhone, ctx.userId);
    if (active) throw new ServiceError("activeOrderExists", { reference: active });

    const accessKey = generateAccessKey();
    const now = new Date();

    // ON CONFLICT closes the race where two identical submissions pass the check above concurrently.
    const inserted = await tx
      .insert(orders)
      .values({
        reference: generateOrderReference(),
        accessKeyHash: sha256(accessKey),
        accessKeyExpiresAt: new Date(now.getTime() + ACCESS_KEY_TTL_MS),
        idempotencyKey: input.idempotencyKey,
        userId: ctx.userId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        customerNotes: input.customerNotes,
        status: viaWallet ? "paid" : "pending_payment",
        paidAt: viaWallet ? now : null,
        paymentMethodId: method.id,
        paymentMethodCode: method.code,
        paymentMethodNameAr: method.nameAr,
        paymentMethodNameEn: method.nameEn,
        subtotal: quote.total,
        total: quote.total,
        termsAcceptedAt: now,
        locale: input.locale,
      })
      .onConflictDoNothing({ target: orders.idempotencyKey })
      .returning({ id: orders.id, reference: orders.reference });

    const order = inserted[0];
    if (!order) {
      const winner = await tx.query.orders.findFirst({ where: eq(orders.idempotencyKey, input.idempotencyKey) });
      if (!winner) throw new ServiceError("generic");
      return rotateDuplicate(tx, winner);
    }

    await tx.insert(orderItems).values(
      quotedLines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        packageId: l.packageId,
        productNameAr: l.nameAr,
        productNameEn: l.nameEn,
        packageLabelAr: l.packageLabelAr,
        packageLabelEn: l.packageLabelEn,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        lineTotal: l.lineTotal,
        inputs: l.inputs,
      })),
    );
    if (viaWallet) {
      // Debits the balance (throws insufficientBalance and rolls the whole order back).
      await applyWalletChange(tx, { userId: ctx.userId!, amount: -quote.total, type: "order_payment", orderId: order.id, note: order.reference });
    }
    await tx.insert(payments).values({
      orderId: order.id,
      methodCode: method.code,
      amount: quote.total,
      status: viaWallet ? "confirmed" : "awaiting",
      ...(viaWallet ? { submittedAt: now, reviewedAt: now } : {}),
    });
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: viaWallet ? "paid" : "pending_payment",
      actorType: "customer",
      actorId: ctx.userId,
    });

    return { orderId: order.id, reference: order.reference, accessKey, duplicate: false };
  });
}

/** Pseudo payment method for orders paid from the customer's wallet balance. */
const WALLET_METHOD = { id: null, code: "wallet", nameAr: "رصيد المحفظة", nameEn: "Wallet balance" } as const;

/** Orders still being worked on, where a second identical order would overlap. */
const IN_PROGRESS: OrderStatus[] = ["payment_review", "paid", "processing"];

/**
 * Same customer (phone or account), same service, same target details (link,
 * player ID…) while an earlier order is still in progress → returns its
 * reference so the customer is asked to wait for it to finish first.
 */
async function activeDuplicate(tx: DbOrTx, lines: { productId: number; inputs: { key: string; value: string }[] }[], phone: string, userId: string | null) {
  const targeted = lines.filter((l) => l.inputs.some((i) => i.value));
  if (!targeted.length) return null;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const owner = userId ? or(eq(orders.customerPhone, phone), eq(orders.userId, userId))! : eq(orders.customerPhone, phone);
  const rows = await tx
    .select({ reference: orders.reference, productId: orderItems.productId, inputs: orderItems.inputs })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(owner, inArray(orders.status, IN_PROGRESS), gt(orders.createdAt, since), inArray(orderItems.productId, targeted.map((l) => l.productId))))
    .limit(50);
  const sig = (inputs: { key: string; value: string }[]) =>
    inputs
      .filter((i) => i.value)
      .map((i) => `${i.key}=${i.value.trim().toLowerCase()}`)
      .sort()
      .join("&");
  for (const l of targeted) {
    const hit = rows.find((r) => r.productId === l.productId && sig(r.inputs) === sig(l.inputs));
    if (hit) return hit.reference;
  }
  return null;
}

async function rotateDuplicate(
  tx: DbOrTx,
  existing: { id: string; reference: string; createdAt: Date },
): Promise<CreateOrderResult> {
  if (Date.now() - existing.createdAt.getTime() > IDEMPOTENCY_WINDOW_MS) throw new ServiceError("cartInvalid");
  // Only the hash is stored, so the original key cannot be re-sent. Possession of the
  // (secret, per-attempt) idempotency key proves it is the same browser, so issue a fresh key.
  const accessKey = generateAccessKey();
  await tx.update(orders).set({ accessKeyHash: sha256(accessKey) }).where(eq(orders.id, existing.id));
  return { orderId: existing.id, reference: existing.reference, accessKey, duplicate: true };
}

/* ------------------------------------------------------------------ */
/* Reading orders                                                      */
/* ------------------------------------------------------------------ */

function orderWith() {
  return {
    items: { orderBy: asc(orderItems.id) },
    payments: { orderBy: desc(payments.createdAt) },
    history: { orderBy: asc(orderStatusHistory.createdAt) },
  } as const;
}

export async function loadOrderFull(orderId: string, conn: DbOrTx = db) {
  return conn.query.orders.findFirst({ where: eq(orders.id, orderId), with: orderWith() });
}
export type FullOrder = NonNullable<Awaited<ReturnType<typeof loadOrderFull>>>;

/** Customer access by reference + access key. Wrong key, unknown reference and expiry all return null. */
export async function getOrderByAccessKey(reference: string, accessKey: string, conn: DbOrTx = db) {
  const ref = normalizeReference(reference);
  const key = normalizeAccessKey(accessKey);
  if (!ref || key.length < 20) return null;
  const order = await conn.query.orders.findFirst({
    where: and(eq(orders.reference, ref), gt(orders.accessKeyExpiresAt, new Date())),
    with: orderWith(),
  });
  if (!order || !safeEqualHex(order.accessKeyHash, sha256(key))) return null;
  return order;
}

export async function getOrderForUser(reference: string, userId: string, conn: DbOrTx = db) {
  return conn.query.orders.findFirst({
    where: and(eq(orders.reference, normalizeReference(reference)), eq(orders.userId, userId)),
    with: orderWith(),
  });
}

export async function listOrdersForUser(userId: string, conn: DbOrTx = db) {
  return conn.query.orders.findMany({
    where: eq(orders.userId, userId),
    orderBy: desc(orders.createdAt),
    limit: 100,
    with: { items: { columns: { productNameAr: true, productNameEn: true, quantity: true } } },
  });
}

/* ------------------------------------------------------------------ */
/* Status transitions                                                  */
/* ------------------------------------------------------------------ */

export type TransitionActor =
  | { type: "customer"; userId: string | null }
  | { type: "staff"; user: Actor }
  | { type: "system" };

/** Applies a validated status change with its side effects, inside the caller's transaction. */
async function applyTransition(tx: DbOrTx, orderId: string, to: OrderStatus, actor: TransitionActor, note: string | null) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order) throw new ServiceError("notFound");
  if (!canTransition(order.status, to)) throw new ServiceError("invalidTransition");

  const now = new Date();
  await tx
    .update(orders)
    .set({
      status: to,
      ...(to === "paid" && !order.paidAt ? { paidAt: now } : {}),
      ...(to === "completed" ? { completedAt: now } : {}),
    })
    .where(eq(orders.id, orderId));

  const staffId = actor.type === "staff" ? actor.user.id : null;
  if (to === "paid") {
    // Marking paid directly (e.g. verified by phone) confirms the latest open payment record.
    const [open] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.orderId, orderId), inArray(payments.status, ["awaiting", "submitted"])))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    if (open)
      await tx.update(payments).set({ status: "confirmed", reviewedById: staffId, reviewedAt: now }).where(eq(payments.id, open.id));
  }
  if (to === "refunded") {
    await tx
      .update(payments)
      .set({ status: "refunded" })
      .where(and(eq(payments.orderId, orderId), eq(payments.status, "confirmed")));
    // Wallet payments go straight back to the wallet.
    if (order.paymentMethodCode === "wallet" && order.userId) {
      await applyWalletChange(tx, { userId: order.userId, amount: order.total, type: "order_refund", orderId, staffId, note: order.reference });
    }
  }

  await tx.insert(orderStatusHistory).values({
    orderId,
    fromStatus: order.status,
    toStatus: to,
    actorType: actor.type,
    actorId: actor.type === "staff" ? actor.user.id : actor.type === "customer" ? actor.userId : null,
    note: note || null,
  });
  if (actor.type === "staff") {
    await audit(actor.user, "order.status", "order", orderId, { reference: order.reference, from: order.status, to, note: note || undefined }, tx);
  }
  return { from: order.status, to, reference: order.reference };
}

export async function transitionOrder(orderId: string, to: OrderStatus, actor: TransitionActor, note: string | null = null, conn: DbOrTx = db) {
  return conn.transaction((tx) => applyTransition(tx, orderId, to, actor, note));
}

/* ------------------------------------------------------------------ */
/* Manual payment workflow                                             */
/* ------------------------------------------------------------------ */

/**
 * Customer submits a transaction reference and/or receipt. This NEVER marks the
 * order as paid — it only moves it to "payment under review".
 */
export async function submitPaymentProof(
  orderId: string,
  proof: { customerReference: string | null; receipt: { mime: string; bytes: Buffer } | null },
  ctx: { userId: string | null },
  conn: DbOrTx = db,
) {
  return conn.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new ServiceError("notFound");
    if (!customerCanSubmitPayment(order.status)) throw new ServiceError("orderLocked");
    if (!proof.customerReference && !proof.receipt) throw new ServiceError("proofNeedOne");

    const method = order.paymentMethodId
      ? await tx.query.paymentMethods.findFirst({ where: eq(paymentMethods.id, order.paymentMethodId) })
      : undefined;
    if (method?.requiresReference && !proof.customerReference) throw new ServiceError("proofNeedOne");
    if (proof.receipt && method && !method.allowsReceipt) throw new ServiceError("file_type");

    let receiptFileId: string | null = null;
    if (proof.receipt) {
      const [file] = await tx
        .insert(files)
        .values({
          kind: "receipt",
          mimeType: proof.receipt.mime,
          size: proof.receipt.bytes.length,
          sha256: sha256(proof.receipt.bytes.toString("base64")),
          data: proof.receipt.bytes,
        })
        .returning({ id: files.id });
      receiptFileId = file!.id;
    }

    const [latest] = await tx
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt))
      .limit(1);

    const now = new Date();
    if (latest && (latest.status === "awaiting" || latest.status === "submitted")) {
      // Replacing an unreviewed proof: drop the previous receipt file.
      if (latest.receiptFileId && receiptFileId) await tx.delete(files).where(eq(files.id, latest.receiptFileId));
      await tx
        .update(payments)
        .set({
          status: "submitted",
          customerReference: proof.customerReference ?? latest.customerReference,
          receiptFileId: receiptFileId ?? latest.receiptFileId,
          submittedAt: now,
          amount: order.total,
        })
        .where(eq(payments.id, latest.id));
    } else {
      await tx.insert(payments).values({
        orderId,
        methodCode: order.paymentMethodCode,
        amount: order.total,
        status: "submitted",
        customerReference: proof.customerReference,
        receiptFileId,
        submittedAt: now,
      });
    }

    if (order.status === "pending_payment") {
      await applyTransition(tx, orderId, "payment_review", { type: "customer", userId: ctx.userId }, null);
    }
  });
}

/** Staff confirms or rejects a submitted payment proof. */
export async function reviewPayment(
  paymentId: string,
  decision: "confirm" | "reject",
  note: string,
  actor: Actor,
  conn: DbOrTx = db,
) {
  return conn.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!payment) throw new ServiceError("notFound");
    if (payment.status !== "submitted") throw new ServiceError("invalidTransition");
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.orderId));
    if (!order) throw new ServiceError("notFound");

    const now = new Date();
    if (decision === "confirm") {
      if (!canTransition(order.status, "paid")) throw new ServiceError("invalidTransition");
      await tx
        .update(payments)
        .set({ status: "confirmed", reviewedById: actor.id, reviewedAt: now, reviewNote: note || null })
        .where(eq(payments.id, paymentId));
      await applyTransition(tx, order.id, "paid", { type: "staff", user: actor }, note || null);
    } else {
      await tx
        .update(payments)
        .set({ status: "rejected", reviewedById: actor.id, reviewedAt: now, reviewNote: note || null })
        .where(eq(payments.id, paymentId));
      if (order.status === "payment_review") {
        await applyTransition(tx, order.id, "pending_payment", { type: "staff", user: actor }, note || null);
      }
    }
    await audit(actor, `payment.${decision}`, "payment", paymentId, { reference: order.reference, amount: payment.amount }, tx);
    return { orderId: order.id };
  });
}

export async function updateAdminNotes(orderId: string, adminNotes: string, actor: Actor, conn: DbOrTx = db) {
  const updated = await conn.update(orders).set({ adminNotes }).where(eq(orders.id, orderId)).returning({ reference: orders.reference });
  if (!updated[0]) throw new ServiceError("notFound");
  await audit(actor, "order.notes", "order", orderId, { reference: updated[0].reference }, conn);
}

/** Message shown to the customer on the order page (codes, delivery details). Its content is not written to the audit log. */
export async function updateDeliveryNote(orderId: string, deliveryNote: string, actor: Actor, conn: DbOrTx = db) {
  const updated = await conn.update(orders).set({ deliveryNote }).where(eq(orders.id, orderId)).returning({ reference: orders.reference });
  if (!updated[0]) throw new ServiceError("notFound");
  await audit(actor, "order.delivery_note", "order", orderId, { reference: updated[0].reference, length: deliveryNote.length }, conn);
}

/** Latest payment record determines the customer-facing payment status. */
export function latestPayment<T extends { createdAt: Date }>(list: T[]): T | undefined {
  return [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}
