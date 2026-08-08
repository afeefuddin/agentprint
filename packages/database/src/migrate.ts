import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "./index";

const migrationsDirectory = resolve(import.meta.dir, "../migrations");
const migrations = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const migration of migrations) {
  await pool.query(await readFile(resolve(migrationsDirectory, migration), "utf8"));
}
await pool.end();
console.log(`Database migrated through ${migrations.at(-1)}.`);
