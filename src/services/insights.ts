/**
 * Builds per-day activity facts for an arbitrary period from the database,
 * feeding the pure aggregations in lib/analytics.
 */
import { activityCountsByDay, taskCompletionTimestamps, taskCountsByDay } from '@/db/repositories/activityRepo';
import { focusSecondsByDay } from '@/db/repositories/focusRepo';
import { listSessionsInRange } from '@/db/repositories/fitnessRepo';
import { listHabits, listLogs } from '@/db/repositories/habitsRepo';
import { listReviews } from '@/db/repositories/reviewsRepo';
import { peakHour, summarizePeriod, type DayActivity, type PeriodSummary } from '@/lib/analytics';
import { dateRange, type DateKey } from '@/lib/dates';
import { isHabitDueOn } from '@/lib/habits';
import { instantToWallClock } from '@/lib/timezone';

export interface HabitPeriodStat {
  id: string;
  title: string;
  color: string | null;
  planned: number;
  done: number;
}

export interface PeriodReport {
  days: DayActivity[];
  summary: PeriodSummary;
  previous: PeriodSummary;
  habits: HabitPeriodStat[];
  peakHour: number | null;
  workoutSeconds: number;
  activity: Record<DateKey, number>;
}

async function loadDays(from: DateKey, to: DateKey, today: DateKey): Promise<{ days: DayActivity[]; habits: HabitPeriodStat[]; workoutSeconds: number }> {
  const [tasks, habits, logs, focus, sessions, reviews] = await Promise.all([
    taskCountsByDay(from, to),
    listHabits(true),
    listLogs(from, to),
    focusSecondsByDay(from, to),
    listSessionsInRange(from, to),
    listReviews(from, to),
  ]);
  const done = new Set(logs.filter((log) => log.completed).map((log) => `${log.habitId}|${log.date}`));
  const habitStats = new Map<string, HabitPeriodStat>(habits.map((habit) => [habit.id, { id: habit.id, title: habit.title, color: habit.color, planned: 0, done: 0 }]));
  const moodByDay = new Map(reviews.map((review) => [review.date, review.mood]));
  const workoutsByDay = new Map<DateKey, number>();
  let workoutSeconds = 0;
  for (const session of sessions) {
    workoutsByDay.set(session.date, (workoutsByDay.get(session.date) ?? 0) + 1);
    workoutSeconds += ((session.endedAt ?? session.startedAt) - session.startedAt) / 1000;
  }

  const days: DayActivity[] = dateRange(from, to)
    .filter((date) => date <= today)
    .map((date) => {
      let habitsPlanned = 0;
      let habitsDone = 0;
      for (const habit of habits) {
        if (habit.startDate > date || habit.archived) continue;
        const isDone = done.has(`${habit.id}|${date}`);
        // Today only counts as planned once done, so mornings don't skew rates.
        const due = isHabitDueOn(habit.scheduleDays, date, habit.paused) && (date < today || isDone);
        if (!due) continue;
        habitsPlanned += 1;
        if (isDone) habitsDone += 1;
        const stat = habitStats.get(habit.id);
        if (stat) {
          stat.planned += 1;
          if (isDone) stat.done += 1;
        }
      }
      return {
        date,
        tasksPlanned: tasks[date]?.planned ?? 0,
        tasksDone: tasks[date]?.done ?? 0,
        habitsPlanned,
        habitsDone,
        focusSeconds: focus[date] ?? 0,
        workouts: workoutsByDay.get(date) ?? 0,
        mood: moodByDay.get(date) ?? null,
      };
    });
  return { days, habits: [...habitStats.values()].filter((stat) => stat.planned > 0), workoutSeconds };
}

export async function loadPeriodReport(from: DateKey, to: DateKey, previousFrom: DateKey, previousTo: DateKey, today: DateKey, timeZone: string): Promise<PeriodReport> {
  const [current, previous, completions, activity] = await Promise.all([
    loadDays(from, to, today),
    loadDays(previousFrom, previousTo, today),
    taskCompletionTimestamps(from, to),
    activityCountsByDay(from, to),
  ]);
  const hours = completions.map((ms) => Math.floor(instantToWallClock(ms, timeZone).minute / 60));
  return {
    days: current.days,
    summary: summarizePeriod(current.days),
    previous: summarizePeriod(previous.days),
    habits: current.habits.sort((a, b) => b.done / b.planned - a.done / a.planned),
    peakHour: peakHour(hours),
    workoutSeconds: current.workoutSeconds,
    activity,
  };
}
