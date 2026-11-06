import "server-only";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import { BOOTSTRAP_DDL } from "./bootstrap-sql";
import * as schema from "./schema";

type DB = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;

// Reuse the database instance across hot reloads in development.
const globalForDb = globalThis as unknown as { __db?: DB };

function createDb(): DB {
  const url = env().DATABASE_URL.trim();

  // Local embedded PostgreSQL (no Docker or external Postgres server needed!)
  if (url.startsWith("file:")) {
    const relPath = url.slice("file:".length) || "./.local-pgdata";
    const dataDir = path.resolve(process.cwd(), relPath);
    const client = new PGlite(dataDir);
    // PGlite serialises operations on an internal mutex, so this DDL runs before any query.
    void client.exec(BOOTSTRAP_DDL);
    return drizzlePglite(client, { schema });
  }

  // External / VPS PostgreSQL server
  const sql = postgres(url, { max: 10 });
  void sql.unsafe(BOOTSTRAP_DDL).catch(() => {
    // Ignore if concurrent worker already ran bootstrap
  });
  return drizzlePostgres(sql, { schema });
}

export function db(): PgliteDatabase<typeof schema> {
  if (!globalForDb.__db) {
    globalForDb.__db = createDb();
  }
  return globalForDb.__db as PgliteDatabase<typeof schema>;
}

export { schema };
