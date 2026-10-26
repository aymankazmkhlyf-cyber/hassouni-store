import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction — services accept either. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __hdsPool?: Pool };

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    // Serverless platforms spawn many instances; keep each pool small.
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

// Reuse the pool across hot reloads in development.
export const pool = globalForDb.__hdsPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__hdsPool = pool;

export const db: Db = drizzle({ client: pool, schema });
export { schema };
