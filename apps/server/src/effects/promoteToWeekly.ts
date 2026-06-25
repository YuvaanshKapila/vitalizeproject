import type { ShiftWithProfile } from "@vitalize-interview/shared-types";
import { zdtFactory } from "@vitalize-interview/utils/temporal";
import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { DB } from "../db/drizzle";
import { profile, shiftAssignment } from "../db/schema";

export const promoteToWeekly = Effect.fn("promoteToWeekly")(function* ({
  profileId,
  date,
  rangeEnd,
}: {
  profileId: string;
  date: string;
  rangeEnd: string;
}) {
  const db = yield* DB;

  const existingAnchor = yield* db
    .select({ id: shiftAssignment.id })
    .from(shiftAssignment)
    .where(
      and(
        eq(shiftAssignment.profileId, profileId),
        eq(shiftAssignment.date, date),
      ),
    );

  let anchorId: string;
  if (existingAnchor.length > 0) {
    anchorId = existingAnchor[0].id;
  } else {
    const insertedAnchor = yield* db
      .insert(shiftAssignment)
      .values({ profileId, date })
      .returning({ id: shiftAssignment.id });
    anchorId = insertedAnchor[0].id;
  }

  yield* db
    .update(shiftAssignment)
    .set({ recurrenceId: anchorId })
    .where(eq(shiftAssignment.id, anchorId));

  const endZDT = zdtFactory.zdt(rangeEnd);
  const occurrences: string[] = [];
  let cursor = zdtFactory.zdt(date).add({ days: 7 });
  while (cursor.isSameOrBefore(endZDT)) {
    occurrences.push(cursor.format.toDateYear({ iso: true }));
    cursor = cursor.add({ days: 7 });
  }

  if (occurrences.length > 0) {
    yield* db
      .insert(shiftAssignment)
      .values(
        occurrences.map((occurrence) => ({
          profileId,
          date: occurrence,
          recurrenceId: anchorId,
        })),
      )
      .onConflictDoNothing({
        target: [shiftAssignment.profileId, shiftAssignment.date],
      });
  }

  const [prof] = yield* db
    .select({ id: profile.id, fullName: profile.fullName })
    .from(profile)
    .where(eq(profile.id, profileId));

  const seriesRows = yield* db
    .select({
      id: shiftAssignment.id,
      profileId: shiftAssignment.profileId,
      date: sql<string>`${shiftAssignment.date}::text`,
      recurrenceId: shiftAssignment.recurrenceId,
    })
    .from(shiftAssignment)
    .where(eq(shiftAssignment.recurrenceId, anchorId));

  return seriesRows.map(
    (row): ShiftWithProfile => ({ ...row, profile: prof }),
  );
});
