/**
 * Journey statistics: active days and streaks.
 *
 * Definitions (shared by the dashboard, My Journey, Insights and the
 * achievement engine so every number agrees):
 *
 *   ACTIVE DAY     — a local calendar date with at least one qualifying
 *                    activity (see `QUALIFYING_ACTIVITIES`). Opening the app
 *                    never qualifies.
 *   CURRENT STREAK — consecutive active days ending today, or ending
 *                    yesterday if today has no qualifying activity yet (so a
 *                    streak is not "lost" at 00:01).
 *   LONGEST STREAK — the longest run of consecutive active days ever.
 *
 * Dates after `today` are ignored so a future-dated record cannot inflate
 * the numbers.
 */
import { addDays, diffDays, type DateKey } from './dates';

export const QUALIFYING_ACTIVITIES = [
  'task_completed',
  'entry_completed',
  'habit_completed',
  'mood_logged',
  'journal_written',
  'workout_completed',
  'focus_completed',
  'assignment_completed',
  'class_attended',
] as const;

/** A focus session must last at least this long to count as activity. */
export const MIN_QUALIFYING_FOCUS_SECONDS = 5 * 60;

export interface StreakRun {
  start: DateKey;
  end: DateKey;
  length: number;
}

export interface JourneyStats {
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  firstActive: DateKey | null;
  lastActive: DateKey | null;
  activeToday: boolean;
}

export function normalizeActiveDates(dates: Iterable<DateKey>, today: DateKey): DateKey[] {
  const unique = new Set<DateKey>();
  for (const date of dates) {
    if (date <= today) unique.add(date);
  }
  return [...unique].sort();
}

/** Consecutive runs from a sorted, de-duplicated list. */
export function streakRuns(sortedDates: readonly DateKey[]): StreakRun[] {
  const runs: StreakRun[] = [];
  let current: StreakRun | null = null;
  for (const date of sortedDates) {
    if (current && diffDays(current.end, date) === 1) {
      current.end = date;
      current.length += 1;
    } else {
      current = { start: date, end: date, length: 1 };
      runs.push(current);
    }
  }
  return runs;
}

export function computeJourneyStats(dates: Iterable<DateKey>, today: DateKey): JourneyStats {
  const sorted = normalizeActiveDates(dates, today);
  const runs = streakRuns(sorted);
  const last = runs[runs.length - 1];
  const activeToday = last?.end === today;
  let currentStreak = 0;
  if (last && (last.end === today || last.end === addDays(today, -1))) {
    currentStreak = last.length;
  }
  return {
    activeDays: sorted.length,
    currentStreak,
    longestStreak: runs.reduce((max, run) => Math.max(max, run.length), 0),
    firstActive: sorted[0] ?? null,
    lastActive: sorted[sorted.length - 1] ?? null,
    activeToday,
  };
}
