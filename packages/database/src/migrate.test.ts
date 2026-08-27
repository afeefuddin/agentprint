import { describe, expect, test } from "bun:test";
import { pendingMigrations, type AppliedMigration, type Migration } from "./migrate";

function migration(name: string, checksum: string): Migration {
  return { name, checksum, sql: `-- ${name}` };
}

describe("pendingMigrations", () => {
  const migrations = [
    migration("001_initial.sql", "first"),
    migration("002_profiles.sql", "second"),
    migration("003_sessions.sql", "third")
  ];

  test("returns only migrations that have not been applied", () => {
    const applied: AppliedMigration[] = [
      { name: "001_initial.sql", checksum: "first" },
      { name: "002_profiles.sql", checksum: "second" }
    ];

    expect(pendingMigrations(migrations, applied)).toEqual([migrations[2]]);
  });

  test("allows an empty ledger to bootstrap an existing idempotent schema", () => {
    expect(pendingMigrations(migrations, [])).toEqual(migrations);
  });

  test("rejects a modified applied migration", () => {
    expect(() =>
      pendingMigrations(migrations, [{ name: "001_initial.sql", checksum: "changed" }])
    ).toThrow("Applied migration has been modified: 001_initial.sql");
  });

  test("rejects an applied migration missing from the repository", () => {
    expect(() =>
      pendingMigrations(migrations, [{ name: "000_removed.sql", checksum: "removed" }])
    ).toThrow("Applied migration is missing from the repository: 000_removed.sql");
  });
});
