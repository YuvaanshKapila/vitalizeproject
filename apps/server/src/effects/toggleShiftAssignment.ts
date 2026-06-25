import type { ShiftWithProfile } from "@vitalize-interview/shared-types";
import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { DB } from "../db/drizzle";
import { profile, shiftAssignment } from "../db/schema";

export const toggleShiftAssignment = Effect.fn("toggleShiftAssignment")(
  function* ({ profileId, date }: { profileId: string; date: string }) {
    const db = yield* DB;

    const existing = yield* db
      .select({ id: shiftAssignment.id })
      .from(shiftAssignment)
      .where(
        and(
          eq(shiftAssignment.profileId, profileId),
          eq(shiftAssignment.date, date),
        ),
      );

    if (existing.length > 0) {
      yield* db
        .delete(shiftAssignment)
        .where(eq(shiftAssignment.id, existing[0].id));
      return { removed: true, shift: null };
    }

    const inserted = yield* db
      .insert(shiftAssignment)
      .values({ profileId, date })
      .returning({
        id: shiftAssignment.id,
        profileId: shiftAssignment.profileId,
        date: sql<string>`${shiftAssignment.date}::text`,
        recurrenceId: shiftAssignment.recurrenceId,
      });

    const [prof] = yield* db
      .select({ id: profile.id, fullName: profile.fullName })
      .from(profile)
      .where(eq(profile.id, profileId));

    const shift: ShiftWithProfile = { ...inserted[0], profile: prof };
    return { removed: false, shift };
  },
);
