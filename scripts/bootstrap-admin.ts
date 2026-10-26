import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import { users } from "../src/lib/db/schema";
import { upsertStaffAccount } from "../src/lib/services/accounts";

/*
 * Runs during the hosting build (see "vercel-build" in package.json) so the
 * store owner never needs a terminal. It creates the first admin ONLY when
 * ADMIN_EMAIL + ADMIN_PASSWORD are set AND no account with that email exists.
 * It never resets an existing password. Remove ADMIN_PASSWORD from the host
 * settings after the first successful deploy.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    console.log("bootstrap-admin: ADMIN_EMAIL/ADMIN_PASSWORD not set — skipped.");
    return;
  }
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    console.log("bootstrap-admin: account already exists — skipped (password unchanged).");
    return;
  }
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  await upsertStaffAccount({ email, name: process.env.ADMIN_NAME?.trim() || "Store admin", password, role: "admin" });
  console.log(`bootstrap-admin: admin account created for ${email}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
