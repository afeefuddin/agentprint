import { pool } from "./index";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to reset a production database");
}

await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await pool.end();
console.log("Database reset.");
