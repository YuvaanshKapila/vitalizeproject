import { zdtFactory } from "@vitalize-interview/utils/temporal";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { DB } from "../db/drizzle";
import { shiftAssignment } from "../db/schema";
import { promoteToWeekly } from "./promoteToWeekly";

export const repatternFollowing = Effect.fn("repatternFollowing")(function* ({
  profileId,
  fromDate,
  weekdays,
  rangeEnd,
}: {
  profileId: string;
  fromDate: string;
  weekdays: readonly number[];
  rangeEnd: string;
}) {
  const db = yield* DB;

  yield* db
    .delete(shiftAssignment)
    .where(
      and(
        eq(shiftAssignment.profileId, profileId),
        isNotNull(shiftAssignment.recurrenceId),
        gte(shiftAssignment.date, fromDate),
      ),
    );

  const endZDT = zdtFactory.zdt(rangeEnd);
  for (const weekday of weekdays) {
    let cursor = zdtFactory.zdt(fromDate);
    for (let i = 0; i < 7 && cursor.dayOfWeek !== weekday; i++) {
      cursor = cursor.add({ days: 1 });
    }
    if (cursor.dayOfWeek !== weekday || !cursor.isSameOrBefore(endZDT)) continue;
    yield* promoteToWeekly({
      profileId,
      date: cursor.format.toDateYear({ iso: true }),
      rangeEnd,
    });
  }

  return { profileId };
});