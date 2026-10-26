import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authCodes, users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, validateSessionToken } from "@/lib/auth/session";
import { changePasswordWithCode, MAX_CODE_ATTEMPTS, requestPasswordChange, requestPasswordReset, resetPasswordWithCode } from "@/lib/services/auth-codes";
import { hasDb, makeUser } from "./helpers";

/** Captures the code instead of emailing it. */
function inbox() {
  const box: { to: string; code: string }[] = [];
  return { box, deliver: async (to: string, code: string) => (box.push({ to, code }), true) };
}

describe.skipIf(!hasDb)("password reset / change with emailed codes", () => {
  it("resets a staff password with the emailed code and signs out every session", async () => {
    const admin = await makeUser("admin");
    const { token } = await createSession({ id: admin.id, role: "admin" }, null);
    const { box, deliver } = inbox();
    expect(await requestPasswordReset(admin.email.toUpperCase(), db, deliver)).toBe("sent");
    expect(box).toHaveLength(1);
    expect(box[0]!.code).toMatch(/^\d{6}$/);

    expect(await resetPasswordWithCode(admin.email, box[0]!.code, "brand-new-password-1")).toEqual({ ok: true });
    const row = await db.query.users.findFirst({ where: eq(users.id, admin.id) });
    expect(await verifyPassword(row!.passwordHash, "brand-new-password-1")).toBe(true);
    expect(await validateSessionToken(token)).toBeNull();
    // A code works only once.
    expect(await resetPasswordWithCode(admin.email, box[0]!.code, "another-password-22")).toMatchObject({ ok: false });
  });

  it("does not reveal unknown emails or send codes to customers", async () => {
    const customer = await makeUser("customer");
    const { box, deliver } = inbox();
    expect(await requestPasswordReset("nobody@example.test", db, deliver)).toBe("sent");
    expect(await requestPasswordReset(customer.email, db, deliver)).toBe("sent");
    expect(box).toHaveLength(0);
  });

  it("locks the code after too many wrong attempts", async () => {
    const admin = await makeUser("admin");
    const { box, deliver } = inbox();
    await requestPasswordReset(admin.email, db, deliver);
    const wrong = box[0]!.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < MAX_CODE_ATTEMPTS - 1; i++) expect(await resetPasswordWithCode(admin.email, wrong, "brand-new-password-1")).toEqual({ ok: false, reason: "invalid" });
    expect(await resetPasswordWithCode(admin.email, wrong, "brand-new-password-1")).toEqual({ ok: false, reason: "too_many" });
    // Even the right code no longer works.
    expect(await resetPasswordWithCode(admin.email, box[0]!.code, "brand-new-password-1")).toEqual({ ok: false, reason: "too_many" });
  });

  it("rejects expired codes and invalidates older codes when a new one is issued", async () => {
    const admin = await makeUser("admin");
    const { box, deliver } = inbox();
    await requestPasswordReset(admin.email, db, deliver);
    await requestPasswordReset(admin.email, db, deliver);
    expect(await resetPasswordWithCode(admin.email, box[0]!.code === box[1]!.code ? "x" : box[0]!.code, "brand-new-password-1")).toMatchObject({ ok: false });
    await db.update(authCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(authCodes.userId, admin.id));
    expect(await resetPasswordWithCode(admin.email, box[1]!.code, "brand-new-password-1")).toEqual({ ok: false, reason: "expired" });
  });

  it("enforces a 12+ character password and stores only a keyed hash of the code", async () => {
    const admin = await makeUser("admin");
    const { box, deliver } = inbox();
    await requestPasswordReset(admin.email, db, deliver);
    expect(await resetPasswordWithCode(admin.email, box[0]!.code, "short")).toEqual({ ok: false, reason: "weak" });
    const [row] = await db.select().from(authCodes).where(eq(authCodes.userId, admin.id));
    expect(row!.codeHash).not.toContain(box[0]!.code);
  });

  it("change flow requires the current password, then the emailed code", async () => {
    const staff = await makeUser("staff");
    const { box, deliver } = inbox();
    expect(await requestPasswordChange(staff.id, "wrong-password", db, deliver)).toBe("wrong_password");
    expect(box).toHaveLength(0);
    expect(await requestPasswordChange(staff.id, staff.password, db, deliver)).toBe("sent");
    expect(await changePasswordWithCode(staff.id, box[0]!.code, "changed-password-123")).toEqual({ ok: true });
    const row = await db.query.users.findFirst({ where: eq(users.id, staff.id) });
    expect(await verifyPassword(row!.passwordHash, "changed-password-123")).toBe(true);
    // A reset code cannot be used for the change flow and vice versa.
    await requestPasswordReset(staff.email, db, deliver);
    expect(await changePasswordWithCode(staff.id, box[1]!.code, "x-password-123456")).toMatchObject({ ok: false });
  });
});
