import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Atom } from "@effect-atom/atom";
import { AtomRpc, Result } from "@effect-atom/atom-react";
import { ScheduleRpcs } from "@vitalize-interview/server/src/request";
import type { ShiftWithProfile } from "@vitalize-interview/shared-types";
import { Layer } from "effect";

// Rpc Client

const ProtocolLive = RpcClient.layerProtocolHttp({
  url: "/rpc",
}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));

class ScheduleClient extends AtomRpc.Tag<ScheduleClient>()("ScheduleClient", {
  group: ScheduleRpcs,
  protocol: ProtocolLive,
}) {}

// Atoms

export const dateRangeAtom = Atom.make({
  start: "2024-09-15",
  end: "2024-10-07",
});

export const profilesAtom = ScheduleClient.query("getProfilesMap", void 0, {
  reactivityKeys: ["profiles"],
});

export const preferencesAtom = ScheduleClient.query(
  "prepareShiftsForScheduleV2",
  void 0,
  {
    reactivityKeys: ["preferences"],
  },
);

export const assignmentsAtom = Atom.make<
  Record<string, Record<string, ShiftWithProfile>>
>({});

export const profileAssignmentsAtom = Atom.family((profileId: string) =>
  Atom.writable<
    Record<string, ShiftWithProfile>,
    Record<string, ShiftWithProfile>
  >(
    (get) => {
      const assignments = get(assignmentsAtom)[profileId];
      if (assignments) return assignments;
      const prefs = get(preferencesAtom);
      return Result.isSuccess(prefs) ? prefs.value[profileId] : {};
    },
    (ctx, next) => {
      ctx.set(assignmentsAtom, {
        ...ctx.get(assignmentsAtom),
        [profileId]: next,
      });
    },
  ),
);
