import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { DatabaseLive, DB } from "../db/drizzle";
import { profile, shiftAssignment } from "../db/schema";
import { deleteRecurrence } from "./deleteRecurrence";
import { promoteToWeekly } from "./promoteToWeekly";
import { repatternFollowing } from "./repatternFollowing";
import { toggleShiftAssignment } from "./toggleShiftAssignment";

const run = <A, E>(effect: Effect.Effect<A, E, DB>) =>
  Effect.runPromise(effect.pipe(Effect.provide(DatabaseLive)));

const makeProfile = (fullName: string) =>
  Effect.gen(function* () {
    const db = yield* DB;
    const [created] = yield* db
      .insert(profile)
      .values({ fullName })
      .returning({ id: profile.id });
    return created.id;
  });

const listRows = (profileId: string) =>
  Effect.gen(function* () {
    const db = yield* DB;
    return yield* db
      .select({
        id: shiftAssignment.id,
        date: sql<string>`${shiftAssignment.date}::text`,
        recurrenceId: shiftAssignment.recurrenceId,
      })
      .from(shiftAssignment)
      .where(eq(shiftAssignment.profileId, profileId));
  });

const datesOf = (rows: { date: string }[]) => rows.map((row) => row.date).sort();

// Mondays in the seeded range: 09-16, 09-23, 09-30, 10-07.
const ANCHOR = "2024-09-16";
const RANGE_END = "2024-10-07";
const ALL_MONDAYS = ["2024-09-16", "2024-09-23", "2024-09-30", "2024-10-07"];

test("toggle adds then removes a single one-off shift", async () => {
  const profileId = await run(makeProfile("Toggle Tester"));

  const added = await run(toggleShiftAssignment({ profileId, date: ANCHOR }));
  expect(added.removed).toBe(false);
  expect(added.shift?.date).toBe(ANCHOR);
  expect(added.shift?.recurrenceId).toBeNull();
  expect((await run(listRows(profileId))).length).toBe(1);

  const removed = await run(toggleShiftAssignment({ profileId, date: ANCHOR }));
  expect(removed.removed).toBe(true);
  expect((await run(listRows(profileId))).length).toBe(0);
});

test("promoteToWeekly fills the same weekday forward and is idempotent", async () => {
  const profileId = await run(makeProfile("Anna"));
  await run(toggleShiftAssignment({ profileId, date: ANCHOR }));

  const series = await run(
    promoteToWeekly({ profileId, date: ANCHOR, rangeEnd: RANGE_END }),
  );
  expect(datesOf(series)).toEqual(ALL_MONDAYS);
  expect(new Set(series.map((row) => row.recurrenceId)).size).toBe(1);

  const again = await run(
    promoteToWeekly({ profileId, date: ANCHOR, rangeEnd: RANGE_END }),
  );
  expect(again.length).toBe(4);
  expect((await run(listRows(profileId))).length).toBe(4);
});

test("delete this removes one occurrence and leaves the series intact", async () => {
  const profileId = await run(makeProfile("Bob"));
  await run(toggleShiftAssignment({ profileId, date: ANCHOR }));
  const series = await run(
    promoteToWeekly({ profileId, date: ANCHOR, rangeEnd: RANGE_END }),
  );
  const recurrenceId = series[0].recurrenceId as string;

  const res = await run(
    deleteRecurrence({ recurrenceId, date: "2024-09-23", scope: "this" }),
  );
  expect(res.removedDates).toEqual(["2024-09-23"]);
  expect(datesOf(await run(listRows(profileId)))).toEqual([
    "2024-09-16",
    "2024-09-30",
    "2024-10-07",
  ]);
});

test("delete this on the anchor re-anchors onto the earliest survivor", async () => {
  const profileId = await run(makeProfile("Cara"));
  await run(toggleShiftAssignment({ profileId, date: ANCHOR }));
  const series = await run(
    promoteToWeekly({ profileId, date: ANCHOR, rangeEnd: RANGE_END }),
  );
  const recurrenceId = series[0].recurrenceId as string;

  const res = await run(
    deleteRecurrence({ recurrenceId, date: ANCHOR, scope: "this" }),
  );
  expect(res.removedDates).toEqual([ANCHOR]);

  const rows = await run(listRows(profileId));
  expect(datesOf(rows)).toEqual(["2024-09-23", "2024-09-30", "2024-10-07"]);

  const recIds = new Set(rows.map((row) => row.recurrenceId));
  expect(recIds.size).toBe(1);
  const newAnchorId = [...recIds][0];
  expect(newAnchorId).not.toBeNull();
  expect(rows.find((row) => row.id === newAnchorId)?.date).toBe("2024-09-23");
});

test("delete following removes from the date onward and preserves history", async () => {
  const profileId = await run(makeProfile("Dana"));
  await run(toggleShiftAssignment({ profileId, date: ANCHOR }));
  const series = await run(
    promoteToWeekly({ profileId, date: ANCHOR, rangeEnd: RANGE_END }),
  );
  const recurrenceId = series[0].recurrenceId as string;

  const res = await run(
    deleteRecurrence({ recurrenceId, date: "2024-09-30", scope: "following" }),
  );
  expect(res.removedDates.sort()).toEqual(["2024-09-30", "2024-10-07"]);
  expect(datesOf(await run(listRows(profileId)))).toEqual([
    "2024-09-16",
    "2024-09-23",
  ]);
});

test("repatternFollowing changes the pattern forward and preserves history", async () => {
  const profileId = await run(makeProfile("Anna"));
  for (const monday of ["2024-09-16", "2024-09-18", "2024-09-20"]) {
    await run(toggleShiftAssignment({ profileId, date: monday }));
    await run(promoteToWeekly({ profileId, date: monday, rangeEnd: RANGE_END }));
  }

  await run(
    repatternFollowing({
      profileId,
      fromDate: "2024-09-30",
      weekdays: [2, 4],
      rangeEnd: RANGE_END,
    }),
  );

  const rows = await run(listRows(profileId));
  expect(datesOf(rows)).toEqual([
    "2024-09-16",
    "2024-09-18",
    "2024-09-20",
    "2024-09-23",
    "2024-09-25",
    "2024-09-27",
    "2024-10-01",
    "2024-10-03",
  ]);
  expect(
    rows.find((row) => row.date === "2024-10-01")?.recurrenceId,
  ).not.toBeNull();
  expect(
    rows.find((row) => row.date === "2024-10-03")?.recurrenceId,
  ).not.toBeNull();
});

test("delete all clears the entire series", async () => {
  const profileId = await run(makeProfile("Evan"));
  await run(toggleShiftAssignment({ profileId, date: ANCHOR }));
  const series = await run(
    promoteToWeekly({ profileId, date: ANCHOR, rangeEnd: RANGE_END }),
  );
  const recurrenceId = series[0].recurrenceId as string;

  const res = await run(
    deleteRecurrence({ recurrenceId, date: ANCHOR, scope: "all" }),
  );
  expect(res.removedDates.length).toBe(4);
  expect((await run(listRows(profileId))).length).toBe(0);
});
