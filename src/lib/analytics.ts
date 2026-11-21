/**
 * Pure aggregation for Insights and the dashboard. Inputs are per-day facts
 * read from the database; nothing here invents or estimates values. When a
 * metric has no underlying data it is `null` and the UI shows an empty state
 * rather than a misleading 0 %.
 */
import type { DateKey } from './dates';

export interface DayActivity {
  date: DateKey;
  tasksPlanned: number;
  tasksDone: number;
  habitsPlanned: number;
  habitsDone: number;
  focusSeconds: number;
  workouts: number;
  mood: number | null;
}

/** Share of planned tasks + scheduled habits completed, or null if nothing was planned. */
export function dayCompletion(day: Pick<DayActivity, 'tasksPlanned' | 'tasksDone' | 'habitsPlanned' | 'habitsDone'>): number | null {
  const planned = day.tasksPlanned + day.habitsPlanned;
  if (planned === 0) return null;
  return Math.min(1, (day.tasksDone + day.habitsDone) / planned);
}

export interface PeriodSummary {
  days: number;
  tasksPlanned: number;
  tasksDone: number;
  taskRate: number | null;
  habitsPlanned: number;
  habitsDone: number;
  habitRate: number | null;
  focusSeconds: number;
  focusDays: number;
  workouts: number;
  moodAverage: number | null;
  moodCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  completion: number | null;
  bestDay: { date: DateKey; completion: number } | null;
}

export function summarizePeriod(days: readonly DayActivity[]): PeriodSummary {
  const moodCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let tasksPlanned = 0;
  let tasksDone = 0;
  let habitsPlanned = 0;
  let habitsDone = 0;
  let focusSeconds = 0;
  let focusDays = 0;
  let workouts = 0;
  let moodSum = 0;
  let moodN = 0;
  let bestDay: PeriodSummary['bestDay'] = null;

  for (const day of days) {
    tasksPlanned += day.tasksPlanned;
    tasksDone += day.tasksDone;
    habitsPlanned += day.habitsPlanned;
    habitsDone += day.habitsDone;
    focusSeconds += day.focusSeconds;
    if (day.focusSeconds > 0) focusDays += 1;
    workouts += day.workouts;
    if (day.mood != null) {
      const level = Math.max(1, Math.min(5, Math.round(day.mood))) as 1 | 2 | 3 | 4 | 5;
      moodCounts[level] += 1;
      moodSum += day.mood;
      moodN += 1;
    }
    const completion = dayCompletion(day);
    if (completion != null && (!bestDay || completion > bestDay.completion)) {
      bestDay = { date: day.date, completion };
    }
  }

  const planned = tasksPlanned + habitsPlanned;
  return {
    days: days.length,
    tasksPlanned,
    tasksDone,
    taskRate: tasksPlanned ? tasksDone / tasksPlanned : null,
    habitsPlanned,
    habitsDone,
    habitRate: habitsPlanned ? habitsDone / habitsPlanned : null,
    focusSeconds,
    focusDays,
    workouts,
    moodAverage: moodN ? moodSum / moodN : null,
    moodCounts,
    completion: planned ? Math.min(1, (tasksDone + habitsDone) / planned) : null,
    bestDay,
  };
}

/** Relative change between two rates, in percentage points, or null. */
export function deltaPoints(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 100);
}

/** Hour (0–23) with the most completions, or null. */
export function peakHour(hours: readonly number[]): number | null {
  if (hours.length === 0) return null;
  const buckets = new Array<number>(24).fill(0);
  hours.forEach((hour) => {
    if (hour >= 0 && hour < 24) buckets[hour] = (buckets[hour] ?? 0) + 1;
  });
  let best = 0;
  for (let hour = 1; hour < 24; hour += 1) {
    if ((buckets[hour] ?? 0) > (buckets[best] ?? 0)) best = hour;
  }
  return best;
}

export function formatDuration(seconds: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(seconds / 60));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
