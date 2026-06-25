import type {
  Profile,
  Shift,
  ShiftWithProfile,
} from "@vitalize-interview/shared-types";
import { Layer } from "effect";
import * as Effect from "effect/Effect";
import { DatabaseLive } from "./db/drizzle";
import { deleteRecurrence } from "./effects/deleteRecurrence";
import { getAllProfiles } from "./effects/getAllProfiles";
import { getAllShiftAssignments } from "./effects/getAllShiftAssignments";
import { getProfilesMap } from "./effects/getProfilesMap";
import { promoteToWeekly } from "./effects/promoteToWeekly";
import { repatternFollowing } from "./effects/repatternFollowing";
import { toggleShiftAssignment } from "./effects/toggleShiftAssignment";
import { ScheduleRpcs } from "./request";

const prepareShiftsForScheduleV2 = (
  profiles: Profile[],
  shifts: Shift[],
): Record<string, Record<string, ShiftWithProfile>> => {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const result: Record<string, Record<string, ShiftWithProfile>> = {};

  for (const profile of profiles) {
    result[profile.id] = {};
  }

  for (const shift of shifts) {
    const profile = profilesById.get(shift.profileId);
    if (!profile) continue;

    result[shift.profileId][shift.date] = { ...shift, profile };
  }

  return result;
};

const prepareShiftsForScheduleV2Handler = Effect.fn(
  "prepareShiftsForScheduleV2",
)(function* () {
  const [profiles, shifts] = yield* Effect.all([
    getAllProfiles(),
    getAllShiftAssignments(),
  ]);
  return prepareShiftsForScheduleV2(profiles, shifts);
});

export { DatabaseLive };

export const ScheduleLive = ScheduleRpcs.toLayer({
  getProfilesMap,
  prepareShiftsForScheduleV2: prepareShiftsForScheduleV2Handler,
  toggleShiftAssignment,
  promoteToWeekly,
  deleteRecurrence,
  repatternFollowing,
}).pipe(Layer.provide(DatabaseLive));
