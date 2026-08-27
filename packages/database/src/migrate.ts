import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

const migrationScriptPath = fileURLToPath(import.meta.url);
const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url));
const migrationFilePattern = /^\d{3}_[a-z0-9_]+\.sql$/;
const migrationLockName = "agentprint:database-migrations";

export type Migration = {
  name: string;
  checksum: string;
  sql: string;
};

export type AppliedMigration = Pick<Migration, "name" | "checksum">;

function checksum(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

export function pendingMigrations(
  migrations: Migration[],
  appliedMigrations: AppliedMigration[]
): Migration[] {
  const available = new Map(migrations.map((migration) => [migration.name, migration]));

  for (const applied of appliedMigrations) {
    const migration = available.get(applied.name);
    if (!migration) {
      throw new Error(`Applied migration is missing from the repository: ${applied.name}`);
    }
    if (migration.checksum !== applied.checksum) {
      throw new Error(`Applied migration has been modified: ${applied.name}`);
    }
  }

  const appliedNames = new Set(appliedMigrations.map((migration) => migration.name));
  return migrations.filter((migration) => !appliedNames.has(migration.name));
}

async function readMigrations(): Promise<Migration[]> {
  const names = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of names) {
    if (!migrationFilePattern.test(name)) {
      throw new Error(`Invalid migration filename: ${name}`);
    }
  }

  const sequenceNumbers = names.map((name) => name.slice(0, 3));
  if (new Set(sequenceNumbers).size !== sequenceNumbers.length) {
    throw new Error("Migration sequence numbers must be unique.");
  }

  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(resolve(migrationsDirectory, name), "utf8");
      return { name, checksum: checksum(sql), sql };
    })
  );
}

function databaseUrl(production: boolean): string {
  if (production) {
    if (process.env.VERCEL_ENV !== "production") {
      throw new Error("Production migrations may only run in Vercel production.");
    }

    const directUrl = process.env.DATABASE_DIRECT_URL?.trim();
    if (!directUrl) {
      throw new Error("DATABASE_DIRECT_URL is required for production migrations.");
    }
    return directUrl;
  }

  return (
    process.env.DATABASE_DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "postgres://agentprint:agentprint@localhost:54329/agentprint"
  );
}

async function ensureMigrationLedger(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS agentprint_schema_migrations (
      migration_name text PRIMARY KEY,
      checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function loadAppliedMigrations(client: PoolClient): Promise<AppliedMigration[]> {
  const result = await client.query<{
    migration_name: string;
    checksum_sha256: string;
  }>(`
    SELECT migration_name, checksum_sha256
    FROM agentprint_schema_migrations
    ORDER BY migration_name
  `);

  return result.rows.map((row) => ({
    name: row.migration_name,
    checksum: row.checksum_sha256
  }));
}

async function applyMigration(client: PoolClient, migration: Migration): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(migration.sql);
    await client.query(
      `INSERT INTO agentprint_schema_migrations (migration_name, checksum_sha256)
       VALUES ($1, $2)`,
      [migration.name, migration.checksum]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function migrate(production = false): Promise<void> {
  const migrations = await readMigrations();
  if (migrations.length === 0) {
    throw new Error("No database migrations found.");
  }

  const pool = new Pool({
    connectionString: databaseUrl(production),
    max: 1,
    application_name: "agentprint-migrations"
  });
  let client: PoolClient | undefined;
  let lockAcquired = false;

  try {
    client = await pool.connect();
    await client.query("SET statement_timeout = '60s'");
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [migrationLockName]);
    lockAcquired = true;
    await client.query("SET statement_timeout = '5min'");

    await ensureMigrationLedger(client);
    const applied = await loadAppliedMigrations(client);
    const pending = pendingMigrations(migrations, applied);

    for (const migration of pending) {
      await applyMigration(client, migration);
      console.log(`Applied ${migration.name}.`);
    }

    if (pending.length === 0) {
      console.log(`Database already migrated through ${migrations.at(-1)!.name}.`);
    } else {
      console.log(`Database migrated through ${pending.at(-1)!.name}.`);
    }
  } finally {
    try {
      if (client && lockAcquired) {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [migrationLockName]);
      }
    } finally {
      client?.release();
      await pool.end();
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === migrationScriptPath) {
  await migrate(process.argv.includes("--production"));
}
