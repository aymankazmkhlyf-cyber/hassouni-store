import "dotenv/config";
import { Pool } from "pg";
import { runMigrations } from "../scripts/migrate";
import { seed } from "../scripts/seed";

/** Recreates the test database schema, applies migrations and runs the seed — every run starts clean. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn("TEST_DATABASE_URL not set — integration tests will be skipped.");
    return;
  }
  // Guard against ever wiping a real database.
  if (!/test/i.test(new URL(url).pathname)) throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  } finally {
    await pool.end();
  }
  await runMigrations(url);
  await seed(url);
}
