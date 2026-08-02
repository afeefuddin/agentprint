import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "./index";

const migration = await readFile(
  resolve(import.meta.dir, "../migrations/001_initial.sql"),
  "utf8"
);

await pool.query(migration);
await pool.end();
console.log("Database migrated.");
