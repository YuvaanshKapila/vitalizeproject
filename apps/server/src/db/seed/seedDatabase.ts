import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BunRuntime } from "@effect/platform-bun";
import { sql } from "drizzle-orm";
import { Effect } from "effect";
import { DB, DatabaseLive } from "../drizzle";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const clearDatabase = Effect.gen(function* () {
  const db = yield* DB;
  yield* db.execute(sql`TRUNCATE TABLE profile, shift_assignment CASCADE;`);
});

export const seedDatabase = Effect.gen(function* () {
  yield* clearDatabase;

  const db = yield* DB;

  const profileSqlPath = resolve(__dirname, "./profile.sql");
  const shiftAssignmentSqlPath = resolve(__dirname, "./shift_assignment.sql");
  const profileSql = readFileSync(profileSqlPath, "utf-8");
  const shiftAssignmentSql = readFileSync(shiftAssignmentSqlPath, "utf-8");

  yield* db.execute(sql.raw(profileSql));
  yield* db.execute(sql.raw(shiftAssignmentSql));
});

BunRuntime.runMain(Effect.provide(seedDatabase, DatabaseLive));
