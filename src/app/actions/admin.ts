"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { assertPermission, AuthError } from "@/lib/auth/current-user";
import type { Permission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { checkUpload } from "@/lib/domain/file-signature";
import { isLocale } from "@/lib/i18n/config";
import { anonymizeCustomer, setCustomerStatus } from "@/lib/services/accounts";
import type { Actor } from "@/lib/services/audit";
import { audit } from "@/lib/services/audit";
import { deleteCategory, deleteProduct, moveCategory, saveCategory, saveProduct, updatePaymentMethod } from "@/lib/services/admin-catalog";
import { updateCustomRequest } from "@/lib/services/custom-requests";
import { storeFile } from "@/lib/services/files";
import { reviewPayment, ServiceError, transitionOrder, updateAdminNotes } from "@/lib/services/orders";
import { loadSettings, saveSettings, storeSettingsSchema } from "@/lib/services/settings";
import {
  adminNotesSchema,
  categorySchema,
  fieldErrors,
  paymentMethodSchema,
  paymentReviewSchema,
  productSchema,
  statusChangeSchema,
} from "@/lib/validation/schemas";
import { normalizePhone } from "@/lib/domain/phone";
import { isSafeHttpUrl } from "@/lib/domain/contact";
import type { ActionState } from "./types";

const actorOf = (u: SessionUser): Actor => ({ id: u.id, email: u.email, role: u.role });

/** Every admin action goes through here: server-side permission check + uniform error handling. */
async function guarded(permission: Permission, fn: (actor: Actor) => Promise<ActionState>): Promise<ActionState> {
  try {
    const user = await assertPermission(permission);
    return await fn(actorOf(user));
  } catch (e) {
    unstable_rethrow(e); // let redirect()/notFound() through
    if (e instanceof AuthError) return { error: e.code };
    if (e instanceof ServiceError) return { error: e.code };
    console.error("admin action failed", e instanceof Error ? e.message : "unknown");
    return { error: "generic" };
  }
}

function localeOf(fd: FormData) {
  const l = fd.get("locale");
  return isLocale(l) ? l : "ar";
}

const entries = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));

/* -------------------------------- Orders ------------------------------- */

export async function reviewPaymentAction(_p: ActionState, fd: FormData) {
  return guarded("payments:review", async (actor) => {
    const parsed = paymentReviewSchema.safeParse(entries(fd));
    if (!parsed.success) return { error: "validation" };
    await reviewPayment(parsed.data.paymentId, parsed.data.decision, parsed.data.note, actor);
    revalidatePath("/[locale]/admin", "layout");
    return { ok: true };
  });
}

export async function changeOrderStatusAction(_p: ActionState, fd: FormData) {
  return guarded("orders:update", async (actor) => {
    const parsed = statusChangeSchema.safeParse(entries(fd));
    if (!parsed.success) return { error: "validation" };
    await transitionOrder(parsed.data.orderId, parsed.data.toStatus, { type: "staff", user: actor }, parsed.data.note || null);
    revalidatePath("/[locale]/admin", "layout");
    return { ok: true };
  });
}

export async function saveAdminNotesAction(_p: ActionState, fd: FormData) {
  return guarded("orders:update", async (actor) => {
    const parsed = adminNotesSchema.safeParse(entries(fd));
    if (!parsed.success) return { error: "validation" };
    await updateAdminNotes(parsed.data.orderId, parsed.data.adminNotes, actor);
    revalidatePath("/[locale]/admin/orders/[id]", "page");
    return { ok: true, message: "saved" };
  });
}

/* ------------------------------- Products ------------------------------ */

export async function saveProductAction(_p: ActionState, fd: FormData) {
  return guarded("products:write", async (actor) => {
    const idRaw = fd.get("id");
    const id = idRaw ? Number(idRaw) : null;
    if (id !== null && !Number.isSafeInteger(id)) return { error: "validation" };

    const parsed = productSchema.safeParse(entries(fd));
    if (!parsed.success) return { error: "validation", fieldErrors: fieldErrors(parsed.error) };

    let imageFileId: string | null = null;
    const file = fd.get("image");
    if (file instanceof File && file.size > 0) {
      const checked = await checkUpload(file, ["image/jpeg", "image/png", "image/webp"]);
      if (!checked.ok) return { error: checked.error, fieldErrors: { image: checked.error } };
      imageFileId = await storeFile("product_image", checked.mime, checked.bytes, actor.id);
    }

    const result = await saveProduct(id, parsed.data, { fileId: imageFileId, remove: parsed.data.removeImage }, actor);
    if (!result.ok) {
      const { field, line, reason } = result.error;
      return { error: "validation", fieldErrors: { [field]: line ? `line:${line}:${reason}` : reason } };
    }
    revalidatePath("/[locale]", "layout");
    redirect(`/${localeOf(fd)}/admin/products/${result.id}?saved=1`);
  });
}

export async function deleteProductAction(_p: ActionState, fd: FormData) {
  return guarded("products:write", async (actor) => {
    const id = Number(fd.get("id"));
    if (!Number.isSafeInteger(id)) return { error: "validation" };
    const outcome = await deleteProduct(id, actor);
    revalidatePath("/[locale]", "layout");
    if (outcome === "deactivated") return { ok: true, message: "deactivated" };
    redirect(`/${localeOf(fd)}/admin/products`);
  });
}

/* ------------------------------ Categories ----------------------------- */

export async function saveCategoryAction(_p: ActionState, fd: FormData) {
  return guarded("categories:write", async (actor) => {
    const idRaw = fd.get("id");
    const id = idRaw ? Number(idRaw) : null;
    const parsed = categorySchema.safeParse(entries(fd));
    if (!parsed.success) return { error: "validation", fieldErrors: fieldErrors(parsed.error) };
    const res = await saveCategory(id, parsed.data, actor);
    if (!res.ok) return { error: "validation", fieldErrors: { slug: "taken" } };
    revalidatePath("/[locale]", "layout");
    return { ok: true, message: "saved" };
  });
}

export async function moveCategoryAction(fd: FormData) {
  await guarded("categories:write", async (actor) => {
    const id = Number(fd.get("id"));
    const dir = fd.get("direction") === "up" ? "up" : "down";
    if (Number.isSafeInteger(id)) await moveCategory(id, dir, actor);
    revalidatePath("/[locale]", "layout");
    return { ok: true };
  });
}

export async function deleteCategoryAction(_p: ActionState, fd: FormData) {
  return guarded("categories:write", async (actor) => {
    const id = Number(fd.get("id"));
    if (!Number.isSafeInteger(id)) return { error: "validation" };
    const res = await deleteCategory(id, actor);
    if (res === "has_products") return { error: "hasProducts" };
    revalidatePath("/[locale]", "layout");
    return { ok: true };
  });
}

/* ---------------------------- Payment methods -------------------------- */

export async function savePaymentMethodAction(_p: ActionState, fd: FormData) {
  return guarded("payment_methods:write", async (actor) => {
    const id = Number(fd.get("id"));
    const parsed = paymentMethodSchema.safeParse(entries(fd));
    if (!parsed.success || !Number.isSafeInteger(id)) return { error: "validation" };
    await updatePaymentMethod(id, parsed.data, actor);
    revalidatePath("/[locale]", "layout");
    return { ok: true, message: "saved" };
  });
}

/* -------------------------------- Settings ----------------------------- */

const settingsForm = z.object({
  storeNameAr: z.string().trim().min(1).max(120),
  storeNameEn: z.string().trim().min(1).max(120),
  whatsapp: z.string().trim().max(30),
  telegram: z.string().trim().max(40).regex(/^@?[A-Za-z0-9_]{0,32}$/, "validation"),
  instagram: z.string().trim().max(300).refine((v) => v === "" || isSafeHttpUrl(v), "invalidUrl"),
  supportEmail: z.union([z.literal(""), z.email("invalidEmail")]),
  hoursAr: z.string().trim().max(200),
  hoursEn: z.string().trim().max(200),
  noticeAr: z.string().trim().max(300),
  noticeEn: z.string().trim().max(300),
  heroTitleAr: z.string().trim().max(120),
  heroTitleEn: z.string().trim().max(120),
  heroSubtitleAr: z.string().trim().max(400),
  heroSubtitleEn: z.string().trim().max(400),
  retentionDays: z.coerce.number().int().min(30).max(3650),
  termsAr: z.string().max(20000),
  termsEn: z.string().max(20000),
  privacyAr: z.string().max(20000),
  privacyEn: z.string().max(20000),
  refundAr: z.string().max(20000),
  refundEn: z.string().max(20000),
});

export async function saveSettingsAction(_p: ActionState, fd: FormData) {
  return guarded("settings:write", async (actor) => {
    const parsed = settingsForm.safeParse(entries(fd));
    if (!parsed.success) return { error: "validation", fieldErrors: fieldErrors(parsed.error) };
    const whatsapp = parsed.data.whatsapp ? normalizePhone(parsed.data.whatsapp) : "";
    if (whatsapp === null) return { error: "validation", fieldErrors: { whatsapp: "invalidPhone" } };

    const current = await loadSettings();
    let logoFileId = current.logoFileId;
    const logo = fd.get("logo");
    if (logo instanceof File && logo.size > 0) {
      const checked = await checkUpload(logo, ["image/jpeg", "image/png", "image/webp"]);
      if (!checked.ok) return { error: checked.error, fieldErrors: { logo: checked.error } };
      logoFileId = await storeFile("logo", checked.mime, checked.bytes, actor.id);
    } else if (fd.get("removeLogo") === "on") {
      logoFileId = null;
    }

    const policiesChanged = (["termsAr", "termsEn", "privacyAr", "privacyEn", "refundAr", "refundEn"] as const).some(
      (k) => current[k] !== parsed.data[k],
    );
    await saveSettings(
      storeSettingsSchema.parse({
        ...current,
        ...parsed.data,
        telegram: parsed.data.telegram.replace(/^@/, ""),
        whatsapp,
        logoFileId,
        ordersEnabled: fd.get("ordersEnabled") === "on",
        showOffers: fd.get("showOffers") === "on",
        policiesUpdatedAt: policiesChanged ? new Date().toISOString() : current.policiesUpdatedAt,
      }),
    );
    await audit(actor, "settings.update", "settings", "store", { policiesChanged });
    revalidatePath("/[locale]", "layout");
    return { ok: true, message: "saved" };
  });
}

/* ------------------------------- Customers ----------------------------- */

export async function setCustomerStatusAction(_p: ActionState, fd: FormData) {
  return guarded("customers:write", async (actor) => {
    const id = z.uuid().safeParse(fd.get("id"));
    if (!id.success) return { error: "validation" };
    await setCustomerStatus(id.data, fd.get("status") === "suspended" ? "suspended" : "active", actor);
    revalidatePath("/[locale]/admin/customers", "layout");
    return { ok: true };
  });
}

export async function anonymizeCustomerAction(_p: ActionState, fd: FormData) {
  return guarded("customers:write", async (actor) => {
    const id = z.uuid().safeParse(fd.get("id"));
    if (!id.success) return { error: "validation" };
    await anonymizeCustomer(id.data, actor);
    revalidatePath("/[locale]/admin", "layout");
    redirect(`/${localeOf(fd)}/admin/customers`);
  });
}

/* ---------------------------- Custom requests -------------------------- */

const requestUpdate = z.object({
  id: z.uuid(),
  status: z.enum(["new", "in_review", "quoted", "closed"]),
  adminNotes: z.string().trim().max(3000).default(""),
});

export async function updateRequestAction(_p: ActionState, fd: FormData) {
  return guarded("requests:manage", async (actor) => {
    const parsed = requestUpdate.safeParse(entries(fd));
    if (!parsed.success) return { error: "validation" };
    await updateCustomRequest(parsed.data.id, parsed.data.status, parsed.data.adminNotes, actor);
    revalidatePath("/[locale]/admin/requests", "page");
    return { ok: true, message: "saved" };
  });
}
