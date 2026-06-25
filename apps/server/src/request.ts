import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";

// Schedule Schemas
export const ProfileSchema = Schema.Struct({
  id: Schema.String,
  fullName: Schema.String,
});

export const ShiftWithProfileSchema = Schema.Struct({
  id: Schema.String,
  profileId: Schema.String,
  date: Schema.String,
  recurrenceId: Schema.NullOr(Schema.String),
  profile: ProfileSchema,
});

export const ScheduleSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Record({
    key: Schema.String,
    value: ShiftWithProfileSchema,
  }),
});

// Define a group of RPCs for Schedule
export class ScheduleRpcs extends RpcGroup.make(
  Rpc.make("getProfilesMap", {
    success: Schema.Record({ key: Schema.String, value: ProfileSchema }),
    error: Schema.Unknown,
  }),
  Rpc.make("prepareShiftsForScheduleV2", {
    success: ScheduleSchema,
    error: Schema.Unknown,
  }),
  Rpc.make("toggleShiftAssignment", {
    payload: { profileId: Schema.String, date: Schema.String },
    success: Schema.Struct({
      removed: Schema.Boolean,
      shift: Schema.NullOr(ShiftWithProfileSchema),
    }),
    error: Schema.Unknown,
  }),
  Rpc.make("promoteToWeekly", {
    payload: {
      profileId: Schema.String,
      date: Schema.String,
      rangeEnd: Schema.String,
    },
    success: Schema.Array(ShiftWithProfileSchema),
    error: Schema.Unknown,
  }),
  Rpc.make("deleteRecurrence", {
    payload: {
      recurrenceId: Schema.String,
      date: Schema.String,
      scope: Schema.Literal("this", "following", "all"),
    },
    success: Schema.Struct({
      profileId: Schema.String,
      removedDates: Schema.Array(Schema.String),
      remaining: Schema.Array(ShiftWithProfileSchema),
    }),
    error: Schema.Unknown,
  }),
  Rpc.make("repatternFollowing", {
    payload: {
      profileId: Schema.String,
      fromDate: Schema.String,
      weekdays: Schema.Array(Schema.Number),
      rangeEnd: Schema.String,
    },
    success: Schema.Struct({ profileId: Schema.String }),
    error: Schema.Unknown,
  }),
) {}
