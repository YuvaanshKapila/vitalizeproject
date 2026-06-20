import { afterAll, beforeEach } from "bun:test";
import * as Effect from "effect/Effect";
import { DatabaseLive } from "./drizzle";
import { clearDatabase, seedDatabase } from "./seed/seedDatabase";

beforeEach(() =>
  Effect.runPromise(clearDatabase.pipe(Effect.provide(DatabaseLive))),
);

afterAll(() =>
  Effect.runPromise(seedDatabase.pipe(Effect.provide(DatabaseLive))),
);
