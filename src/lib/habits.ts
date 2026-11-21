/**
 * Habit streak and consistency maths.
 *
 * Habits may be scheduled on specific weekdays only (e.g. gym Mon/Wed/Fri).
 * A habit streak therefore counts consecutive *scheduled* days that were
 * completed; unscheduled days neither break nor extend it. Like the journey
 * streak, today only breaks the streak once it is over.
 *
 * All values are derived from the stored per-day completion logs, never
 * from the habit's current settings alone, so editing a target later does
 * not rewrite history.
 */
import { addDays, compareDateKeys, diffDays, weekdayOf, type DateKey } from './dates';

export interface HabitStreaks {
  current: number;
  longest: number;
}

function isScheduled(date: DateKey, scheduleDays: readonly number[]): boolean {
  return scheduleDays.length === 0 || scheduleDays.includes(weekdayOf(date));
}

export function habitStreaks(
  scheduleDays: readonly number[],
  completedDates: ReadonlySet<DateKey>,
  startDate: DateKey,
  today: DateKey,
): HabitStreaks {
  const earliestCompleted = [...completedDates].sort(compareDateKeys)[0];
  const from = earliestCompleted && earliestCompleted < startDate ? earliestCompleted : startDate;
  if (from > today) return { current: 0, longest: 0 };
  let longest = 0;
  let running = 0;
  const span = Math.min(diffDays(from, today), 3650);
  for (let offset = 0; offset <= span; offset += 1) {
    const date = addDays(from, offset);
    if (!isScheduled(date, scheduleDays)) continue;
    if (completedDates.has(date)) {
      running += 1;
      longest = Math.max(longest, running);
    } else if (date !== today) {
      running = 0;
    }
  }
  return { current: running, longest };
}

/** Completed scheduled days ÷ scheduled days in the trailing window (0–1). */
export function habitConsistency(
  scheduleDays: readonly number[],
  completedDates: ReadonlySet<DateKey>,
  startDate: DateKey,
  today: DateKey,
  windowDays = 30,
): number {
  let scheduled = 0;
  let done = 0;
  for (let offset = 0; offset < windowDays; offset += 1) {
    const date = addDays(today, -offset);
    if (date < startDate) break;
    if (!isScheduled(date, scheduleDays)) continue;
    // Today counts only once completed, so mornings do not drag the rate down.
    if (date === today && !completedDates.has(date)) continue;
    scheduled += 1;
    if (completedDates.has(date)) done += 1;
  }
  return scheduled === 0 ? 0 : done / scheduled;
}

export function isHabitDueOn(scheduleDays: readonly number[], date: DateKey, paused: boolean): boolean {
  return !paused && isScheduled(date, scheduleDays);
}
