import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import type { Profile } from "@vitalize-interview/shared-types";
import { zdtFactory } from "@vitalize-interview/utils/temporal";
import { useState } from "react";
import {
  dateRangeAtom,
  deleteRecurrenceAtom,
  preferencesAtom,
  profileAssignmentsAtom,
  promoteToWeeklyAtom,
  repatternFollowingAtom,
  toggleShiftAtom,
} from "../lib/atoms";

const WEEKDAYS = [
  { label: "S", value: 7 },
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "S", value: 6 },
];

const ScheduleRow = ({ profile }: { profile: Profile }) => {
  const { start, end } = useAtomValue(dateRangeAtom);
  const assignments = useAtomValue(profileAssignmentsAtom(profile.id));
  const toggleShift = useAtomSet(toggleShiftAtom, { mode: "promise" });
  const promote = useAtomSet(promoteToWeeklyAtom, { mode: "promise" });
  const removeRecurrence = useAtomSet(deleteRecurrenceAtom, { mode: "promise" });
  const repattern = useAtomSet(repatternFollowingAtom, { mode: "promise" });
  const refreshSchedule = useAtomRefresh(preferencesAtom);
  const after = (p: Promise<unknown>) =>
    void p.then(() => refreshSchedule()).catch(() => refreshSchedule());

  const [openDate, setOpenDate] = useState<string | null>(null);
  const [pickerDays, setPickerDays] = useState<number[] | null>(null);

  const startZDT = zdtFactory.zdt(start);
  const endZDT = zdtFactory.zdt(end);
  const periodLength = endZDT.diff(startZDT, "day") + 1;

  const cells = Array.from({ length: periodLength }, (_, index) => {
    const date = startZDT.add({ days: index }).format.toDateYear({ iso: true });
    return { date, shift: assignments?.[date] ?? null };
  });

  const closeMenu = () => {
    setOpenDate(null);
    setPickerDays(null);
  };

  const addShift = (date: string) =>
    after(toggleShift({ payload: { profileId: profile.id, date } }));

  const removeShift = (date: string) =>
    after(toggleShift({ payload: { profileId: profile.id, date } }));

  const repeatWeekly = (date: string) =>
    after(promote({ payload: { profileId: profile.id, date, rangeEnd: end } }));

  const removeSeries = (
    date: string,
    recurrenceId: string,
    scope: "this" | "following" | "all",
  ) => after(removeRecurrence({ payload: { recurrenceId, date, scope } }));

  const applyRepattern = (date: string) => {
    after(
      repattern({
        payload: {
          profileId: profile.id,
          fromDate: date,
          weekdays: pickerDays ?? [],
          rangeEnd: end,
        },
      }),
    );
    closeMenu();
  };

  const act = (run: () => void) => {
    run();
    closeMenu();
  };

  const toggleDay = (value: number) =>
    setPickerDays((days) =>
      (days ?? []).includes(value)
        ? (days ?? []).filter((day) => day !== value)
        : [...(days ?? []), value],
    );

  return (
    <div className="flex h-11">
      <div className="flex w-56 flex-shrink-0 items-center border-b border-l border-r">
        <p className="flex-shrink-0 whitespace-nowrap py-2 pl-2">
          {profile.fullName}
        </p>
      </div>
      <div className="flex">
        {cells.map(({ date, shift }) => (
          <div key={`${profile.id}-${date}`} className="relative">
            <button
              type="button"
              onClick={() =>
                shift
                  ? setOpenDate((current) => (current === date ? null : date))
                  : addShift(date)
              }
              className="flex w-14 items-center justify-center border-b border-r py-2 hover:bg-gray-100"
            >
              {shift ? "X" : " "}
            </button>
            {openDate === date && shift && (
              <>
                <div className="fixed inset-0 z-10" onClick={closeMenu} />
                <div className="absolute left-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-md border bg-white text-sm shadow-md">
                  {pickerDays !== null ? (
                    <div className="p-2">
                      <div className="mb-2 flex justify-between gap-1">
                        {WEEKDAYS.map((day, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => toggleDay(day.value)}
                            className={`size-6 rounded text-xs ${
                              pickerDays.includes(day.value)
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 hover:bg-gray-200"
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={pickerDays.length === 0}
                        onClick={() => applyRepattern(date)}
                        className="block w-full rounded bg-gray-900 px-3 py-1.5 text-white disabled:opacity-40"
                      >
                        Apply from this day
                      </button>
                    </div>
                  ) : shift.recurrenceId ? (
                    <>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                        onClick={() =>
                          act(() => removeSeries(date, shift.recurrenceId!, "this"))
                        }
                      >
                        This shift (day off)
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                        onClick={() =>
                          act(() =>
                            removeSeries(date, shift.recurrenceId!, "following"),
                          )
                        }
                      >
                        This &amp; following
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                        onClick={() =>
                          act(() => removeSeries(date, shift.recurrenceId!, "all"))
                        }
                      >
                        All shifts
                      </button>
                      <button
                        type="button"
                        className="block w-full border-t px-3 py-2 text-left hover:bg-gray-100"
                        onClick={() => setPickerDays([])}
                      >
                        Change days from here…
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                        onClick={() => act(() => removeShift(date))}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                        onClick={() => act(() => repeatWeekly(date))}
                      >
                        Repeat weekly
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleRow;