import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pool } from "../src/lib/db";
import { upsertStaffAccount } from "../src/lib/services/accounts";

/*
 * First-admin / staff bootstrap. There is deliberately NO web endpoint that can
 * create staff accounts. Run this from a trusted machine with DATABASE_URL set:
 *
 *   npm run admin:create                     # interactive prompts
 *   npm run admin:create -- --role=staff     # create a staff (non-admin) account
 *   ADMIN_EMAIL=.. ADMIN_PASSWORD=.. ADMIN_NAME=.. npm run admin:create   # non-interactive
 *
 * Remove ADMIN_PASSWORD from the environment afterwards. Re-running with the
 * same email resets that account's password and signs out its sessions.
 */
async function main() {
  const role = process.argv.includes("--role=staff") ? "staff" : "admin";
  let email = process.env.ADMIN_EMAIL?.trim() ?? "";
  let name = process.env.ADMIN_NAME?.trim() ?? "";
  let password = process.env.ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    const rl = createInterface({ input: stdin, output: stdout });
    email ||= (await rl.question("Email: ")).trim();
    name ||= (await rl.question("Display name: ")).trim();
    if (!password) {
      stdout.write("Password (min 12 chars, input visible — run in a private terminal): ");
      password = (await rl.question("")).trim();
    }
    rl.close();
  }
  name ||= "Store admin";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("A valid email is required.");
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");

  await upsertStaffAccount({ email, name, password, role });
  console.log(`${role} account ready for ${email}. Log in at /ar/admin/login`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
