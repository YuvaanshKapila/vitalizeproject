import { useAtom, useAtomValue } from "@effect-atom/atom-react";
import type { Profile, ShiftWithProfile } from "@vitalize-interview/shared-types";
import { zdtFactory } from "@vitalize-interview/utils/temporal";
import { dateRangeAtom, profileAssignmentsAtom } from "../lib/atoms";

const ScheduleRow = ({
  profile,
  profilePreferences,
}: {
  profile: Profile;
  profilePreferences: Record<string, ShiftWithProfile>;
}) => {
  const { start: startDate, end: endDate } = useAtomValue(dateRangeAtom);
  const [profileAssignments, setProfileAssignments] = useAtom(
    profileAssignmentsAtom(profile.id),
  );

  // Construct shifts array
  const startZDT = zdtFactory.zdt(startDate);
  const endZDT = zdtFactory.zdt(endDate);
  const periodLength = endZDT.diff(startZDT, "day") + 1;
  const shifts: (ShiftWithProfile | null)[] = Array(periodLength).fill(null);

  Object.entries(profileAssignments || {}).forEach(([date, shift]) => {
    const shiftDateZDT = zdtFactory.zdt(date);
    const daysIntoSchedule = shiftDateZDT.diff(startZDT, "day");
    if (daysIntoSchedule >= 0 && daysIntoSchedule < periodLength) {
      shifts[daysIntoSchedule] = shift;
    }
  });

  return (
    <div className="flex h-11">
      <div className="flex w-56 flex-shrink-0 items-center border-b border-l border-r">
        <p className="flex-shrink-0 whitespace-nowrap py-2 pl-2">
          {profile.fullName}
        </p>
      </div>
      <div className="flex">
        {shifts.map((shift, daysIntoSchedule) => {
          return (
            <button
              key={`${profile.id}-${daysIntoSchedule.toString()}`}
              type="button"
              className="flex w-14 items-center justify-center border-b border-r py-2 hover:bg-gray-100"
            >
              {shift ? "X" : " "}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleRow;
