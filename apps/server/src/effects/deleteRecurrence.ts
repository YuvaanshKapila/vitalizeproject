import type { ShiftWithProfile } from "@vitalize-interview/shared-types";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { DB } from "../db/drizzle";
import { profile, shiftAssignment } from "../db/schema";

type Scope = "this" | "following" | "all";

export const deleteRecurrence = Effect.fn("deleteRecurrence")(function* ({
  recurrenceId,
  date,
  scope,
}: {
  recurrenceId: string;
  date: string;
  scope: Scope;
}) {
  const db = yield* DB;

  const seriesRows = yield* db
    .select({
      id: shiftAssignment.id,
      profileId: shiftAssignment.profileId,
      date: sql<string>`${shiftAssignment.date}::text`,
    })
    .from(shiftAssignment)
    .where(eq(shiftAssignment.recurrenceId, recurrenceId));

  if (seriesRows.length === 0) {
    return { profileId: "", removedDates: [], remaining: [] };
  }

  const profileId = seriesRows[0].profileId;
  let removedDates: string[];
  let survivingRecurrenceId: string | null;

  if (scope === "all") {
    yield* db
      .delete(shiftAssignment)
      .where(eq(shiftAssignment.recurrenceId, recurrenceId));
    removedDates = seriesRows.map((row) => row.date);
    survivingRecurrenceId = null;
  } else if (scope === "following") {
    yield* db
      .delete(shiftAssignment)
      .where(
        and(
          eq(shiftAssignment.recurrenceId, recurrenceId),
          gte(shiftAssignment.date, date),
        ),
      );
    removedDates = seriesRows
      .filter((row) => row.date >= date)
      .map((row) => row.date);
    survivingRecurrenceId = seriesRows.some((row) => row.date < date)
      ? recurrenceId
      : null;
  } else {
    const target = seriesRows.find((row) => row.date === date);
    if (!target) {
      removedDates = [];
      survivingRecurrenceId = recurrenceId;
    } else if (target.id !== recurrenceId) {
      yield* db
        .delete(shiftAssignment)
        .where(eq(shiftAssignment.id, target.id));
      removedDates = [date];
      survivingRecurrenceId = recurrenceId;
    } else {
      const children = seriesRows.filter((row) => row.id !== recurrenceId);
      if (children.length === 0) {
        yield* db
          .delete(shiftAssignment)
          .where(eq(shiftAssignment.id, recurrenceId));
        removedDates = [date];
        survivingRecurrenceId = null;
      } else {
        const newAnchor = children.reduce(
          (earliest, row) => (row.date < earliest.date ? row : earliest),
          children[0],
        );
        yield* db
          .update(shiftAssignment)
          .set({ recurrenceId: newAnchor.id })
          .where(
            and(
              eq(shiftAssignment.recurrenceId, recurrenceId),
              ne(shiftAssignment.id, recurrenceId),
            ),
          );
        yield* db
          .delete(shiftAssignment)
          .where(eq(shiftAssignment.id, recurrenceId));
        removedDates = [date];
        survivingRecurrenceId = newAnchor.id;
      }
    }
  }

  let remaining: ShiftWithProfile[] = [];
  if (survivingRecurrenceId !== null) {
    const [prof] = yield* db
      .select({ id: profile.id, fullName: profile.fullName })
      .from(profile)
      .where(eq(profile.id, profileId));

    const rows = yield* db
      .select({
        id: shiftAssignment.id,
        profileId: shiftAssignment.profileId,
        date: sql<string>`${shiftAssignment.date}::text`,
        recurrenceId: shiftAssignment.recurrenceId,
      })
      .from(shiftAssignment)
      .where(eq(shiftAssignment.recurrenceId, survivingRecurrenceId));

    remaining = rows.map((row): ShiftWithProfile => ({ ...row, profile: prof }));
  }

  return { profileId, removedDates, remaining };
});
