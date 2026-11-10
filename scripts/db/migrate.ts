/**
 * Applies `db/migrations/NNNN_name.sql` in order, each file once, recorded in `schema_migrations`.
 * Uses the direct connection (`DATABASE_URL_UNPOOLED`) over one WebSocket session.
 *
 *   bun run db:migrate
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, neonConfig } from "@neondatabase/serverless";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../db/migrations/", import.meta.url));
const FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
/** Serializes concurrent `db:migrate` runs. */
const LOCK_KEY = 7_262_001;

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set. Add the Neon direct connection string to .env.local.");
  if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;

  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => FILE_PATTERN.test(name)).sort();
  const client = new Client(url);
  await client.connect();
  try {
    await client.query("set statement_timeout = '30s'");
    await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const done = new Set((await client.query<{ name: string }>("select name from schema_migrations")).rows.map((row) => row.name));
    for (const name of files) {
      if (done.has(name)) continue;
      const text = await readFile(join(MIGRATIONS_DIR, name), "utf8");
      await client.query("begin");
      try {
        await client.query(text);
        await client.query("insert into schema_migrations (name) values ($1)", [name]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Migration ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      console.log(`applied ${name}`);
    }
    const applied = await client.query<{ name: string; applied_at: Date }>("select name, applied_at from schema_migrations order by name");
    console.log("schema_migrations:");
    for (const row of applied.rows) console.log(`  ${row.name}  ${new Date(row.applied_at).toISOString()}`);
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
