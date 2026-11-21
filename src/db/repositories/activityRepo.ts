/**
 * Cross-table reads for My Journey, achievements and analytics.
 * The qualifying-activity list here must match `QUALIFYING_ACTIVITIES` in
 * lib/journey.ts.
 */
import type { DateKey } from '@/lib/dates';
import { MIN_QUALIFYING_FOCUS_SECONDS } from '@/lib/journey';

import { db } from '../driver';

/** Every distinct local date with at least one qualifying activity. */
export async function listActiveDates(): Promise<DateKey[]> {
  const rows = await db().all<{ d: string }>(
    `SELECT completed_date AS d FROM tasks WHERE completed_date IS NOT NULL
     UNION SELECT completed_date FROM entry_completions
     UNION SELECT log_date FROM habit_logs WHERE completed = 1
     UNION SELECT review_date FROM day_reviews
     UNION SELECT entry_date FROM journal_entries
     UNION SELECT session_date FROM workout_sessions WHERE ended_at IS NOT NULL
     UNION SELECT session_date FROM focus_sessions
       WHERE mode IN ('focus','stopwatch') AND actual_seconds >= ?
     UNION SELECT completed_date FROM assignments WHERE completed_date IS NOT NULL
     UNION SELECT class_date FROM attendance_records WHERE status = 'present'
     ORDER BY d`,
    [MIN_QUALIFYING_FOCUS_SECONDS],
  );
  return rows.map((row) => row.d);
}

/** Number of qualifying actions per date, for the activity heatmap intensity. */
export async function activityCountsByDay(from: DateKey, to: DateKey): Promise<Record<DateKey, number>> {
  const rows = await db().all<{ d: string; c: number }>(
    `SELECT d, COUNT(*) AS c FROM (
       SELECT completed_date AS d FROM tasks WHERE completed_date BETWEEN ?1 AND ?2
       UNION ALL SELECT completed_date FROM entry_completions WHERE completed_date BETWEEN ?1 AND ?2
       UNION ALL SELECT log_date FROM habit_logs WHERE completed = 1 AND log_date BETWEEN ?1 AND ?2
       UNION ALL SELECT review_date FROM day_reviews WHERE review_date BETWEEN ?1 AND ?2
       UNION ALL SELECT entry_date FROM journal_entries WHERE entry_date BETWEEN ?1 AND ?2
       UNION ALL SELECT session_date FROM workout_sessions WHERE ended_at IS NOT NULL AND session_date BETWEEN ?1 AND ?2
       UNION ALL SELECT session_date FROM focus_sessions
         WHERE mode IN ('focus','stopwatch') AND actual_seconds >= ?3 AND session_date BETWEEN ?1 AND ?2
       UNION ALL SELECT completed_date FROM assignments WHERE completed_date BETWEEN ?1 AND ?2
       UNION ALL SELECT class_date FROM attendance_records WHERE status = 'present' AND class_date BETWEEN ?1 AND ?2
     ) GROUP BY d`,
    [from, to, MIN_QUALIFYING_FOCUS_SECONDS],
  );
  return Object.fromEntries(rows.map((row) => [row.d, row.c]));
}

export interface TaskDayCounts {
  planned: number;
  done: number;
}

/**
 * Per day: tasks due that day (planned) and how many of those are done.
 * Tasks completed on a different day than due still count as done for
 * their due day, which is what "did I finish what I planned" means.
 */
export async function taskCountsByDay(from: DateKey, to: DateKey): Promise<Record<DateKey, TaskDayCounts>> {
  const rows = await db().all<{ d: string; planned: number; done: number }>(
    `SELECT due_date AS d, COUNT(*) AS planned, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS done
     FROM tasks WHERE due_date BETWEEN ? AND ? GROUP BY due_date`,
    [from, to],
  );
  return Object.fromEntries(rows.map((row) => [row.d, { planned: row.planned, done: row.done ?? 0 }]));
}

/** Completed tasks per completion day (includes undated tasks). */
export async function tasksCompletedByDay(from: DateKey, to: DateKey): Promise<Record<DateKey, number>> {
  const rows = await db().all<{ d: string; c: number }>(
    'SELECT completed_date AS d, COUNT(*) AS c FROM tasks WHERE completed_date BETWEEN ? AND ? GROUP BY completed_date',
    [from, to],
  );
  return Object.fromEntries(rows.map((row) => [row.d, row.c]));
}

/** Completion hour histogram (0–23) from task completion timestamps. */
export async function taskCompletionTimestamps(from: DateKey, to: DateKey): Promise<number[]> {
  const rows = await db().all<{ completed_at: number }>(
    'SELECT completed_at FROM tasks WHERE completed_date BETWEEN ? AND ? AND completed_at IS NOT NULL',
    [from, to],
  );
  return rows.map((row) => row.completed_at);
}
